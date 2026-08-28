from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import shutil
import sqlite3
import threading
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse


MAX_BODY_BYTES = 768 * 1024
MAX_SHOTS_PER_USER = 100
TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60
BACKUP_INTERVAL_SECONDS = 5 * 60


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_log(event: str, **fields: Any) -> None:
    payload = {"event": event, "time": utc_now(), **fields}
    logging.info(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))


def b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def b64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def database_path(url: str) -> Path:
    prefix = "sqlite:////"
    if not url.startswith(prefix):
        raise RuntimeError("DATABASE_URL must use sqlite:////absolute/path")
    return Path("/" + url[len(prefix) :].lstrip("/"))


@dataclass(frozen=True)
class Settings:
    env: str
    database_url: str
    token_secret: str
    invite_codes: tuple[tuple[str, str], ...]
    frontend_origin: str
    backup_dir: Path | None

    @classmethod
    def load(cls) -> "Settings":
        env = os.environ.get("ENV", "dev")
        database_url = os.environ.get(
            "DATABASE_URL", "sqlite:////tmp/data/lighting-helper.db"
        )
        token_secret = os.environ.get("TOKEN_SECRET", "")
        raw_codes = os.environ.get("INVITE_CODES", "")
        frontend_origin = os.environ.get("FRONTEND_ORIGIN", "")
        backup_value = os.environ.get("BACKUP_DIR", "").strip()

        invite_codes: list[tuple[str, str]] = []
        for index, entry in enumerate(raw_codes.split(","), start=1):
            entry = entry.strip()
            if not entry:
                continue
            code, separator, label = entry.partition(":")
            invite_codes.append(
                (code.strip().upper(), label.strip() if separator else f"用户{index:02d}")
            )

        if env == "prod":
            if len(token_secret) < 32:
                raise RuntimeError("TOKEN_SECRET must contain at least 32 characters")
            if not invite_codes:
                raise RuntimeError("INVITE_CODES must contain at least one invite code")

        return cls(
            env=env,
            database_url=database_url,
            token_secret=token_secret or "development-only-secret-change-me",
            invite_codes=tuple(invite_codes or (("LOCAL-DEMO", "本地测试用户"),)),
            frontend_origin=frontend_origin,
            backup_dir=Path(backup_value) if backup_value else None,
        )


