"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { useAdmin } from "@/components/AdminProvider";
import { getLeads } from "@/lib/api";
import { cachedFetch } from "@/lib/client-cache";
import { Lead } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function displayLeadName(value?: string | null) {
  if (!value) return "Unnamed contact";
  const trimmed = value.trim();
  const beforeContactPhrase = trimmed.split(
    /\b(?:my email is|email is|you can reach me|reach me at|phone is|mobile is|contact me at|from)\b/i,
  )[0] ?? trimmed;
  const beforePunctuation = beforeContactPhrase.split(/[,.!;:\n]/)[0] ?? beforeContactPhrase;
  const cleaned = beforePunctuation.trim();
  if (!cleaned) return "Unnamed contact";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length > 4) {
    return words.slice(0, 4).join(" ");
  }
  return cleaned;
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export default function LeadsPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { addToast } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    if (!agentId) return;

    let cancelled = false;
    setLoading(true);

    void cachedFetch(`leads:${agentId}`, () => getLeads(agentId), 15_000)
      .then((items) => {
        if (!cancelled) setLeads(items);
      })
      .catch((error) => {
        if (!cancelled) {
          addToast({
            title: "Unable to load leads",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "error",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const stats = useMemo(() => {
    const withEmail = leads.filter((lead) => lead.email).length;
    const withPhone = leads.filter((lead) => lead.phone).length;
    const fromWidget = leads.filter((lead) => lead.source === "widget").length;
    return { withEmail, withPhone, fromWidget };
  }, [leads]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Leads</h1>
          <p className="mt-1 text-sm text-slate-500">
            Qualified inquiries and contact details captured from conversations for this agent.
          </p>
        </div>
        <Link
          href={`/agents/${agentId}/chat`}
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
        >
          Open playground
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total leads" value={leads.length} hint="Captured for this agent" />
        <StatCard label="With email" value={stats.withEmail} hint="Ready for email follow-up" />
        <StatCard label="With phone" value={stats.withPhone} hint="Ready for call follow-up" />
        <StatCard label="From widget" value={stats.fromWidget} hint="Captured on embedded chat" />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-semibold text-slate-900">Captured leads</p>
          <p className="mt-1 text-xs text-slate-400">
            {loading ? "Loading leads..." : `${leads.length} lead${leads.length === 1 ? "" : "s"} captured`}
          </p>
        </div>

        {loading ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm text-slate-500">Loading leads...</p>
          </div>
        ) : leads.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {["Contact", "Company", "Interest", "Source", "Captured"].map((heading) => (
                    <th
                      key={heading}
                      className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="align-top">
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-900">{displayLeadName(lead.name)}</p>
                        {lead.email ? <p className="text-xs text-slate-500">{lead.email}</p> : null}
                        {lead.phone ? <p className="text-xs text-slate-500">{lead.phone}</p> : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{lead.company || "—"}</td>
                    <td className="px-5 py-4">
                      <p className="max-w-md text-sm leading-6 text-slate-600">{lead.interest || lead.notes || "—"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-2">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium capitalize text-slate-600">
                          {lead.source}
                        </span>
                        <p className="text-[11px] text-slate-400">Phone leads: {lead.phone ? "Yes" : "No"}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-2">
                        <p className="text-sm text-slate-600">{formatDate(lead.created_at)}</p>
                        <Link
                          href={`/agents/${agentId}/conversations`}
                          className="inline-flex text-xs font-medium text-blue-600 transition hover:text-blue-700"
                        >
                          View conversations
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-medium text-slate-700">No leads captured yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Turn on lead capture in the AI tab, then the assistant can capture shared contact details and qualified inquiries during conversations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
