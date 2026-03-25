"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { getInvitationPreview, signup } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

export default function RegisterPage() {
  const router             = useRouter();
  const searchParams       = useSearchParams();
  const { setAuthSession } = useAuth();
  const inviteToken        = searchParams.get("invite_token");

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ email: string; agent_name: string; inviter_email?: string | null } | null>(null);

  useEffect(() => {
    if (!inviteToken) {
      setInviteInfo(null);
      return;
    }

    let cancelled = false;
    setInviteLoading(true);
    void getInvitationPreview(inviteToken)
      .then((preview) => {
        if (cancelled) return;
        setInviteInfo(preview);
        setEmail(preview.email);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setInviteInfo(null);
        setError(err instanceof Error ? err.message : "This invite is invalid or has expired.");
      })
      .finally(() => {
        if (!cancelled) setInviteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (inviteLoading)     { setError("Checking your invite. Please wait a moment."); return; }
    if (!email.trim())      { setError("Email is required."); return; }
    if (password.length < 8){ setError("Password must be at least 8 characters."); return; }
    if (password !== confirm){ setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const data = await signup(email.trim(), password, inviteToken);
      setAuthSession(data.access_token, data.user);
      setSuccess(true);
      setTimeout(() => router.replace("/dashboard"), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="h-8 w-8 rounded-lg bg-slate-950 grid place-content-center text-white text-xs font-bold">C</div>
          <span className="text-sm font-semibold text-slate-900">Chatbot SaaS</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-7 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">{inviteInfo ? "Accept your invite" : "Create an account"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {inviteInfo ? `Create your account to access ${inviteInfo.agent_name}.` : "Start building your chatbot agents"}
          </p>

          {inviteInfo && (
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sm text-sky-800">
              {inviteInfo.inviter_email ? `${inviteInfo.inviter_email} invited you to access ${inviteInfo.agent_name}.` : `You were invited to access ${inviteInfo.agent_name}.`}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
              Account created! Redirecting...
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                readOnly={!!inviteInfo}
                className={[
                  "h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none transition",
                  inviteInfo
                    ? "bg-slate-100 cursor-not-allowed"
                    : "bg-slate-50 focus:border-slate-400 focus:bg-white",
                ].join(" ")}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Password <span className="font-normal text-slate-400">(min 8 chars)</span>
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading || success || inviteLoading}
              className="w-full h-9 rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Spinner />}
              {loading ? "Creating account..." : inviteInfo ? "Create account and accept invite" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-slate-900 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6Z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M3 3l14 14M8.5 8.6A2.5 2.5 0 0 0 12.4 12.5M6.5 5.6C4.5 6.9 3 9 3 9s2.5 5 7 5c1.4 0 2.6-.4 3.6-1M11 4.2C10.7 4.1 10.4 4 10 4 5.5 4 3 9 3 9s.7 1.4 2 2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
