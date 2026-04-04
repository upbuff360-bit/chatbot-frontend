export type Activity = {
  id: string;
  type: string;
  agent_id: string;
  description: string;
  timestamp: string;
};

export type DashboardSummary = {
  total_agents: number;
  total_documents: number;
  total_conversations: number;
  recent_activity: Activity[];
};

export type ResolvedPermissions = {
  permissions: string[];
  role: string;
};

export type Agent = {
  id: string;
  display_id?: string;
  name: string;
  created_at: string;
  document_count: number;
  conversation_count: number;
  can_manage?: boolean;
  is_shared?: boolean;
};

export type UserSearchResult = {
  id: string;
  email: string;
  name?: string | null;
};

export type AgentShareResult = {
  mode: "shared" | "invited";
  email: string;
  user_id?: string | null;
  message: string;
};

export type KnowledgeDocument = {
  id: string;
  file_name: string;
  uploaded_at: string;
  status: string;
  source_type: "pdf" | "website" | "text_snippet" | "qa" | string;
  source_url?: string | null;
  content?: string | null;
  question?: string | null;
  answer?: string | null;
  page_count?: number | null;
  page_urls?: string[] | null;
};

export type WebsitePage = {
  index: number;
  url: string;
  title: string;
  text: string;
};

export type AgentSettings = {
  system_prompt: string;
  temperature: number;
  welcome_message: string;
  display_name: string;
  website_name: string;
  website_url: string;
  primary_color: string;
  secondary_color: string;
  appearance: string;
  lead_capture_enabled: boolean;
};

export type PublicWidgetSettings = {
  display_name: string;
  welcome_message: string;
  primary_color: string;
  appearance: string;
  suggestions?: string[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  suggestions?: string[];
};

export type ConversationSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
};

export type ConversationDetail = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
};

export type Lead = {
  id: string;
  conversation_id: string;
  source: "chat" | "widget";
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  interest?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatResponse = {
  answer: string;
  conversation_id: string;
  suggestions?: string[];
};

export type CrawlJob = {
  id: string;
  agent_id: string;
  source_url: string;
  status: "queued" | "running" | "completed" | "failed" | string;
  stage: "queued" | "crawling" | "indexing" | "completed" | "failed" | string;
  discovered_pages: number;
  indexed_pages: number;
  current_url?: string | null;
  message?: string | null;
  error?: string | null;
  document_id?: string | null;
  document_name?: string | null;
  source_type: "website" | string;
};

// ── Auth types ────────────────────────────────────────────────────────────────
export type UserRole = "customer";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  tenant_id: string;
  plan: string;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export type InvitationPreview = {
  email: string;
  agent_name: string;
  inviter_email?: string | null;
};

export type MessageResponse = {
  message: string;
};

export type PasswordResetPreview = {
  email: string;
};
