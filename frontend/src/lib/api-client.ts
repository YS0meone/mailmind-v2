import { getToken } from "./auth";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function backendFetch(
  path: string,
  options: RequestInit = {}
) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Session expired — clear token and redirect to login
    if (typeof window !== "undefined") {
      localStorage.removeItem("mailmind_token");
      window.location.href = "/login";
    }
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "Backend request failed");
  }

  if (res.status === 204) return null;
  return res.json();
}

/**
 * Exchange a Nylas auth code for a session token.
 * This is called from the callback page — no auth header needed.
 */
export async function exchangeNylasCode(code: string, redirectUri: string) {
  const res = await fetch(`${BACKEND_URL}/api/v1/auth/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "Failed to sign in");
  }

  return res.json();
}

export async function listAccounts() {
  return backendFetch("/api/v1/auth/accounts");
}

export async function disconnectAccount(accountId: string) {
  return backendFetch(`/api/v1/auth/accounts/${accountId}`, {
    method: "DELETE",
  });
}

export async function getMe() {
  return backendFetch("/api/v1/auth/me");
}

// --- Threads & Emails ---

export async function listThreads(cursor?: string, folder?: string, q?: string) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (folder) params.set("folder", folder);
  if (q) params.set("q", q);
  const qs = params.toString();
  return backendFetch(`/api/v1/threads/${qs ? `?${qs}` : ""}`);
}

export async function getThread(threadId: string) {
  return backendFetch(`/api/v1/threads/${threadId}`);
}

export async function markThreadRead(threadId: string) {
  return backendFetch(`/api/v1/threads/${threadId}/read`, { method: "PATCH" });
}

export async function toggleThreadStar(threadId: string, starred: boolean) {
  return backendFetch(`/api/v1/threads/${threadId}/star`, {
    method: "PATCH",
    body: JSON.stringify({ is_starred: starred }),
  });
}

export async function deleteThread(threadId: string) {
  return backendFetch(`/api/v1/threads/${threadId}`, { method: "DELETE" });
}

export async function updateEmail(
  emailId: string,
  updates: { is_unread?: boolean; is_starred?: boolean }
) {
  return backendFetch(`/api/v1/emails/${emailId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function sendEmail(payload: {
  to: { name?: string; email: string }[];
  cc?: { name?: string; email: string }[];
  bcc?: { name?: string; email: string }[];
  subject: string;
  body: string;
  reply_to_message_id?: string;
}) {
  return backendFetch("/api/v1/emails/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function autocompleteContacts(
  q: string
): Promise<{ name?: string; email: string }[]> {
  if (!q.trim()) return [];
  const params = new URLSearchParams({ q, limit: "10" });
  return backendFetch(`/api/v1/contacts/autocomplete?${params}`);
}

export async function triggerSync() {
  return backendFetch("/api/v1/sync/trigger", { method: "POST" });
}

export async function getSyncStatus() {
  return backendFetch("/api/v1/sync/status");
}
