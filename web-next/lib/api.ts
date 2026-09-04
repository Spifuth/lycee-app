/**
 * Typed client for the FastAPI backend.
 *
 * The API is unchanged by the frontend migration — same routes, same SQLite
 * database, same session cookies. nginx proxies /api/* to lycee-api, so the
 * base URL is empty and every call is same-origin.
 *
 * This file currently carries only what the shell needs. Auth lands with
 * sub-project B and the quiz/vote/questions/live surface with C; both extend
 * `api` below rather than introducing a second client.
 */

const API_BASE =
  (typeof window !== 'undefined'
    ? (window as unknown as { __API_BASE?: string }).__API_BASE
    : undefined) ?? ''

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || JSON.stringify(body)
    } catch {
      // Body was not JSON; the status text is the best message available.
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface StatsOut {
  users_total: number
  signups_24h: number
  quizzes_completed: number
  animations_viewed: number
  votes_cast: number
  questions_asked: number
  vote_open: boolean
}

export const api = {
  stats: () => request<StatsOut>('/api/stats'),
}