class Store:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.path = database_path(settings.database_url)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._restore_if_needed()
        self._initialize()
        self._stop = threading.Event()
        self._backup_thread: threading.Thread | None = None

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA busy_timeout=10000")
        return connection

    def _initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    label TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    last_login_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS shots (
                    user_id TEXT NOT NULL,
                    id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (user_id, id),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_shots_user_updated
                ON shots(user_id, updated_at DESC);
                """
            )

    def _backup_path(self) -> Path | None:
        if not self.settings.backup_dir:
            return None
        return self.settings.backup_dir / "db_backup" / "lighting-helper.db"

    def _restore_if_needed(self) -> None:
        backup = self._backup_path()
        if self.path.exists() or not backup or not backup.exists():
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(backup, self.path)
        json_log("database_restored", backup=str(backup))

    def backup(self) -> bool:
        backup = self._backup_path()
        if not backup:
            return False
        backup.parent.mkdir(parents=True, exist_ok=True)
        temporary = backup.with_suffix(".tmp")
        with self.connect() as source, sqlite3.connect(temporary) as target:
            source.backup(target)
        os.replace(temporary, backup)
        json_log("database_backup_complete", backup=str(backup))
        return True

    def start_backup_loop(self) -> None:
        if not self.settings.backup_dir or self._backup_thread:
            return

        def loop() -> None:
            while not self._stop.wait(BACKUP_INTERVAL_SECONDS):
                try:
                    self.backup()
                except Exception as error:  # noqa: BLE001
                    json_log("database_backup_failed", error=type(error).__name__)

        self._backup_thread = threading.Thread(target=loop, daemon=True)
        self._backup_thread.start()

    def stop(self) -> None:
        self._stop.set()

    def login(self, code: str) -> tuple[str, str] | None:
        normalized = code.strip().upper()
        match = next(
            (
                (candidate, label)
                for candidate, label in self.settings.invite_codes
                if hmac.compare_digest(normalized, candidate)
            ),
            None,
        )
        if not match:
            return None
        candidate, label = match
        user_id = hashlib.sha256(candidate.encode("utf-8")).hexdigest()[:24]
        now = utc_now()
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO users(id, label, created_at, last_login_at)
                VALUES(?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    label=excluded.label,
                    last_login_at=excluded.last_login_at
                """,
                (user_id, label, now, now),
            )
        return user_id, label

    def list_shots(self, user_id: str) -> list[dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT payload FROM shots
                WHERE user_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (user_id, MAX_SHOTS_PER_USER),
            ).fetchall()
        return [json.loads(row["payload"]) for row in rows]

    def put_shot(self, user_id: str, shot_id: str, payload: dict[str, Any]) -> None:
        now = utc_now()
        created_at = str(payload.get("createdAt") or now)
        updated_at = str(payload.get("updatedAt") or now)
        serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO shots(user_id, id, payload, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?)
                ON CONFLICT(user_id, id) DO UPDATE SET
                    payload=excluded.payload,
                    updated_at=excluded.updated_at
                """,
                (user_id, shot_id, serialized, created_at, updated_at),
            )
            connection.execute(
                """
                DELETE FROM shots
                WHERE user_id = ? AND id NOT IN (
                    SELECT id FROM shots
                    WHERE user_id = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                )
                """,
                (user_id, user_id, MAX_SHOTS_PER_USER),
            )
        if self.settings.backup_dir:
            self.backup()

    def delete_shot(self, user_id: str, shot_id: str) -> None:
        with self.connect() as connection:
            connection.execute(
                "DELETE FROM shots WHERE user_id = ? AND id = ?", (user_id, shot_id)
            )
        if self.settings.backup_dir:
            self.backup()


class Auth:
    def __init__(self, secret: str):
        self.secret = secret.encode("utf-8")

    def issue(self, user_id: str, label: str) -> str:
        now = int(time.time())
        payload = b64url_encode(
            json.dumps(
                {"sub": user_id, "label": label, "iat": now, "exp": now + TOKEN_TTL_SECONDS},
                ensure_ascii=False,
                separators=(",", ":"),
            ).encode("utf-8")
        )
        signature = b64url_encode(
            hmac.new(self.secret, f"v1.{payload}".encode("ascii"), hashlib.sha256).digest()
        )
        return f"v1.{payload}.{signature}"

    def verify(self, token: str) -> dict[str, Any] | None:
        try:
            version, payload, signature = token.split(".", 2)
            if version != "v1":
                return None
            expected = b64url_encode(
                hmac.new(self.secret, f"v1.{payload}".encode("ascii"), hashlib.sha256).digest()
            )
            if not hmac.compare_digest(signature, expected):
                return None
            claims = json.loads(b64url_decode(payload))
            if int(claims.get("exp", 0)) <= int(time.time()):
                return None
            if not isinstance(claims.get("sub"), str):
                return None
            return claims
        except (ValueError, TypeError, json.JSONDecodeError):
            return None


SETTINGS = Settings.load()
STORE = Store(SETTINGS)
AUTH = Auth(SETTINGS.token_secret)


class Handler(BaseHTTPRequestHandler):
    server_version = "LightingContinuityAPI/1.0"

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _cors_headers(self) -> dict[str, str]:
        origin = self.headers.get("Origin", "")
        allowed = SETTINGS.frontend_origin
        if allowed and origin == allowed:
            return {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Trace-Id",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Max-Age": "86400",
                "Vary": "Origin",
            }
        return {}

    def _send(self, status: int, payload: dict[str, Any], trace_id: str) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Trace-Id", trace_id)
        for key, value in self._cors_headers().items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status: int, code: str, message: str, trace_id: str) -> None:
        self._send(
            status,
            {"error": {"code": code, "message": message, "trace_id": trace_id}},
            trace_id,
        )

    def _body(self, trace_id: str) -> dict[str, Any] | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY_BYTES:
                raise ValueError
            value = json.loads(self.rfile.read(length))
            if not isinstance(value, dict):
                raise ValueError
            return value
        except (ValueError, json.JSONDecodeError):
            self._error(HTTPStatus.BAD_REQUEST, "invalid_request", "请求内容无效。", trace_id)
            return None

    def _claims(self, trace_id: str) -> dict[str, Any] | None:
        authorization = self.headers.get("Authorization", "")
        token = authorization.removeprefix("Bearer ").strip()
        claims = AUTH.verify(token)
        if not claims:
            self._error(HTTPStatus.UNAUTHORIZED, "unauthorized", "请重新输入邀请码。", trace_id)
            return None
        return claims

    def do_OPTIONS(self) -> None:  # noqa: N802
        trace_id = self.headers.get("X-Trace-Id") or str(uuid.uuid4())
        self._send(HTTPStatus.NO_CONTENT, {}, trace_id)

    def do_GET(self) -> None:  # noqa: N802
        self._dispatch("GET")

    def do_POST(self) -> None:  # noqa: N802
        self._dispatch("POST")

    def do_PUT(self) -> None:  # noqa: N802
        self._dispatch("PUT")

    def do_DELETE(self) -> None:  # noqa: N802
        self._dispatch("DELETE")

    def _dispatch(self, method: str) -> None:
        started = time.perf_counter()
        trace_id = self.headers.get("X-Trace-Id") or str(uuid.uuid4())
        path = urlparse(self.path).path.rstrip("/") or "/"
        status = HTTPStatus.INTERNAL_SERVER_ERROR
        user_id = ""
        try:
            if method == "GET" and path in ("/", "/api/health"):
                status = HTTPStatus.OK
                self._send(status, {"ok": True, "service": "lighting-continuity-api"}, trace_id)
                return

            if method == "POST" and path == "/api/auth/login":
                body = self._body(trace_id)
                if body is None:
                    status = HTTPStatus.BAD_REQUEST
                    return
                result = STORE.login(str(body.get("code", "")))
                if not result:
                    status = HTTPStatus.UNAUTHORIZED
                    self._error(status, "invalid_invite", "邀请码不正确。", trace_id)
                    return
                user_id, label = result
                status = HTTPStatus.OK
                self._send(
                    status,
                    {
                        "token": AUTH.issue(user_id, label),
                        "expires_in": TOKEN_TTL_SECONDS,
                        "user": {"id": user_id, "label": label},
                    },
                    trace_id,
                )
                return

            claims = self._claims(trace_id)
            if not claims:
                status = HTTPStatus.UNAUTHORIZED
                return
            user_id = claims["sub"]

            if method == "GET" and path == "/api/auth/me":
                status = HTTPStatus.OK
                self._send(
                    status,
                    {"user": {"id": user_id, "label": claims.get("label", "剧组用户")}},
                    trace_id,
                )
                return

            if method == "GET" and path == "/api/shots":
                status = HTTPStatus.OK
                self._send(status, {"items": STORE.list_shots(user_id)}, trace_id)
                return

            prefix = "/api/shots/"
            if path.startswith(prefix):
                shot_id = unquote(path[len(prefix) :])
                if not shot_id or len(shot_id) > 128:
                    status = HTTPStatus.BAD_REQUEST
                    self._error(status, "invalid_shot", "镜次编号无效。", trace_id)
                    return
                if method == "PUT":
                    body = self._body(trace_id)
                    if body is None:
                        status = HTTPStatus.BAD_REQUEST
                        return
                    if body.get("id") != shot_id or body.get("version") != 3:
                        status = HTTPStatus.BAD_REQUEST
                        self._error(status, "invalid_shot", "镜次记录格式无效。", trace_id)
                        return
                    STORE.put_shot(user_id, shot_id, body)
                    status = HTTPStatus.OK
                    self._send(status, {"ok": True}, trace_id)
                    return
                if method == "DELETE":
                    STORE.delete_shot(user_id, shot_id)
                    status = HTTPStatus.OK
                    self._send(status, {"ok": True}, trace_id)
                    return

            status = HTTPStatus.NOT_FOUND
            self._error(status, "not_found", "接口不存在。", trace_id)
        except Exception as error:  # noqa: BLE001
            status = HTTPStatus.INTERNAL_SERVER_ERROR
            json_log("request_failed", trace_id=trace_id, error=type(error).__name__)
            self._error(status, "internal_error", "服务暂时不可用，请稍后再试。", trace_id)
        finally:
            json_log(
                "request_complete",
                trace_id=trace_id,
                method=method,
                path=path,
                status=int(status),
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
                user_id=user_id or None,
            )


def run() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    STORE.start_backup_loop()
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    json_log(
        "service_started",
        port=port,
        env=SETTINGS.env,
        backup_enabled=bool(SETTINGS.backup_dir),
    )
    try:
        server.serve_forever()
    finally:
        STORE.stop()
        server.server_close()


if __name__ == "__main__":
    run()
