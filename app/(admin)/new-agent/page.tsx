"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/components/AdminProvider";

type Tab = "basic" | "content" | "style" | "ai" | "embed";
type Appearance = "light" | "dark";

const TABS: { id: Tab; label: string }[] = [
  { id: "basic",   label: "Basic" },
  { id: "content", label: "Content" },
  { id: "style",   label: "Style" },
  { id: "ai",      label: "AI" },
  { id: "embed",   label: "Embed" },
];

export default function NewAgentPage() {
  const router = useRouter();
  const { createAgentRecord, addToast } = useAdmin();

  const [activeTab,    setActiveTab]    = useState<Tab>("basic");
  const [agentName,    setAgentName]    = useState("");
  const [websiteName,  setWebsiteName]  = useState("");
  const [websiteUrl,   setWebsiteUrl]   = useState("");
  const [appearance,   setAppearance]   = useState<Appearance>("light");
  const [primaryColor, setPrimaryColor] = useState("#0f172a");
  const [saving,       setSaving]       = useState(false);

  const handleSave = async () => {
    const name = agentName.trim();
    if (!name) {
      addToast({ title: "Agent name required", description: "Please enter a name for your agent.", variant: "error" });
      setActiveTab("basic");
      return;
    }
    setSaving(true);
    try {
      const agent = await createAgentRecord(name);
      // Navigate to the real playground for this new agent
      router.replace(`/agents/${agent.id}/chat`);
    } catch (err) {
      addToast({ title: "Failed to create agent", description: err instanceof Error ? err.message : "Please try again.", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const isDark    = appearance === "dark";
  const chatBg    = isDark ? "#0f172a" : "#f8fafc";
  const bubbleBg  = isDark ? "#1e293b" : "#ffffff";
  const bubbleBorder = isDark ? "#334155" : "#e2e8f0";
  const bubbleText   = isDark ? "#f1f5f9" : "#1e293b";
  const dotColor     = isDark ? "rgba(148,163,184,0.12)" : "rgba(203,213,225,0.5)";

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] overflow-hidden">

      {/* Title row */}
      <div className="flex items-center gap-3 mb-3 flex-shrink-0">
        <h1 className="text-base font-semibold text-slate-900">New Agent</h1>
        <span className="text-xs text-slate-400">— fill in the details and save to create</span>
      </div>

      {/* Grid */}
      <div className="flex flex-1 gap-0 overflow-hidden">

        {/* Left panel */}
        <div className="flex w-[400px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white mr-4">
          {/* Tab bar */}
          <div className="flex border-b border-slate-100">
            {TABS.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={["relative flex-1 py-2.5 text-xs font-medium transition",
                  activeTab === tab.id
                    ? "text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-slate-900"
                    : "text-slate-400 hover:text-slate-600"].join(" ")}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

            {activeTab === "basic" && (
              <>
                <Field label="Agent name" hint="Give your agent a name.">
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="e.g. Support Agent"
                    autoFocus
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </Field>
                <Field label="Website name" hint="Your website or business name shown to users.">
                  <input type="text" value={websiteName} onChange={(e) => setWebsiteName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white" />
                </Field>
                <Field label="Website URL" hint="URL where the chat widget will be embedded.">
                  <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://your-website.com"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white" />
                </Field>
              </>
            )}

            {activeTab === "style" && (
              <>
                <Field label="Appearance" hint="Light or dark mode for the chat widget.">
                  <div className="flex gap-3">
                    {(["light","dark"] as Appearance[]).map((v) => (
                      <button key={v} type="button" onClick={() => setAppearance(v)}
                        className={["flex-1 rounded-xl border-2 p-3 text-left transition", appearance === v ? "border-slate-900" : "border-slate-200 hover:border-slate-300"].join(" ")}>
                        <div className={["rounded-lg p-2 space-y-1.5", v === "light" ? "bg-slate-100" : "bg-slate-800"].join(" ")}>
                          <div className={["h-2 w-3/4 rounded-full", v === "light" ? "bg-slate-300" : "bg-slate-600"].join(" ")} />
                          <div className={["h-2 w-1/2 rounded-full ml-auto", v === "light" ? "bg-slate-900" : "bg-blue-500"].join(" ")} />
                        </div>
                        <p className="mt-2 text-xs font-medium text-slate-700 capitalize">{v}</p>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Primary color" hint="Header, user bubbles, send button.">
                  <div className="flex items-center gap-2">
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-9 w-9 cursor-pointer rounded-lg border border-slate-200 p-0.5" />
                    <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-9 w-24 rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-sm outline-none transition focus:border-slate-400" />
                    {["#0f172a","#2563eb","#16a34a","#9333ea","#dc2626"].map((c) => (
                      <button key={c} type="button" onClick={() => setPrimaryColor(c)}
                        className={["h-7 w-7 rounded-full border-2 transition", primaryColor === c ? "border-slate-900 scale-110" : "border-slate-200"].join(" ")}
                        style={{ background: c }} />
                    ))}
                  </div>
                </Field>
              </>
            )}

            {(activeTab === "content" || activeTab === "ai" || activeTab === "embed") && (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200">
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-500">Save your agent first</p>
                  <p className="mt-1 text-xs text-slate-400">You can configure {activeTab} settings after creating the agent.</p>
                </div>
              </div>
            )}

            {/* Save button */}
            {activeTab !== "embed" && (
              <div className="pt-2 border-t border-slate-100">
                <button type="button" onClick={handleSave} disabled={saving}
                  className="w-full h-8 rounded-lg bg-slate-950 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? "Creating agent..." : "Create agent"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right panel: preview */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-4 py-3" style={{ background: primaryColor }}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
                  <path fillRule="evenodd" d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2Zm3.707 6.293a1 1 0 0 0-1.414 0L9 11.586 7.707 10.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4a1 1 0 0 0 0-1.414Z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">{agentName || "New Agent"}</span>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center"
            style={{ backgroundColor: chatBg, backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`, backgroundSize: "20px 20px" }}>
            <div className="text-center px-6">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full flex items-center justify-center" style={{ background: primaryColor }}>
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-white" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: bubbleText }}>Chat preview</p>
              <p className="mt-1 text-xs" style={{ color: isDark ? "#64748b" : "#94a3b8" }}>
                Enter a name and click &quot;Create agent&quot; to get started
              </p>
            </div>
          </div>

          <div className="px-4 py-3" style={{ background: isDark ? "#0f172a" : "#fff", borderTop: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}` }}>
            <div className="flex items-center gap-2 rounded-full px-4 py-2" style={{ border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`, background: isDark ? "#1e293b" : "#f8fafc" }}>
              <input placeholder="Message..." disabled className="flex-1 border-0 bg-transparent text-sm outline-none cursor-not-allowed opacity-50" style={{ color: bubbleText }} />
              <div className="h-7 w-7 rounded-full opacity-40 flex items-center justify-center" style={{ background: primaryColor }}>
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-white">
                  <path fillRule="evenodd" d="M8 2a.75.75 0 0 1 .75.75v8.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.22 3.22V2.75A.75.75 0 0 1 8 2Z" clipRule="evenodd" transform="rotate(-90 8 8)" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
      {children}
    </div>
  );
}