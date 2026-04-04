"use client";

import {
  createContext,
  ReactNode,
  startTransition,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  createAgent,
  deleteAgent,
  getAgents,
  getConversations,
  getDashboardSummary,
  getDocuments,
  getMyPermissions,
  getSettings,
  updateAgent,
} from "@/lib/api";
import { resolveAgentRoute } from "@/lib/agent-routes";
import { Agent, DashboardSummary } from "@/lib/types";
import { tokenStorage } from "@/lib/auth";
import { cachedFetch } from "@/lib/client-cache";
import { hasAnyPermissionForResource, hasPermission } from "@/lib/permissions";

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: "success" | "error";
};

type AdminContextValue = {
  agents: Agent[];
  summary: DashboardSummary | null;
  selectedAgentId: string | null;
  permissions: string[];
  permissionsLoaded: boolean;
  loading: boolean;
  toasts: Toast[];
  setSelectedAgentId: (agentId: string | null) => void;
  hasAnyForResource: (resource: string) => boolean;
  hasPermission: (permission: string) => boolean;
  refreshPermissions: () => Promise<string[]>;
  refreshAgents: () => Promise<void>;
  refreshSummary: () => Promise<void>;
  createAgentRecord: (name: string) => Promise<Agent>;
  updateAgentRecord: (agentId: string, name: string) => Promise<Agent>;
  deleteAgentRecord: (agentId: string) => Promise<void>;
  addToast: (toast: Omit<Toast, "id">) => void;
};

const AdminContext = createContext<AdminContextValue | null>(null);

