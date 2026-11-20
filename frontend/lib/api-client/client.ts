// Thin fetch wrapper the rest of the API client builds on. Every typed
// function in this folder (auth.ts, etc.) goes through this -- don't add
// hand-written fetch calls directly in components.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    // Network-level failure (backend not running, CORS, DNS, etc.) --
    // distinct from a normal HTTP error response below.
    throw new ApiError("Could not reach the server. Is the backend running?", 0);
  }

  if (!response.ok) {
    let detail: string | undefined;
    try {
      const body = await response.json();
      detail = typeof body?.detail === "string" ? body.detail : undefined;
    } catch {
      // response body wasn't JSON -- fall through to the generic message
    }
    throw new ApiError(detail ?? `Request failed (${response.status})`, response.status);
  }

  // 204 No Content etc. -- nothing to parse
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
