const API_BASE = (typeof window !== "undefined"
  ? (window as unknown as { __API_BASE?: string }).__API_BASE
  : undefined) ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface SignupOut {
  pseudo: string;
  passphrase: string;
  avatar_seed: string;
  qr_data_url: string;
  qr_login_url: string;
  discord_invite_url?: string | null;
}

export interface BadgeOut {
  id: string;
  label: string;
  emoji: string;
  description: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface ProfileOut {
  pseudo: string;
  avatar_seed: string;
  avatar_url: string;
  bio: string;
  created_at: string;
  last_seen: string;
  badges: BadgeOut[];
  discord_invite_url?: string | null;
  custom_avatar_status?: "pending" | "approved" | null;
}

export interface StatsOut {
  users_total: number;
  signups_24h: number;
  quizzes_completed: number;
  animations_viewed: number;
  votes_cast: number;
  questions_asked: number;
  vote_open: boolean;
}

export const api = {
  signup: (pseudo: string, bio?: string) =>
    request<SignupOut>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ pseudo, bio }),
    }),
  login: (pseudo: string, passphrase: string) =>
    request<{ pseudo: string; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ pseudo, passphrase }),
    }),
  loginQR: (qr_token: string) =>
    request<{ pseudo: string; token: string }>("/api/auth/login-qr", {
      method: "POST",
      body: JSON.stringify({ qr_token }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => request<ProfileOut>("/api/profile/me"),
  patchMe: (patch: { bio?: string; avatar_seed?: string }) =>
    request<ProfileOut>("/api/profile/me", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteMe: () => request<{ ok: boolean }>("/api/profile/me", { method: "DELETE" }),
  stats: () => request<StatsOut>("/api/stats"),
  postEvent: (type: string, payload: Record<string, unknown> = {}) =>
    request<{ id: number; type: string; ts: string; badges_granted: string[] }>("/api/events", {
      method: "POST",
      body: JSON.stringify({ type, payload }),
    }),
};
