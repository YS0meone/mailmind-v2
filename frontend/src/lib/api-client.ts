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

export async function toggleThreadRead(threadId: string, isUnread: boolean) {
  return backendFetch(`/api/v1/threads/${threadId}/read`, {
    method: "PATCH",
    body: JSON.stringify({ is_unread: isUnread }),
  });
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
  draft_id?: string;
}) {
  return backendFetch("/api/v1/emails/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// --- Drafts ---

export async function createDraft(payload: {
  subject?: string;
  body?: string;
  to?: { name?: string; email: string }[];
  cc?: { name?: string; email: string }[];
  bcc?: { name?: string; email: string }[];
  mode?: string;
  reply_to_message_id?: string;
  thread_id?: string;
}) {
  return backendFetch("/api/v1/drafts/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listDrafts() {
  return backendFetch("/api/v1/drafts/");
}

export async function getDraft(draftId: string) {
  return backendFetch(`/api/v1/drafts/${draftId}`);
}

export async function updateDraft(
  draftId: string,
  payload: {
    subject?: string;
    body?: string;
    to?: { name?: string; email: string }[];
    cc?: { name?: string; email: string }[];
    bcc?: { name?: string; email: string }[];
  }
) {
  return backendFetch(`/api/v1/drafts/${draftId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteDraft(draftId: string) {
  return backendFetch(`/api/v1/drafts/${draftId}`, { method: "DELETE" });
}

export async function getDraftsByThread(threadId: string) {
  return backendFetch(`/api/v1/drafts/by-thread/${threadId}`);
}

export async function autocompleteContacts(
  q: string
): Promise<{ name?: string; email: string }[]> {
  if (!q.trim()) return [];
  const params = new URLSearchParams({ q, limit: "10" });
  return backendFetch(`/api/v1/contacts/autocomplete?${params}`);
}

// --- Labels ---

export async function listLabels() {
  return backendFetch("/api/v1/labels/");
}

export async function createLabel(payload: {
  name: string;
  color: string;
  description?: string;
  rules?: Record<string, unknown> | null;
}) {
  return backendFetch("/api/v1/labels/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateLabel(
  labelId: string,
  payload: { name?: string; color?: string; description?: string; rules?: Record<string, unknown> | null; position?: number }
) {
  return backendFetch(`/api/v1/labels/${labelId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteLabel(labelId: string) {
  return backendFetch(`/api/v1/labels/${labelId}`, { method: "DELETE" });
}

export async function setThreadLabels(threadId: string, labelIds: string[]) {
  return backendFetch(`/api/v1/threads/${threadId}/labels`, {
    method: "PUT",
    body: JSON.stringify({ label_ids: labelIds }),
  });
}

// --- AI Compose ---

export function streamCompose(
  body: {
    instruction: string;
    thread_subject?: string;
    thread_snippet?: string;
    sender_name?: string;
  },
  onToken: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (err: string) => void,
): AbortController {
  const controller = new AbortController();
  const token = getToken();

  fetch(`${BACKEND_URL}/api/v1/agent/compose`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        onError(err.detail || "Compose request failed");
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        onError("No response stream");
        return;
      }
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (eventType === "token") onToken(data.content);
            else if (eventType === "done") onDone(data.full_text);
            else if (eventType === "error") onError(data.detail);
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err.message);
    });

  return controller;
}

// --- AI Chat ---

export function streamChat(
  messages: { role: string; content: string }[],
  onToken: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (err: string) => void,
): AbortController {
  const controller = new AbortController();
  const token = getToken();

  fetch(`${BACKEND_URL}/api/v1/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        onError(err.detail || "Chat request failed");
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        onError("No response stream");
        return;
      }
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (eventType === "token") onToken(data.content);
            else if (eventType === "done") onDone(data.full_text);
            else if (eventType === "error") onError(data.detail);
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err.message);
    });

  return controller;
}

// --- Sync ---

export async function triggerSync() {
  return backendFetch("/api/v1/sync/trigger", { method: "POST" });
}

export async function getSyncStatus() {
  return backendFetch("/api/v1/sync/status");
}
