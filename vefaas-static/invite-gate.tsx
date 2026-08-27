import { type FormEvent, type ReactNode, useState } from "react";

const ACCESS_KEY = "lighting-helper-invite-access-v1";
const ACCESS_DAYS = 30;
const INVITE_HASH =
  "f15a79ed8960ce6a1e03f5248db80908977517800fe8a8701c23d2813aa48828";

const hasAccess = () => {
  if (typeof window === "undefined") return false;
  const grantedAt = Number(window.localStorage.getItem(ACCESS_KEY));
  const maxAge = ACCESS_DAYS * 24 * 60 * 60 * 1000;
  return Number.isFinite(grantedAt) && Date.now() - grantedAt < maxAge;
};

const digest = async (value: string) => {
  const bytes = new TextEncoder().encode(value.trim().toUpperCase());
  const hash = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

export function InviteGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(hasAccess);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  if (unlocked) return children;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecking(true);
    setError("");

    try {
      if ((await digest(code)) !== INVITE_HASH) {
        setError("邀请码不正确，请向剧组负责人获取。\n");
        return;
      }
      window.localStorage.setItem(ACCESS_KEY, String(Date.now()));
      setUnlocked(true);
    } catch {
      setError("当前浏览器无法验证邀请码，请升级浏览器后重试。");
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="invite-shell">
      <div className="invite-backdrop" aria-hidden="true" />
      <section className="invite-card" aria-labelledby="invite-title">
        <div className="invite-mark">别穿帮</div>
        <p className="invite-eyebrow">LIGHTING CONTINUITY · 内测访问</p>
        <h1 id="invite-title">让下一镜的光，接得上上一镜。</h1>
        <p className="invite-copy">
          输入剧组邀请码，进入灯具功率、色温和环境补光计算器。
        </p>

        <form className="invite-form" onSubmit={submit}>
          <label htmlFor="invite-code">邀请码</label>
          <div className="invite-input-row">
            <input
              id="invite-code"
              name="invite-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="例如：BCB2026"
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
          <span>一次验证，本机 30 天内免重复输入</span>
          <span>照片仅在当前设备分析</span>
        </div>
      </section>
    </main>
  );
}
