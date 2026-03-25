"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Knowledge", href: "knowledge" },
  { label: "Chat", href: "chat" },
  { label: "Conversations", href: "conversations" },
  { label: "Settings", href: "settings" },
];

export default function AgentTabs({ agentId }: { agentId: string }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 w-fit">
      {tabs.map((tab) => {
        const href = `/agents/${agentId}/${tab.href}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={tab.label}
            href={href}
            className={[
              "rounded-md px-3 py-1.5 text-xs font-medium transition",
              active
                ? "bg-slate-950 text-white"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
