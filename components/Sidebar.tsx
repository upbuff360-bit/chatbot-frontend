"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

import { useAdmin } from "@/components/AdminProvider";
import { resolveAgentRoute } from "@/lib/agent-routes";

const SECONDARY_ITEMS_DEF = [
  {
    label: "Knowledge",
    href: "knowledge",
    resource: "agents",
    children: [
      { label: "PDF", href: "knowledge/pdfs" },
      { label: "Websites", href: "knowledge/websites" },
      { label: "Text snippets", href: "knowledge/text-snippets" },
      { label: "Q&A", href: "knowledge/qa" },
    ],
  },
  { label: "Playground", href: "chat", resource: "agents" },
  { label: "Conversations", href: "conversations", resource: "agents" },
  { label: "Analytics", href: "analytics", resource: "agents" },
];

type NavItem = { label: string; href: string; icon: () => React.ReactElement };

export default function Sidebar() {
  const pathname = usePathname();
  const { agents, selectedAgentId, permissions, permissionsLoaded, hasAnyForResource } = useAdmin();

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isOwnerOrAbove, setIsOwnerOrAbove] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userPlan, setUserPlan] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const token = localStorage.getItem("chatbot_access_token");
      if (!token) return;

      const payload = JSON.parse(atob(token.split(".")[1]));
      const role = payload?.role ?? "";
      setIsSuperAdmin(role === "super_admin");
      setIsOwnerOrAbove(["super_admin", "owner"].includes(role));
      setUserEmail(payload?.email ?? "");
      setUserName(payload?.name ?? payload?.email?.split("@")[0] ?? "");

      const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";
      const headers = { Authorization: `Bearer ${token}` };

      void fetch(`${base}/users/me/subscription`, { headers })
        .then((response) => {
          if (response.status === 401) {
            localStorage.removeItem("chatbot_access_token");
            window.location.href = "/login";
            return null;
          }
          return response.ok ? response.json() : null;
        })
        .then((data) => {
          if (data?.subscription?.plan_name) setUserPlan(data.subscription.plan_name);
        })
        .catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }

    if (showUserMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showUserMenu]);

  const isWildcard = permissions.includes("*");

  const secondaryItems = SECONDARY_ITEMS_DEF.filter((item) => hasAnyForResource(item.resource));

  const ALL_NAV_ITEMS: (NavItem & {
    resource?: string;
    requireSuperAdmin?: boolean;
    requireOwnerOrAbove?: boolean;
  })[] = [
    { label: "Dashboard", href: "/dashboard", icon: DashboardIcon, resource: "dashboard" },
    { label: "Agents", href: "/agents", icon: AgentsIcon, resource: "agents" },
    { label: "Plans", href: "/plans", icon: PlansIcon, resource: "plans" },
    { label: "Billing", href: "/billing", icon: BillingIcon, resource: "billing" },
    { label: "Chats", href: "/chats", icon: ChatsIcon, resource: "chats" },
    { label: "Roles", href: "/roles", icon: RolesIcon, resource: "roles", requireOwnerOrAbove: true },
    { label: "Users", href: "/users", icon: UsersIcon, resource: "users", requireSuperAdmin: true },
  ];

  const primaryItems: NavItem[] = ALL_NAV_ITEMS.filter((item) => {
    if (item.requireSuperAdmin && !isSuperAdmin) return false;
    if (item.requireOwnerOrAbove && !isOwnerOrAbove) return false;
    if (item.resource) return hasAnyForResource(item.resource);
    return true;
  });

  const routeAgentId = pathname.match(/^\/agents\/([^/]+)/)?.[1] ?? null;
  const activeAgentId = routeAgentId ?? selectedAgentId;
  const selectedAgent = agents.find((agent) => agent.id === activeAgentId) ?? null;
  const showSecondaryNav = routeAgentId !== null && routeAgentId !== "new";

  return (
    <aside className="hidden shrink-0 border-r border-slate-200 bg-white text-slate-900 lg:flex">
      <div className="flex w-[72px] flex-col justify-between border-r border-slate-100 bg-white">
        <div>
          <div className="flex h-14 items-center justify-center border-b border-slate-100">
            <Link href="/dashboard" className="grid h-8 w-8 place-content-center rounded-lg bg-slate-950 text-xs font-bold text-white">
              C
            </Link>
          </div>

          <nav className="px-2 py-3">
            {!permissionsLoaded ? (
              <ul className="space-y-0.5">
                {[1, 2, 3, 4].map((item) => (
                  <li key={item} className="flex flex-col items-center gap-1 rounded-lg px-1 py-2">
                    <div className="h-[18px] w-[18px] animate-pulse rounded bg-slate-100" />
                    <div className="mt-0.5 h-2 w-8 animate-pulse rounded bg-slate-100" />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-0.5">
                {primaryItems.map((item) => {
                  const active = item.href === "/agents"
                    ? pathname === "/agents" || pathname.startsWith("/agents/")
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className={[
                          "flex flex-col items-center gap-1 rounded-lg px-1 py-2 transition",
                          active ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:bg-slate-50 hover:text-slate-700",
                        ].join(" ")}
                      >
                        <Icon />
                        <span className="text-[10px] font-medium leading-none">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
        </div>

        <div className="border-t border-slate-100 p-2.5" ref={menuRef}>
          <div className="relative flex justify-center">
            <button
              type="button"
              onClick={() => setShowUserMenu((value) => !value)}
              className="grid h-8 w-8 place-content-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
              </svg>
            </button>

            {showUserMenu && (
              <div className="absolute bottom-2 left-14 z-50 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold capitalize text-slate-800">{userName}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{userEmail}</p>
                  {userPlan && (
                    <span className="mt-1.5 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {userPlan}
                    </span>
                  )}
                  {isWildcard && (
                    <span className="ml-1.5 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      Full access
                    </span>
                  )}
                </div>

                <Link
                  href="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  Profile
                </Link>

                <div className="mt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      localStorage.removeItem("chatbot_access_token");
                      window.location.href = "/login";
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50"
                  >
                    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSecondaryNav && (
        <div className="flex w-52 flex-col bg-white">
          <div className="border-b border-slate-100 px-4 py-3.5">
            <p className="truncate text-sm font-semibold text-slate-900">{selectedAgent?.name ?? "Agent workspace"}</p>
            <p className="mt-0.5 text-xs text-slate-400">Agent Workspace</p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {activeAgentId && (
              <ul className="space-y-0.5">
                {secondaryItems.map((item) => {
                  const href = resolveAgentRoute(`/${item.href}`, activeAgentId);
                  const active = pathname === href;
                  const childLinks = item.children?.map((child) => {
                    const childHref = resolveAgentRoute(`/${child.href}`, activeAgentId);
                    return { ...child, href: childHref, active: pathname === childHref };
                  }) ?? [];
                  const parentActive = active || childLinks.some((child) => child.active);

                  if (childLinks.length) {
                    return (
                      <li key={item.label}>
                        <details open={parentActive} className="group">
                          <summary
                            className={[
                              "flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition",
                              parentActive ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                            ].join(" ")}
                          >
                            <span>{item.label}</span>
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true">
                              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                            </svg>
                          </summary>
                          <ul className="mt-0.5 space-y-0.5 pl-3">
                            {childLinks.map((child) => (
                              <li key={child.label}>
                                <Link
                                  href={child.href}
                                  className={[
                                    "block rounded-md px-3 py-1.5 text-sm transition",
                                    child.active ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                                  ].join(" ")}
                                >
                                  {child.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </li>
                    );
                  }

                  return (
                    <li key={item.label}>
                      <Link
                        href={href}
                        className={[
                          "block rounded-md px-3 py-2 text-sm font-medium transition",
                          active ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                        ].join(" ")}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function DashboardIcon() { return <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]"><path d="M4 5h7v6H4V5Zm9 0h7v14h-7V5ZM4 13h7v6H4v-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function AgentsIcon() {
  return (
    <svg viewBox="0 0 18 22" fill="none" className="h-[18px] w-[18px]" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5l1.75 4.25L18 9.5l-4.25 1.75L12 15.5l-1.75-4.25L6 9.5l4.25-1.75L12 3.5Z" />
      <path d="M5.5 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" />
    </svg>
  );
}
function UsageIcon() { return <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]"><path d="M4 19h16M7 16l3-5 3 2 4-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function BillingIcon() { return <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]"><path d="M3 7h18M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 6h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function ProfileIcon() { return <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]"><path d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function NotificationsIcon() { return <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function ChatsIcon() { return <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]"><path d="M8 10h8M8 14h5M5 19l-2 2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-3 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function AppSettingsIcon() { return <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="6" r="2" stroke="currentColor" strokeWidth="1.6" /><circle cx="15" cy="12" r="2" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="18" r="2" stroke="currentColor" strokeWidth="1.6" /></svg>; }
function PlansIcon() { return <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function UsersIcon() { return <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function RolesIcon() { return <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]"><path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2ZM4 20a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M17 11v6m-3-3h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>; }
