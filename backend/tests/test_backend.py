from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("ENV", "test")
os.environ.setdefault("INVITE_CODES", "ALPHA123:甲组,BETA456:乙组")
os.environ.setdefault("TOKEN_SECRET", "test-secret-with-at-least-thirty-two-characters")
os.environ.setdefault("DATABASE_URL", "sqlite:////tmp/lighting-helper-tests.db")

from main import Auth, Settings, Store  # noqa: E402


class BackendTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        root = Path(self.temporary.name)
        settings = Settings(
            env="test",
            database_url=f"sqlite:////{root / 'app.db'}",
            token_secret="test-secret-with-at-least-thirty-two-characters",
            invite_codes=(("ALPHA123", "甲组"), ("BETA456", "乙组")),
            frontend_origin="",
            backup_dir=root / "backup",
        )
        self.store = Store(settings)
        self.auth = Auth(settings.token_secret)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_invite_and_token(self) -> None:
        self.assertIsNone(self.store.login("wrong"))
        user_id, label = self.store.login("alpha123") or ("", "")
        self.assertEqual(label, "甲组")
        token = self.auth.issue(user_id, label)
        claims = self.auth.verify(token)
        self.assertEqual(claims and claims["sub"], user_id)
        self.assertIsNone(self.auth.verify(token + "broken"))

    def test_shots_are_isolated(self) -> None:
        first, _ = self.store.login("ALPHA123") or ("", "")
        second, _ = self.store.login("BETA456") or ("", "")
        shot = {
            "id": "shot-1",
            "version": 3,
            "project": "测试",
            "createdAt": "2026-08-28T00:00:00Z",
            "updatedAt": "2026-08-28T00:00:00Z",
        }
        self.store.put_shot(first, "shot-1", shot)
        self.assertEqual(len(self.store.list_shots(first)), 1)
        self.assertEqual(self.store.list_shots(second), [])

    def test_backup_and_restore(self) -> None:
        user_id, _ = self.store.login("ALPHA123") or ("", "")
        self.store.put_shot(
            user_id,
            "shot-1",
            {"id": "shot-1", "version": 3, "createdAt": "x", "updatedAt": "x"},
        )
        self.assertTrue(self.store.backup())
        self.store.path.unlink()
        restored = Store(self.store.settings)
        self.assertEqual(len(restored.list_shots(user_id)), 1)


if __name__ == "__main__":
    unittest.main()
