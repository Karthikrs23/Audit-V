/**
 * authApi.ts — Typed API calls for user auth and personal-space endpoints.
 */

const API_HOST =
  typeof window !== "undefined" && window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000"
    : "http://localhost:8000";

const BASE = `${API_HOST}/api/v1`;

export interface UserOut {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface ChatMessageOut {
  id: number;
  role: string;
  content: string;
  timestamp: string;
}

export interface FinancialEntryOut {
  id: number;
  category: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserSettingsOut {
  api_url: string;
  hf_model: string;
  hf_adapter: string;
  similarity_threshold: string;
}

export interface UserDocumentOut {
  id: number;
  filename: string;
  file_type: string | null;
  notes: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("audit_v_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function apiRegister(payload: {
  username: string;
  email: string;
  full_name?: string;
  password: string;
}): Promise<Token> {
  const res = await fetch(`${BASE}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<Token>(res);
}

export async function apiLogin(username: string, password: string): Promise<Token> {
  const res = await fetch(`${BASE}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse<Token>(res);
}

export async function apiGetMe(): Promise<UserOut> {
  const res = await fetch(`${BASE}/users/me`, { headers: authHeaders() });
  return handleResponse<UserOut>(res);
}

// ─── Chat History ─────────────────────────────────────────────────────────────

export async function apiGetChatHistory(limit = 100): Promise<ChatMessageOut[]> {
  const res = await fetch(`${BASE}/users/me/chat?limit=${limit}`, { headers: authHeaders() });
  return handleResponse<ChatMessageOut[]>(res);
}

export async function apiSaveChatMessage(role: string, content: string): Promise<ChatMessageOut> {
  const res = await fetch(`${BASE}/users/me/chat`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ role, content }),
  });
  return handleResponse<ChatMessageOut>(res);
}

export async function apiClearChatHistory(): Promise<void> {
  await fetch(`${BASE}/users/me/chat`, { method: "DELETE", headers: authHeaders() });
}

// ─── Financial Entries ────────────────────────────────────────────────────────

export async function apiGetFinancialEntries(category?: string): Promise<FinancialEntryOut[]> {
  const url = `${BASE}/users/me/financial${category ? `?category=${category}` : ""}`;
  const res = await fetch(url, { headers: authHeaders() });
  return handleResponse<FinancialEntryOut[]>(res);
}

export async function apiSaveFinancialEntry(
  category: string,
  data: Record<string, unknown>
): Promise<FinancialEntryOut> {
  const res = await fetch(`${BASE}/users/me/financial`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ category, data }),
  });
  return handleResponse<FinancialEntryOut>(res);
}

export async function apiDeleteFinancialEntry(id: number): Promise<void> {
  await fetch(`${BASE}/users/me/financial/${id}`, { method: "DELETE", headers: authHeaders() });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function apiGetUserSettings(): Promise<UserSettingsOut> {
  const res = await fetch(`${BASE}/users/me/settings`, { headers: authHeaders() });
  return handleResponse<UserSettingsOut>(res);
}

export async function apiUpdateUserSettings(
  patch: Partial<UserSettingsOut>
): Promise<UserSettingsOut> {
  const res = await fetch(`${BASE}/users/me/settings`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  return handleResponse<UserSettingsOut>(res);
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function apiGetDocuments(): Promise<UserDocumentOut[]> {
  const res = await fetch(`${BASE}/users/me/documents`, { headers: authHeaders() });
  return handleResponse<UserDocumentOut[]>(res);
}

export async function apiAddDocument(payload: {
  filename: string;
  file_type?: string;
  notes?: string;
}): Promise<UserDocumentOut> {
  const res = await fetch(`${BASE}/users/me/documents`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<UserDocumentOut>(res);
}

export async function apiDeleteDocument(id: number): Promise<void> {
  await fetch(`${BASE}/users/me/documents/${id}`, { method: "DELETE", headers: authHeaders() });
}

