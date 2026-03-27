"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import FileUpload from "@/components/FileUpload";
import { useAdmin } from "@/components/AdminProvider";
import {
  createQa,
  createTextSnippet,
  crawlWebsitePage,
  crawlWebsite,
  deleteDocument,
  deleteWebsitePage,
  getDocuments,
  getWebsitePages,
  getWebsiteCrawlJob,
  updateDocument,
  updateWebsitePage,
} from "@/lib/api";
import { CrawlJob, KnowledgeDocument, WebsitePage } from "@/lib/types";
import { cachedFetch, invalidate } from "@/lib/client-cache";

type KnowledgeSourceType = "pdf" | "website" | "text_snippet" | "qa";
type KnowledgeWorkspaceProps = { sourceType: KnowledgeSourceType };
type DocumentUpdatePayload = { file_name?: string; content?: string; answer?: string };
const FILE_SOURCE_TYPES = new Set(["pdf", "docx", "pptx", "txt"]);

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function normalizeWebsitePageUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
}

function isValidWebsitePageUrl(value: string) {
  try {
    const parsed = new URL(normalizeWebsitePageUrl(value));
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      Boolean(parsed.hostname) &&
      parsed.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

function upsertDocument(list: KnowledgeDocument[], document: KnowledgeDocument) {
  return [document, ...list.filter((item) => item.id !== document.id)];
}

const SOURCE_META = {
  pdf: {
    addLabel: "Upload file",
    emptyTitle: "No files uploaded",
    emptyDescription: "Upload a PDF, DOCX, PPTX, or TXT file to add it to the knowledge base.",
  },
  website: {
    addLabel: "Crawl website",
    emptyTitle: "No websites crawled",
    emptyDescription: "Paste a URL or sitemap to crawl website content.",
  },
  text_snippet: {
    addLabel: "Add text snippet",
    emptyTitle: "No text snippets",
    emptyDescription: "Add short text pieces the assistant can cite directly.",
  },
  qa: {
    addLabel: "Add Q&A entry",
    emptyTitle: "No Q&A entries",
    emptyDescription: "Add question and answer pairs for reliable retrieval.",
  },
} as const;

export default function KnowledgeWorkspace({ sourceType }: KnowledgeWorkspaceProps) {
  const { agentId } = useParams<{ agentId: string }>();
  const { addToast, refreshAgents, refreshSummary } = useAdmin();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteUrlError, setWebsiteUrlError] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [crawlJob, setCrawlJob] = useState<CrawlJob | null>(null);

  const [snippetTitle, setSnippetTitle] = useState("");
  const [snippetContent, setSnippetContent] = useState("");
  const [snippetSaving, setSnippetSaving] = useState(false);

  const [qaQuestion, setQaQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");
  const [qaSaving, setQaSaving] = useState(false);

  const sourceMeta = SOURCE_META[sourceType];

  const loadDocuments = async (bust = false) => {
    if (bust) invalidate(`documents:${agentId}`);
    const docs = await cachedFetch(`documents:${agentId}`, () => getDocuments(agentId), 30_000);
    setDocuments(docs);
  };

  useEffect(() => {
    if (!agentId) return;
    const load = async () => {
      setLoading(true);
      try { await loadDocuments(); }
      catch (error) { addToast({ title: "Unable to load documents", description: error instanceof Error ? error.message : "Please try again.", variant: "error" }); }
      finally { setLoading(false); }
    };
    void load();
  }, [agentId]);

  useEffect(() => {
    if (!crawlJob || crawlJob.status === "completed" || crawlJob.status === "failed") return;
    const interval = window.setInterval(async () => {
      try {
        const nextJob = await getWebsiteCrawlJob(crawlJob.id);
        setCrawlJob(nextJob);
        if (nextJob.status === "completed") {
          setCrawling(false);
          await refreshKnowledgeStateWithAgents();
          addToast({ title: "Website indexed", description: nextJob.message ?? "Website crawled successfully." });
        } else if (nextJob.status === "failed") {
          setCrawling(false);
          await refreshKnowledgeState();
          addToast({ title: "Crawl failed", description: nextJob.error ?? "Please try again.", variant: "error" });
        }
      } catch (error) {
        window.clearInterval(interval);
        setCrawling(false);
        addToast({ title: "Unable to track crawl", description: error instanceof Error ? error.message : "Please try again.", variant: "error" });
      }
    }, 1200);
    return () => window.clearInterval(interval);
  }, [crawlJob]);

  const visibleDocuments = documents.filter((d) =>
    sourceType === "pdf" ? FILE_SOURCE_TYPES.has(d.source_type) : d.source_type === sourceType
  );

  const refreshKnowledgeState = async () => {
    await loadDocuments(true);   // bust cache — data just changed
    // Only refresh summary (updates doc counts in sidebar) — do NOT call
    // refreshAgents() here because it resets selectedAgentId and wipes
    // in-memory chat state on the Playground page.
    await refreshSummary();
  };

  const refreshKnowledgeStateWithAgents = async () => {
    await loadDocuments(true);   // bust cache — data just changed
    await Promise.all([refreshAgents(), refreshSummary()]);
  };

  const handleWebsiteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextUrl = websiteUrl.trim();
    if (!nextUrl) return;
    if (!isValidWebsitePageUrl(nextUrl)) {
      setWebsiteUrlError("Please enter a valid website URL.");
      return;
    }
    setWebsiteUrlError("");
    setCrawling(true);
    try {
      const job = await crawlWebsite(agentId, nextUrl);
      setCrawlJob(job);
      setWebsiteUrl("");
      setShowForm(false);
      await refreshKnowledgeState();
    } catch (error) {
      setCrawling(false);
      addToast({ title: "Crawl failed", description: error instanceof Error ? error.message : "Please try again.", variant: "error" });
    }
  };

  const handleTextSnippetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!snippetTitle.trim() || !snippetContent.trim() || snippetSaving) return;
    setSnippetSaving(true);
    try {
      await createTextSnippet(agentId, snippetTitle.trim(), snippetContent.trim());
      setSnippetTitle("");
      setSnippetContent("");
      setShowForm(false);
      await refreshKnowledgeState();
      addToast({ title: "Snippet added", description: "Added to the knowledge base." });
    } catch (error) {
      addToast({ title: "Unable to save snippet", description: error instanceof Error ? error.message : "Please try again.", variant: "error" });
    } finally {
      setSnippetSaving(false);
    }
  };

  const handleQaSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!qaQuestion.trim() || !qaAnswer.trim() || qaSaving) return;
    setQaSaving(true);
    try {
      await createQa(agentId, qaQuestion.trim(), qaAnswer.trim());
      setQaQuestion("");
      setQaAnswer("");
      setShowForm(false);
      await refreshKnowledgeState();
      addToast({ title: "Q&A entry added", description: "Added to the knowledge base." });
    } catch (error) {
      addToast({ title: "Unable to save Q&A", description: error instanceof Error ? error.message : "Please try again.", variant: "error" });
    } finally {
      setQaSaving(false);
    }
  };

  const handleUpdateDocument = async (documentId: string, payload: DocumentUpdatePayload) => {
    await updateDocument(agentId, documentId, payload);
    await refreshKnowledgeState();
    addToast({ title: "Updated", description: "Knowledge source updated." });
  };

  const handleDeleteDocument = async (documentId: string, label: string) => {
    await deleteDocument(agentId, documentId);
    await refreshKnowledgeState();
    addToast({ title: "Deleted", description: `${label} removed.` });
  };

  const crawlProgressMax = Math.max(crawlJob?.discovered_pages ?? 0, crawlJob?.indexed_pages ?? 0, 1);
  const crawlProgressPercent = crawlJob ? Math.min(((crawlJob.indexed_pages ?? 0) / crawlProgressMax) * 100, 100) : 0;
  const crawlInProgress = sourceType === "website" && crawlJob !== null && crawlJob.status !== "completed" && crawlJob.status !== "failed";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {loading ? "Loading..." : `${visibleDocuments.length} source${visibleDocuments.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-slate-950 px-3.5 text-xs font-semibold text-white transition hover:bg-slate-800"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
          </svg>
          {sourceMeta.addLabel}
        </button>
      </div>

      {/* Add form — collapsible */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {sourceType === "pdf" && (
            <FileUpload
              agentId={agentId}
              onUploaded={async (document) => {
                setDocuments((current) => upsertDocument(current, document));
                setShowForm(false);
                await refreshKnowledgeStateWithAgents();
              }}
            />
          )}

          {sourceType === "website" && (
            <form className="space-y-3" onSubmit={handleWebsiteSubmit}>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Website URL or sitemap</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => {
                    setWebsiteUrl(e.target.value);
                    if (websiteUrlError) setWebsiteUrlError("");
                  }}
                  placeholder="https://example.com"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                />
                {websiteUrlError && (
                  <p className="mt-1.5 text-xs text-rose-500">{websiteUrlError}</p>
                )}
              </div>
              <p className="text-xs text-slate-500">Crawler stays on the same domain and stores readable text only.</p>

              {crawlInProgress && crawlJob && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{crawlJob.message ?? "Crawling..."}</span>
                    <span>{crawlJob.indexed_pages} / {crawlProgressMax}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                    <div className="h-1.5 rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${crawlProgressPercent}%` }} />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={crawling || !websiteUrl.trim()} className="h-8 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                  {crawling ? "Crawling..." : "Crawl"}
                </button>
              </div>
            </form>
          )}

          {sourceType === "text_snippet" && (
            <form className="space-y-3" onSubmit={handleTextSnippetSubmit}>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Title</label>
                <input
                  type="text"
                  value={snippetTitle}
                  onChange={(e) => setSnippetTitle(e.target.value)}
                  placeholder="e.g. Pricing policy"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Content</label>
                <textarea
                  value={snippetContent}
                  onChange={(e) => setSnippetContent(e.target.value)}
                  rows={5}
                  placeholder="Paste the exact text you want the assistant to use."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={snippetSaving || !snippetTitle.trim() || !snippetContent.trim()} className="h-8 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                  {snippetSaving ? "Saving..." : "Save snippet"}
                </button>
              </div>
            </form>
          )}

          {sourceType === "qa" && (
            <form className="space-y-3" onSubmit={handleQaSubmit}>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Question</label>
                <input
                  type="text"
                  value={qaQuestion}
                  onChange={(e) => setQaQuestion(e.target.value)}
                  placeholder="Who is the founder of Upbuff?"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Answer</label>
                <textarea
                  value={qaAnswer}
                  onChange={(e) => setQaAnswer(e.target.value)}
                  rows={5}
                  placeholder="Enter the exact answer the assistant should retrieve."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={qaSaving || !qaQuestion.trim() || !qaAnswer.trim()} className="h-8 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                  {qaSaving ? "Saving..." : "Save Q&A"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Crawl progress overlay state */}
      {crawlInProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
                <Spinner />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Website Crawl In Progress</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{crawlJob?.message ?? "Crawling website..."}</p>
                <p className="mt-1 truncate text-sm text-slate-500">{crawlJob?.current_url ?? crawlJob?.source_url}</p>
                <div className="mt-5 h-2.5 rounded-full bg-slate-100">
                  <div className="h-2.5 rounded-full bg-slate-950 transition-all duration-500" style={{ width: `${crawlProgressPercent}%` }} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">
                    {crawlJob?.stage === "indexing" ? "Building embeddings" : "Scanning pages"}
                  </span>
                  <span className="font-medium text-slate-700">{crawlJob?.indexed_pages ?? 0} / {crawlProgressMax} pages</span>
                </div>
                <p className="mt-5 text-xs text-slate-400">Please keep this page open while the crawler finishes indexing your website.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-400">Loading...</p>
          </div>
        ) : visibleDocuments.length ? (
          <ul className="divide-y divide-slate-100">
            {visibleDocuments.map((document) => (
              <SourceRow
                  key={document.id}
                  agentId={agentId}
                  document={document}
                  onUpdate={handleUpdateDocument}
                  onDelete={handleDeleteDocument}
                  onRefresh={refreshKnowledgeState}
                  onRecrawl={async (url: string) => {
                    setCrawling(true);
                    try {
                      const job = await crawlWebsite(agentId, url);
                      setCrawlJob(job);
                      await refreshKnowledgeState();
                    } catch (error) {
                      setCrawling(false);
                      addToast({ title: "Re-crawl failed", description: error instanceof Error ? error.message : "Please try again.", variant: "error" });
                    }
                  }}
                />
            ))}
          </ul>
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-slate-600">{sourceMeta.emptyTitle}</p>
            <p className="mt-1 text-xs text-slate-400">{sourceMeta.emptyDescription}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SourceRow({
  agentId,
  document,
  onUpdate,
  onDelete,
  onRefresh,
  onRecrawl,
}: {
  agentId: string;
  document: KnowledgeDocument;
  onUpdate: (id: string, payload: DocumentUpdatePayload) => Promise<void>;
  onDelete: (id: string, label: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onRecrawl?: (url: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [primaryValue, setPrimaryValue] = useState(document.file_name);
  const [contentValue, setContentValue] = useState(document.content ?? "");
  const [answerValue, setAnswerValue] = useState(document.answer ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(document.source_type === "website");
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    setPrimaryValue(document.file_name);
    setContentValue(document.content ?? "");
    setAnswerValue(document.answer ?? "");
    setActionsOpen(false);
  }, [document]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const payload = buildUpdatePayload(document, primaryValue, contentValue, answerValue);
    if (!payload) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onUpdate(document.id, payload);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    if (!window.confirm(`Delete "${document.file_name}" from this knowledge base?`)) return;
    setActionsOpen(false);
    setDeleting(true);
    try {
      await onDelete(document.id, document.file_name);
    } finally {
      setDeleting(false);
    }
  };

  const hasExpandable =
    (document.source_type === "text_snippet" && document.content) ||
    (document.source_type === "qa" && document.answer) ||
    (document.source_type === "website" && document.page_urls?.length);

  return (
    <li className="px-4 py-3">
      {editing ? (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              {document.source_type === "qa" ? "Question" : document.source_type === "text_snippet" ? "Title" : "Name"}
            </label>
            <input
              value={primaryValue}
              onChange={(e) => setPrimaryValue(e.target.value)}
              className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
            />
          </div>
          {document.source_type === "text_snippet" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Content</label>
              <textarea
                value={contentValue}
                onChange={(e) => setContentValue(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>
          )}
          {document.source_type === "qa" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Answer</label>
              <textarea
                value={answerValue}
                onChange={(e) => setAnswerValue(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || isInvalidEdit(document, primaryValue, contentValue, answerValue)}
              className="h-7 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setPrimaryValue(document.file_name);
                setContentValue(document.content ?? "");
                setAnswerValue(document.answer ?? "");
              }}
              className="h-7 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div
            role={hasExpandable ? "button" : undefined}
            tabIndex={hasExpandable ? 0 : undefined}
            onClick={hasExpandable ? () => setExpanded((value) => !value) : undefined}
            onKeyDown={
              hasExpandable
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setExpanded((value) => !value);
                    }
                  }
                : undefined
            }
            className={`flex min-w-0 flex-1 items-start gap-2 rounded-lg ${hasExpandable ? "cursor-pointer hover:bg-slate-50" : ""}`}
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-slate-400">
              {hasExpandable ? (
                <svg viewBox="0 0 16 16" fill="currentColor" className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}>
                  <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              ) : (
                <StatusDot status={document.status} />
              )}
            </span>

            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex items-center gap-2">
                <StatusDot status={document.status} />
                <p className="truncate text-sm font-medium text-slate-900">{document.file_name}</p>
              </div>
              {document.source_url && (
                <p className="mt-1 truncate text-xs text-slate-600">
                  {document.source_url}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-slate-400">{formatDate(document.uploaded_at)}</span>
                {document.source_type === "website" && document.page_count ? (
                  <>
                    <span className="text-slate-200">-</span>
                    <span className="text-xs text-slate-400">{document.page_count} pages</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setActionsOpen((open) => !open)}
              className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              aria-label="Open source actions"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <path d="M8 3.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm0 6a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm0 6a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" />
              </svg>
            </button>
           {actionsOpen && (
              <div className="absolute right-0 top-9 z-10 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false);
                    setEditing(true);
                  }}
                  className="flex w-full rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Edit
                </button>
                {document.source_type === "website" && onRecrawl && (
                  <button
                    type="button"
                    onClick={async () => {
                      setActionsOpen(false);
                      if (!window.confirm(`Re-crawl "${document.file_name}"?`)) return;
                      try {
                        await onDelete(document.id, document.file_name);
                        await onRecrawl(document.source_url ?? document.file_name);
                      } catch {}
                    }}
                    className="flex w-full rounded-md px-3 py-2 text-left text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                  >
                    Re-crawl
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="flex w-full rounded-md px-3 py-2 text-left text-xs font-medium text-rose-500 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!editing && expanded && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-3">
          {document.source_type === "text_snippet" && document.content && (
            <p className="whitespace-pre-wrap text-xs leading-5 text-slate-700">{document.content}</p>
          )}
          {document.source_type === "qa" && document.answer && (
            <p className="whitespace-pre-wrap text-xs leading-5 text-slate-700">{document.answer}</p>
          )}
          {document.source_type === "website" && document.page_urls?.length ? (
            <WebsitePagesManager agentId={agentId} document={document} onChanged={onRefresh} />
          ) : null}
        </div>
      )}
    </li>
  );
}

function WebsitePagesManager({
  agentId,
  document,
  onChanged,
}: {
  agentId: string;
  document: KnowledgeDocument;
  onChanged: () => Promise<void>;
}) {
  const { addToast } = useAdmin();
  const [pages, setPages] = useState<WebsitePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [formUrl, setFormUrl] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formText, setFormText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [pageCrawlJob, setPageCrawlJob] = useState<CrawlJob | null>(null);
  const [pageUrlError, setPageUrlError] = useState("");

  const getCreatePageErrorMessage = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Please try again.";
    const normalized = message.toLowerCase();
    if (
      normalized.includes("field required") ||
      (normalized.includes("title") && normalized.includes("text"))
    ) {
      return "The backend is still using the older page-create route. Restart the backend once, then try crawling the page again.";
    }
    return message;
  };

  const loadPages = async () => {
    setLoading(true);
    try {
      const nextPages = await getWebsitePages(agentId, document.id);
      setPages(nextPages);
    } catch (error) {
      addToast({
        title: "Unable to load crawled pages",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPages();
  }, [agentId, document.id]);

  useEffect(() => {
    if (!pageCrawlJob || pageCrawlJob.status === "completed" || pageCrawlJob.status === "failed") return;
    const interval = window.setInterval(async () => {
      try {
        const nextJob = await getWebsiteCrawlJob(pageCrawlJob.id);
        setPageCrawlJob(nextJob);
        if (nextJob.status === "completed") {
          setSaving(false);
          resetForm();
          await Promise.all([loadPages(), onChanged()]);
          addToast({ title: "Page added", description: nextJob.message ?? "Page crawled and saved successfully." });
        } else if (nextJob.status === "failed") {
          setSaving(false);
          addToast({ title: "Unable to add page", description: nextJob.error ?? "Please try again.", variant: "error" });
        }
      } catch (error) {
        window.clearInterval(interval);
        setSaving(false);
        addToast({
          title: "Unable to track page crawl",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "error",
        });
      }
    }, 1200);
    return () => window.clearInterval(interval);
  }, [pageCrawlJob, agentId, document.id]);

  const resetForm = () => {
    setShowCreate(false);
    setEditingIndex(null);
    setFormUrl("");
    setFormTitle("");
    setFormText("");
    setPageUrlError("");
  };

  const startCreate = () => {
    setShowCreate(true);
    setEditingIndex(null);
    setFormUrl("");
    setFormTitle("");
    setFormText("");
    setPageUrlError("");
  };

  const startEdit = (page: WebsitePage) => {
    setOpenMenuIndex(null);
    setShowCreate(false);
    setEditingIndex(page.index);
    setFormUrl(page.url);
    setFormTitle(page.title);
    setFormText(page.text);
    setPageUrlError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !formUrl.trim()) return;
    if (editingIndex !== null && (!formTitle.trim() || !formText.trim())) return;
    if (!isValidWebsitePageUrl(formUrl)) {
      setPageUrlError("Please enter a valid page URL.");
      return;
    }
    const normalizedUrl = normalizeWebsitePageUrl(formUrl);
    const duplicatePage = pages.find(
      (page) => page.url === normalizedUrl && (editingIndex === null || page.index !== editingIndex),
    );
    if (duplicatePage) {
      setPageUrlError("This page URL has already been crawled.");
      return;
    }
    setPageUrlError("");
    setSaving(true);
    try {
      if (editingIndex !== null) {
        await updateWebsitePage(agentId, document.id, editingIndex, {
          url: normalizedUrl,
          title: formTitle.trim(),
          text: formText.trim(),
        });
        addToast({ title: "Page updated", description: "Website page updated successfully." });
        resetForm();
        await Promise.all([loadPages(), onChanged()]);
      } else {
        const job = await crawlWebsitePage(agentId, document.id, normalizedUrl);
        setPageCrawlJob(job);
      }
    } catch (error) {
      if (editingIndex === null) {
        const message = getCreatePageErrorMessage(error);
        if (
          message.toLowerCase().includes("valid page url") ||
          message.toLowerCase().includes("url is required") ||
          message.toLowerCase().includes("already been crawled") ||
          message.toLowerCase().includes("url")
        ) {
          setPageUrlError(message);
          setSaving(false);
          return;
        }
      }
      addToast({
        title: editingIndex !== null ? "Unable to update page" : "Unable to add page",
        description: editingIndex !== null ? (error instanceof Error ? error.message : "Please try again.") : getCreatePageErrorMessage(error),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (page: WebsitePage) => {
    if (deletingIndex !== null) return;
    if (!window.confirm(`Delete "${page.title}" from this crawled website?`)) return;
    setOpenMenuIndex(null);
    setDeletingIndex(page.index);
    try {
      await deleteWebsitePage(agentId, document.id, page.index);
      addToast({ title: "Page deleted", description: "Website page removed." });
      if (editingIndex === page.index) {
        resetForm();
      }
      await Promise.all([loadPages(), onChanged()]);
    } catch (error) {
      addToast({
        title: "Unable to delete page",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setDeletingIndex(null);
    }
  };

  const pageCrawlProgressMax = Math.max(pageCrawlJob?.discovered_pages ?? 0, pageCrawlJob?.indexed_pages ?? 0, 1);
  const pageCrawlProgressPercent = pageCrawlJob ? Math.min(((pageCrawlJob.indexed_pages ?? 0) / pageCrawlProgressMax) * 100, 100) : 0;
  const pageCrawlInProgress = pageCrawlJob !== null && pageCrawlJob.status !== "completed" && pageCrawlJob.status !== "failed";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Crawled Pages</p>
          <p className="mt-1 text-xs text-slate-500">
            {loading ? "Loading pages..." : `${pages.length} page${pages.length !== 1 ? "s" : ""} available`}
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          disabled={pageCrawlInProgress}
          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-white"
        >
          Add page
        </button>
      </div>

      {(showCreate || editingIndex !== null) && (
        <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Page URL</label>
            <input
              value={formUrl}
              onChange={(event) => {
                setFormUrl(event.target.value);
                if (pageUrlError) setPageUrlError("");
              }}
              className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
            />
            {pageUrlError && (
              <p className="mt-1.5 text-xs text-rose-500">{pageUrlError}</p>
            )}
          </div>
          {editingIndex !== null ? (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Page title</label>
                <input
                  value={formTitle}
                  onChange={(event) => setFormTitle(event.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Page content</label>
                <textarea
                  value={formText}
                  onChange={(event) => setFormText(event.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </div>
            </>
          ) : (
            <p className="text-xs leading-5 text-slate-500">
              Enter a page URL and the system will crawl the page title and content automatically when you create it.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !formUrl.trim() || (editingIndex !== null && (!formTitle.trim() || !formText.trim()))}
              className="h-7 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300"
            >
              {saving ? (editingIndex !== null ? "Saving..." : "Crawling...") : editingIndex !== null ? "Save page" : "Create page"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="h-7 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {loading ? (
          <p className="text-xs text-slate-400">Loading crawled pages...</p>
        ) : pages.length ? (
          pages.map((page) => (
            <div key={`${page.index}-${page.url}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{page.title}</p>
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-xs text-sky-600 hover:underline"
                  >
                    {page.url}
                  </a>
                </div>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setOpenMenuIndex((current) => (current === page.index ? null : page.index))}
                    className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    aria-label="Open page actions"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                      <path d="M8 3.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm0 6a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm0 6a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" />
                    </svg>
                  </button>
                  {openMenuIndex === page.index && (
                    <div className="absolute right-0 top-9 z-10 w-32 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => startEdit(page)}
                        className="flex w-full rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(page)}
                        disabled={deletingIndex === page.index}
                        className="flex w-full rounded-md px-3 py-2 text-left text-xs font-medium text-rose-500 transition hover:bg-rose-50 disabled:opacity-50"
                      >
                        {deletingIndex === page.index ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-slate-400">No crawled pages found for this website yet.</p>
        )}
      </div>

      {pageCrawlInProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
                <Spinner />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Page Crawl In Progress</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{pageCrawlJob?.message ?? "Crawling page..."}</p>
                <p className="mt-1 truncate text-sm text-slate-500">{pageCrawlJob?.current_url ?? pageCrawlJob?.source_url}</p>
                <div className="mt-5 h-2.5 rounded-full bg-slate-100">
                  <div className="h-2.5 rounded-full bg-slate-950 transition-all duration-500" style={{ width: `${pageCrawlProgressPercent}%` }} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">
                    {pageCrawlJob?.stage === "indexing" ? "Indexing page" : "Fetching content"}
                  </span>
                  <span className="font-medium text-slate-700">{pageCrawlJob?.indexed_pages ?? 0} / {pageCrawlProgressMax} pages</span>
                </div>
                <p className="mt-5 text-xs text-slate-400">Please keep this page open while the selected URL is crawled and indexed.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const color =
    normalized === "indexed"
      ? "bg-emerald-400"
      : normalized === "indexing"
        ? "bg-amber-400"
        : "bg-rose-400";
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${color}`} title={status} />;
}

function buildUpdatePayload(document: KnowledgeDocument, primaryValue: string, contentValue: string, answerValue: string): DocumentUpdatePayload | null {
  const nextPrimary = primaryValue.trim();
  const nextContent = contentValue.trim();
  const nextAnswer = answerValue.trim();
  if (document.source_type === "text_snippet") {
    if (!nextPrimary || !nextContent) return null;
    const changed = nextPrimary !== document.file_name || nextContent !== (document.content ?? "").trim();
    return changed ? { file_name: nextPrimary, content: nextContent } : null;
  }
  if (document.source_type === "qa") {
    if (!nextPrimary || !nextAnswer) return null;
    const changed = nextPrimary !== document.file_name || nextAnswer !== (document.answer ?? "").trim();
    return changed ? { file_name: nextPrimary, answer: nextAnswer } : null;
  }
  if (!nextPrimary || nextPrimary === document.file_name) return null;
  return { file_name: nextPrimary };
}

function isInvalidEdit(document: KnowledgeDocument, primaryValue: string, contentValue: string, answerValue: string) {
  if (document.source_type === "text_snippet") return !primaryValue.trim() || !contentValue.trim();
  if (document.source_type === "qa") return !primaryValue.trim() || !answerValue.trim();
  return !primaryValue.trim();
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 animate-spin text-slate-600" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
