import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import {
  AUTH_EXPIRED_EVENT,
  loginWithInvite,
  logoutSession,
  validateSession,
} from "../app/cloud-api";

export function InviteGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"checking" | "locked" | "unlocked">(
    "checking",
  );
  const [userLabel, setUserLabel] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void validateSession()
      .then((user) => {
        if (user) {
          setUserLabel(user.label);
          setStatus("unlocked");
        } else {
          setStatus("locked");
        }
      })
      .catch(() => setStatus("locked"));
    const expire = () => setStatus("locked");
    window.addEventListener(AUTH_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expire);
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecking(true);
    setError("");

    try {
      const user = await loginWithInvite(code.trim());
      setUserLabel(user.label);
      setStatus("unlocked");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "邀请码验证失败，请稍后重试。",
      );
    } finally {
      setChecking(false);
    }
  };

  if (status === "checking") {
    return (
      <main className="invite-shell invite-checking">
        <div className="invite-backdrop" aria-hidden="true" />
        <p>正在确认剧组访问权限…</p>
      </main>
    );
  }

  if (status === "unlocked") {
    return (
      <>
        {children}
        <button
          className="invite-logout"
          type="button"
          onClick={() => {
            logoutSession();
            setCode("");
            setStatus("locked");
          }}
        >
          {userLabel || "剧组用户"} · 退出
        </button>
      </>
    );
  }

  return (
    <main className="invite-shell">
      <div className="invite-backdrop" aria-hidden="true" />
      <section className="invite-card" aria-labelledby="invite-title">
        <div className="invite-mark">别穿帮</div>
        <p className="invite-eyebrow">LIGHTING CONTINUITY · 内测访问</p>
        <h1 id="invite-title">让下一镜的光，接得上上一镜。</h1>
        <p className="invite-copy">
          输入专属剧组邀请码，进入灯具功率、色温和环境补光计算器。
        </p>

        <form className="invite-form" onSubmit={submit}>
          <label htmlFor="invite-code">邀请码</label>
          <div className="invite-input-row">
            <input
              id="invite-code"
              name="invite-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="输入你的专属邀请码"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              required
            />
            <button type="submit" disabled={checking || !code.trim()}>
              {checking ? "验证中…" : "进入助手"}
            </button>
          </div>
          <p className="invite-error" role="alert" aria-live="polite">
            {error}
          </p>
        </form>

        <div className="invite-meta">
          <span>安全令牌 7 天有效，到期后重新验证</span>
          <span>照片仅在当前设备分析</span>
        </div>
      </section>
    </main>
  );
}
