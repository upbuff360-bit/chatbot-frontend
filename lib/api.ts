import {
  Agent,
  AgentShareResult,
  AgentSettings,
  AuthResponse,
  ChatResponse,
  ConversationDetail,
  ConversationSummary,
  CrawlJob,
  DashboardSummary,
  InvitationPreview,
  KnowledgeDocument,
  MessageResponse,
  PasswordResetPreview,
  ResolvedPermissions,
  UserSearchResult,
  WebsitePage,
} from "@/lib/types";
import { tokenStorage } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8001";

type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

type RequestOptions = RequestInit & { skipAuth?: boolean };

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const { skipAuth, ...fetchInit } = init ?? {};
  const token = skipAuth ? null : tokenStorage.getToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchInit,
    headers: {
      ...(fetchInit?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      // Attach JWT automatically on every request if available (skipped for public routes)
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchInit?.headers,
    },
  });

  // Token expired or invalid — clear session and redirect to login
  if (response.status === 401) {
    tokenStorage.clear();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string | { msg: string }[] };
      if (typeof payload.detail === "string") {
        detail = payload.detail;
      } else if (Array.isArray(payload.detail)) {
        detail = payload.detail.map((d) => d.msg).join(", ");
      }
    } catch {}
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export function signup(email: string, password: string, inviteToken?: string | null) {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, invite_token: inviteToken ?? null }),
  });
}

export function login(email: string, password: string) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function requestPasswordReset(email: string) {
  return request<MessageResponse>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
    skipAuth: true,
  });
}

export function getPasswordResetPreview(token: string) {
  return request<PasswordResetPreview>(`/auth/password-reset/${token}`, { skipAuth: true });
}

export function resetPassword(token: string, password: string) {
  return request<MessageResponse>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
    skipAuth: true,
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export function getDashboardSummary() {
  return request<DashboardSummary>("/dashboard/summary");
}

export function getMyPermissions() {
  return request<ResolvedPermissions>("/users/me/permissions");
}

// ── Agents ────────────────────────────────────────────────────────────────────
export function getAgents() {
  return request<Agent[]>("/agents");
}

export function createAgent(name: string) {
  return request<Agent>("/agents", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updateAgent(agentId: string, name: string) {
  return request<Agent>(`/agents/${agentId}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export function deleteAgent(agentId: string) {
  return request<void>(`/agents/${agentId}`, { method: "DELETE" });
}

export function getAgent(agentId: string) {
  return request<Agent>(`/agents/${agentId}`);
}

export function searchAgentShareCandidates(agentId: string, query: string) {
  const params = new URLSearchParams({ query });
  return request<UserSearchResult[]>(`/agents/${agentId}/share-candidates?${params.toString()}`);
}

export function shareAgent(agentId: string, userId: string) {
  return request<AgentShareResult>(`/agents/${agentId}/share`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export function inviteAgentByEmail(agentId: string, email: string) {
  return request<AgentShareResult>(`/agents/${agentId}/share`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function getInvitationPreview(token: string) {
  return request<InvitationPreview>(`/auth/invitations/${token}`);
}

// ── Documents ─────────────────────────────────────────────────────────────────
export function getDocuments(agentId: string) {
  return request<KnowledgeDocument[]>(`/agents/${agentId}/documents`, { cache: "no-store" });
}

export function createTextSnippet(agentId: string, title: string, content: string) {
  return request<KnowledgeDocument>(`/agents/${agentId}/text-snippets`, {
    method: "POST",
    body: JSON.stringify({ title, content }),
  });
}

export function createQa(agentId: string, question: string, answer: string) {
  return request<KnowledgeDocument>(`/agents/${agentId}/qa`, {
    method: "POST",
    body: JSON.stringify({ question, answer }),
  });
}

export function updateDocument(
  agentId: string,
  documentId: string,
  payload: { file_name?: string; content?: string; answer?: string },
) {
  return request<KnowledgeDocument>(`/agents/${agentId}/documents/${documentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteDocument(agentId: string, documentId: string) {
  return request<void>(`/agents/${agentId}/documents/${documentId}`, { method: "DELETE" });
}

export function getWebsitePages(agentId: string, documentId: string) {
  return request<WebsitePage[]>(`/agents/${agentId}/documents/${documentId}/website-pages`);
}

export function createWebsitePage(agentId: string, documentId: string, payload: { url: string }) {
  return request<WebsitePage>(`/agents/${agentId}/documents/${documentId}/website-pages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function crawlWebsitePage(agentId: string, documentId: string, url: string) {
  return request<CrawlJob>("/crawl-website-page", {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId, document_id: documentId, url }),
  });
}

export function updateWebsitePage(
  agentId: string,
  documentId: string,
  pageIndex: number,
  payload: { url: string; title: string; text: string },
) {
  return request<WebsitePage>(`/agents/${agentId}/documents/${documentId}/website-pages/${pageIndex}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteWebsitePage(agentId: string, documentId: string, pageIndex: number) {
  return request<void>(`/agents/${agentId}/documents/${documentId}/website-pages/${pageIndex}`, {
    method: "DELETE",
  });
}

export function uploadKnowledgeFile(
  agentId: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void,
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("agent_id", agentId);
  const token = tokenStorage.getToken();

  return new Promise<KnowledgeDocument>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/agents/${agentId}/upload-pdf`);
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.min(Math.round((event.loaded / Math.max(event.total, 1)) * 100), 100),
      });
    };

    xhr.onerror = () => reject(new Error("Upload failed. Please try again."));
    xhr.onload = () => {
      if (xhr.status === 401) {
        tokenStorage.clear();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        reject(new Error("Session expired. Please sign in again."));
        return;
      }

      let payload: unknown = undefined;
      if (xhr.responseText) {
        try {
          payload = JSON.parse(xhr.responseText) as unknown;
        } catch {
          payload = xhr.responseText;
        }
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        let detail = `Request failed with status ${xhr.status}`;
        if (payload && typeof payload === "object" && payload !== null) {
          const errorPayload = payload as { detail?: string | { msg: string }[] };
          if (typeof errorPayload.detail === "string") {
            detail = errorPayload.detail;
          } else if (Array.isArray(errorPayload.detail)) {
            detail = errorPayload.detail.map((d) => d.msg).join(", ");
          }
        }
        reject(new Error(detail));
        return;
      }

      resolve(payload as KnowledgeDocument);
    };

    xhr.send(formData);
  });
}

export function crawlWebsite(agentId: string, url: string) {
  return request<CrawlJob>("/crawl-website", {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId, url }),
  });
}

export function getWebsiteCrawlJob(jobId: string) {
  return request<CrawlJob>(`/crawl-website/${jobId}`);
}

// ── Settings ──────────────────────────────────────────────────────────────────
export function getSettings(agentId: string) {
  return request<AgentSettings>(`/agents/${agentId}/settings`);
}

export function updateSettings(agentId: string, settings: AgentSettings) {
  return request<AgentSettings>(`/agents/${agentId}/settings`, {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export function sendChatMessage(payload: {
  agent_id: string;
  question: string;
  conversation_id?: string | null;
}) {
  return request<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Conversations ─────────────────────────────────────────────────────────────
export function getConversations(agentId: string) {
  return request<ConversationSummary[]>(`/agents/${agentId}/conversations`);
}

export function getConversation(agentId: string, conversationId: string) {
  return request<ConversationDetail>(`/agents/${agentId}/conversations/${conversationId}`);
}

export async function getConversationSummary(agentId: string, conversationId: string) {
  const payload = await request<{ summary?: string | null }>(`/agents/${agentId}/conversations/${conversationId}/summary`);
  return payload.summary ?? null;
}