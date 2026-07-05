/**
 * API client for ByteBudd backend.
 * All requests go through /api prefix (proxied by Nginx to backend:8000).
 */

import { OllamaProfile, OllamaProfileCreate, OllamaProfileUpdate, DBConnection, DBConnectionCreate, Conversation, ConversationDetail } from "@/types";

// Use a relative URL so the browser always calls back to the host that served the page.
// This works correctly whether accessed from localhost or another machine on the network.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

// Token management
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("bytebudd_token");
}

export function setToken(token: string): void {
  localStorage.setItem("bytebudd_token", token);
}

export function removeToken(): void {
  localStorage.removeItem("bytebudd_token");
}

// Core fetch wrapper with auth header
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/v1${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Don't redirect on the login endpoint itself — let the error bubble up
    if (!path.includes("/auth/login")) {
      removeToken();
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    // detail can be a string or an array of validation errors (FastAPI 422)
    const detail = error.detail;
    let message: string;
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join("; ");
    } else {
      message = `HTTP ${response.status}`;
    }
    throw new Error(message);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ── Auth API ──────────────────────────────────────────────────────────────

export const authApi = {
  setupRequired: () =>
    apiFetch<{ required: boolean }>("/auth/setup-required"),

  setup: (email: string, password: string) =>
    apiFetch<{ id: number; email: string; role: string; is_active: boolean }>("/auth/setup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  registrationOpen: () =>
    apiFetch<{ allow_registration: boolean }>("/auth/registration-open"),

  registerPublic: (email: string, password: string) =>
    apiFetch<{ id: number; email: string; role: string; is_active: boolean }>("/auth/register-public", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    apiFetch<{ access_token: string; token_type: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => apiFetch<{ id: number; email: string; role: string; is_active: boolean }>("/auth/me"),
};

// ── Database Connection API ───────────────────────────────────────────────

export const dbApi = {
  list: () => apiFetch<DBConnection[]>("/databases/"),

  create: (data: DBConnectionCreate) =>
    apiFetch<DBConnection>("/databases/", { method: "POST", body: JSON.stringify(data) }),

  update: (id: number, data: Partial<DBConnectionCreate>) =>
    apiFetch<DBConnection>(`/databases/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: number) =>
    apiFetch<void>(`/databases/${id}`, { method: "DELETE" }),

  test: (id: number) =>
    apiFetch<{ success: boolean; message: string; tables_found: number | null }>(
      `/databases/${id}/test`,
      { method: "POST" }
    ),

  getSchema: (id: number) =>
    apiFetch<{ schema: string }>(`/databases/${id}/schema`),

  updateContext: (id: number, context: string | null) =>
    apiFetch<DBConnection>(`/databases/${id}/context`, { method: "PATCH", body: JSON.stringify({ context_description: context }) }),
};

// ── Conversations API ─────────────────────────────────────────────────────

export const conversationApi = {
  list: () => apiFetch<Conversation[]>("/conversations/"),

  create: (dbConnectionId: number, title?: string) =>
    apiFetch<Conversation>("/conversations/", {
      method: "POST",
      body: JSON.stringify({
        db_connection_id: dbConnectionId,
        title: title || "New Conversation",
      }),
    }),

  get: (id: number) => apiFetch<ConversationDetail>(`/conversations/${id}`),

  delete: (id: number) =>
    apiFetch<void>(`/conversations/${id}`, { method: "DELETE" }),

  updateTitle: (id: number, title: string) =>
    apiFetch<Conversation>(`/conversations/${id}/title?title=${encodeURIComponent(title)}`, {
      method: "PATCH",
    }),

  saveProfile: (id: number, profileId: number | null, modelName: string | null) =>
    apiFetch<Conversation>(`/conversations/${id}/profile`, {
      method: "PATCH",
      body: JSON.stringify({ profile_id: profileId, model_name: modelName }),
    }),
};

// ── Query API (SSE streaming) ─────────────────────────────────────────────

export async function streamQuery(
  question: string,
  conversationId: number,
  dbConnectionId: number,
  onEvent: (event: string, data: unknown) => void,
  onDone: () => void,
  onError: (error: string) => void,
  profileId?: number | null,
  modelName?: string | null,
): Promise<void> {
  const token = getToken();

  const response = await fetch(`${API_BASE}/v1/query/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      question,
      conversation_id: conversationId,
      db_connection_id: dbConnectionId,
      profile_id: profileId ?? null,
      model_name: modelName ?? null,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Stream failed" }));
    onError(err.detail || "Stream failed");
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE format: "event: <name>\ndata: <json>\n\n"
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const chunk of lines) {
      if (!chunk.trim()) continue;

      const eventMatch = chunk.match(/^event: (\w+)/m);
      const dataMatch = chunk.match(/^data: (.+)/ms);

      if (eventMatch && dataMatch) {
        const eventName = eventMatch[1];
        try {
          const data = JSON.parse(dataMatch[1]);
          onEvent(eventName, data);

          if (eventName === "done") {
            onDone();
          } else if (eventName === "error") {
            onError(data.message || "Unknown error");
          }
        } catch {
          console.warn("Failed to parse SSE data:", dataMatch[1]);
        }
      }
    }
  }
}

// ── Admin user management API ─────────────────────────────────────────────

export const adminApi = {
  listUsers: () =>
    apiFetch<{ id: number; email: string; role: string; is_active: boolean }[]>("/auth/users"),

  createUser: (email: string, password: string, role: string) =>
    apiFetch<{ id: number; email: string; role: string; is_active: boolean }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    }),

  updateUser: (id: number, data: { is_active?: boolean; role?: string; password?: string }) =>
    apiFetch<{ id: number; email: string; role: string; is_active: boolean }>(`/auth/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteUser: (id: number) =>
    apiFetch<void>(`/auth/users/${id}`, { method: "DELETE" }),

  getRegistrationSetting: () =>
    apiFetch<{ allow_registration: boolean }>("/auth/registration-open"),

  setRegistrationSetting: (allow: boolean) =>
    apiFetch<{ allow_registration: boolean }>("/auth/settings/registration", {
      method: "PATCH",
      body: JSON.stringify({ allow_registration: allow }),
    }),
};

// ── Ollama status API ─────────────────────────────────────────────────────

export const ollamaApi = {
  status: () =>
    apiFetch<{ available: boolean; model: string; base_url: string }>("/query/ollama/status"),

  updateConfig: (model: string, base_url: string) =>
    apiFetch<{ available: boolean; model: string; base_url: string }>("/query/ollama/config", {
      method: "PATCH",
      body: JSON.stringify({ model, base_url }),
    }),

  pull: (onStatus: (msg: string) => void): Promise<void> => {
    const token = getToken();
    return fetch(`${API_BASE}/v1/query/ollama/pull`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }).then(async (res) => {
      if (!res.ok) throw new Error("Pull request failed");
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          const trimmed = line.replace(/^data:\s*/, "").trim();
          if (trimmed) onStatus(trimmed);
        }
      }
    });
  },
};

// ── Ollama Profile API ────────────────────────────────────────────────────

export const ollamaProfileApi = {
  fetchModels: (host_url: string) =>
    apiFetch<{ models: string[] }>("/ollama-profiles/fetch-models", {
      method: "POST",
      body: JSON.stringify({ host_url }),
    }),

  list: () => apiFetch<OllamaProfile[]>("/ollama-profiles/"),

  create: (data: OllamaProfileCreate) =>
    apiFetch<OllamaProfile>("/ollama-profiles/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: OllamaProfileUpdate) =>
    apiFetch<OllamaProfile>(`/ollama-profiles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    apiFetch<void>(`/ollama-profiles/${id}`, { method: "DELETE" }),

  setActive: (id: number, is_active: boolean) =>
    apiFetch<OllamaProfile>(`/ollama-profiles/${id}/active`, {
      method: "PATCH",
      body: JSON.stringify({ is_active }),
    }),

  listActive: () => apiFetch<OllamaProfile[]>("/ollama-profiles/active"),

  checkAvailability: (id: number) =>
    apiFetch<{ available: boolean; message: string; models: string[] }>(
      `/ollama-profiles/${id}/check-availability`,
      { method: "POST" }
    ),
};
