import type { SavedShot } from "./shot-storage";
import { persistShots } from "./shot-storage";

export const AUTH_TOKEN_KEY = "lighting-helper-auth-token-v1";
export const AUTH_USER_KEY = "lighting-helper-auth-user-v1";
export const AUTH_EXPIRED_EVENT = "lighting-helper-auth-expired";

const token = () =>
  typeof window === "undefined"
    ? ""
    : window.localStorage.getItem(AUTH_TOKEN_KEY) ?? "";

const apiRequest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  const currentToken = token();
  if (currentToken) headers.set("Authorization", `Bearer ${currentToken}`);

  const response = await fetch(path, { ...init, headers });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  } & T;

  if (response.status === 401) {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_USER_KEY);
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  if (!response.ok) {
    throw new Error(payload.error?.message || "云端服务暂时不可用。");
  }
  return payload;
};

export async function validateSession() {
  if (!token()) return null;
  const response = await apiRequest<{ user: { id: string; label: string } }>(
    "/api/auth/me",
  );
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(response.user));
  return response.user;
}

export async function loginWithInvite(code: string) {
  const response = await apiRequest<{
    token: string;
    expires_in: number;
    user: { id: string; label: string };
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  window.localStorage.setItem(AUTH_TOKEN_KEY, response.token);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(response.user));
  return response.user;
}

export function logoutSession() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

export async function saveCloudShot(record: SavedShot) {
  await apiRequest<{ ok: true }>(`/api/shots/${encodeURIComponent(record.id)}`, {
    method: "PUT",
    body: JSON.stringify(record),
  });
}

export async function deleteCloudShot(id: string) {
  await apiRequest<{ ok: true }>(`/api/shots/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

const newer = (left: SavedShot, right: SavedShot) =>
  Date.parse(left.updatedAt) >= Date.parse(right.updatedAt) ? left : right;

export async function syncCloudShots(local: SavedShot[]) {
  const response = await apiRequest<{ items: SavedShot[] }>("/api/shots");
  const remote = Array.isArray(response.items) ? response.items : [];
  const merged = new Map<string, SavedShot>();
  for (const item of [...remote, ...local]) {
    const existing = merged.get(item.id);
    merged.set(item.id, existing ? newer(existing, item) : item);
  }
  const result = Array.from(merged.values())
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 100);
  persistShots(result);

  const remoteById = new Map(remote.map((item) => [item.id, item]));
  const pending = result.filter((item) => {
    const existing = remoteById.get(item.id);
    return !existing || Date.parse(item.updatedAt) > Date.parse(existing.updatedAt);
  });
  await Promise.all(pending.map(saveCloudShot));
  return result;
}