function extractAgentId(pathname: string) {
  const match = pathname.match(/^\/agents\/([^/]+)/);
  return match?.[1] ?? null;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [agents, setAgents]               = useState<Agent[]>([]);
  const [summary, setSummary]             = useState<DashboardSummary | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [permissions, setPermissions]     = useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [loading, setLoading]             = useState(true);
  const [toasts, setToasts]               = useState<Toast[]>([]);

  useEffect(() => {
    const agentIdFromRoute = extractAgentId(pathname);
    if (agentIdFromRoute) { setSelectedAgentId(agentIdFromRoute); return; }
    const persisted = window.localStorage.getItem("selectedAgentId");
    if (!selectedAgentId && persisted) setSelectedAgentId(persisted);
  }, [pathname, selectedAgentId]);

  useEffect(() => {
    if (selectedAgentId) window.localStorage.setItem("selectedAgentId", selectedAgentId);
  }, [selectedAgentId]);

  const warmCache = <T,>(key: string, fetcher: () => Promise<T>, ttlMs: number) => {
    void cachedFetch(key, fetcher, ttlMs).catch(() => undefined);
  };

  const refreshPermissions = async () => {
    if (!tokenStorage.isLoggedIn()) {
      setPermissions([]);
      setPermissionsLoaded(true);
      return [];
    }
    const { permissions: nextPermissions } = await getMyPermissions();
    setPermissions(nextPermissions);
    setPermissionsLoaded(true);
    return nextPermissions;
  };

  useEffect(() => {
    // Guard: skip API calls until a token exists — prevents 401 loops
    if (!tokenStorage.isLoggedIn()) {
      setPermissions([]);
      setPermissionsLoaded(true);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const hydrate = async () => {
      try {
        const nextPermissions = await refreshPermissions();
        if (!isMounted) return;

        const canReadAgents = hasAnyPermissionForResource(nextPermissions, "agents");
        const canReadChats = hasAnyPermissionForResource(nextPermissions, "chats");
        const canReadLeads = hasAnyPermissionForResource(nextPermissions, "leads");
        const canReadDashboard = hasAnyPermissionForResource(nextPermissions, "dashboard");
        const canLoadAgentDirectory = canReadAgents || canReadChats || canReadLeads;

        const [nextAgents, nextSummary] = await Promise.all([
          canLoadAgentDirectory ? getAgents() : Promise.resolve([]),
          canReadDashboard ? getDashboardSummary() : Promise.resolve(null),
        ]);
        if (!isMounted) return;
        setAgents(nextAgents);
        setSummary(nextSummary);
        const resolvedId = (() => {
          const current = window.localStorage.getItem("selectedAgentId");
          if (current && nextAgents.some((a) => a.id === current)) return current;
          return nextAgents[0]?.id ?? null;
        })();
        setSelectedAgentId(resolvedId);

        // Eagerly warm the cache for the most-visited pages of the active agent.
        // These run in the background — they don't block rendering.
        if (resolvedId) {
          if (canReadAgents) {
            warmCache(`documents:${resolvedId}`, () => getDocuments(resolvedId), 30_000);
          }
          if (canReadAgents) {
            warmCache(`settings:${resolvedId}`, () => getSettings(resolvedId), 60_000);
          }
          if (canReadAgents || canReadChats) {
            warmCache(`conversations:${resolvedId}`, () => getConversations(resolvedId), 30_000);
          }
        }
      } catch (error) {
        if (!isMounted) return;
        setPermissions([]);
        setPermissionsLoaded(true);
        if (!(error instanceof Error && error.message.includes("Session expired"))) {
          addToast({
            title: "Unable to load admin data",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "error",
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void hydrate();
    return () => { isMounted = false; };
  }, []);

  const addToast = ({ title, description, variant = "success" }: Omit<Toast, "id">) => {
    const toast = { id: crypto.randomUUID(), title, description, variant };
    setToasts((c) => [...c, toast]);
    window.setTimeout(() => setToasts((c) => c.filter((t) => t.id !== toast.id)), 3500);
  };

  const hasAnyForResource = (resource: string) => {
    if (!permissionsLoaded) return true;
    return hasAnyPermissionForResource(permissions, resource);
  };

  const hasNamedPermission = (permission: string) => {
    if (!permissionsLoaded) return true;
    return hasPermission(permissions, permission);
  };

  const refreshAgents = async () => {
    if (!tokenStorage.isLoggedIn()) return;
    const canReadAgents = hasAnyPermissionForResource(permissions, "agents");
    const canReadChats = hasAnyPermissionForResource(permissions, "chats");
    const canReadLeads = hasAnyPermissionForResource(permissions, "leads");
    if (!canReadAgents && !canReadChats && !canReadLeads) {
      setAgents([]);
      setSelectedAgentId(null);
      return;
    }
    const nextAgents = await getAgents();
    setAgents(nextAgents);
    setSelectedAgentId((current) => {
      if (current && nextAgents.some((a) => a.id === current)) return current;
      return nextAgents[0]?.id ?? null;
    });
  };

  const refreshSummary = async () => {
    if (!tokenStorage.isLoggedIn()) return;
    const nextSummary = await getDashboardSummary();
    setSummary(nextSummary);
  };

  const createAgentRecord = async (name: string) => {
    const agent = await createAgent(name);
    await Promise.all([refreshAgents(), refreshSummary()]);
    setSelectedAgentId(agent.id);
    addToast({ title: "Agent created", description: `${agent.name} is ready for setup.` });
    startTransition(() => router.push(`/agents/${agent.id}/knowledge`));
    return agent;
  };

  const updateAgentRecord = async (agentId: string, name: string) => {
    const agent = await updateAgent(agentId, name);
    await Promise.all([refreshAgents(), refreshSummary()]);
    addToast({ title: "Agent updated", description: `${agent.name} is ready.` });
    return agent;
  };

  const deleteAgentRecord = async (agentId: string) => {
    const deletedAgent = agents.find((a) => a.id === agentId);
    await deleteAgent(agentId);
    await Promise.all([refreshAgents(), refreshSummary()]);
    addToast({
      title: "Agent deleted",
      description: deletedAgent ? `${deletedAgent.name} was removed.` : "Agent removed.",
    });
    const remainingAgent = agents.find((a) => a.id !== agentId);
    if (extractAgentId(pathname) === agentId) {
      startTransition(() =>
        router.push(remainingAgent ? resolveAgentRoute(pathname, remainingAgent.id) : "/agents")
      );
    }
  };

  return (
    <AdminContext.Provider
      value={{
        agents, summary, selectedAgentId, permissions, permissionsLoaded, loading, toasts,
        setSelectedAgentId, hasAnyForResource, hasPermission: hasNamedPermission, refreshPermissions, refreshAgents, refreshSummary,
        createAgentRecord, updateAgentRecord, deleteAgentRecord, addToast,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdmin must be used within AdminProvider.");
  return context;
}
