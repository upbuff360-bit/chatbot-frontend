"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { tokenStorage } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  logout: () => void;
  setAuthSession: (token: string, user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  // Read auth state synchronously on the client — never reads on SSR (window guard).
  // This eliminates the isLoading:true → false render cycle on every page mount.
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    const token = tokenStorage.getToken();
    const stored = tokenStorage.getUser();
    return token && stored ? stored : null;
  });

  // isLoading is always false — auth state is known synchronously from localStorage.
  // Kept in context API for backward-compatibility with any consumer that reads it.
  const isLoading = false;

  // Route guard — runs after hydration
  useEffect(() => {
    if (isLoading) return;

    const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

    if (!tokenStorage.isLoggedIn() && !isPublic) {
      router.replace("/login");
      return;
    }

    if (tokenStorage.isLoggedIn() && isPublic) {
      router.replace("/dashboard");
    }
  }, [isLoading, pathname, router]);

  const setAuthSession = (token: string, authUser: AuthUser) => {
    tokenStorage.setToken(token);
    tokenStorage.setUser(authUser);
    setUser(authUser);
  };

  const logout = () => {
    tokenStorage.clear();
    setUser(null);
    router.replace("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isLoggedIn: !!user,
        logout,
        setAuthSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}