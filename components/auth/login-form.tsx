"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { adminEmail, memberEmail } from "@/lib/constants";
import { supabaseBrowser } from "@/lib/supabase/client";

type Role = "member" | "leader";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole: Role = params.get("role") === "leader" ? "leader" : "member";
  const next = params.get("next");

  const [role, setRole] = useState<Role>(initialRole);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const trimmed = identifier.trim();
    if (!trimmed || !password) {
      setError("Enter both fields to sign in.");
      setBusy(false);
      return;
    }

    const email = role === "member" ? memberEmail(trimmed) : adminEmail(trimmed);
    const { error: authError } = await supabaseBrowser().auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(
        role === "member"
          ? "That username and password do not match an account."
          : "That club login and password do not match an account.",
      );
      setBusy(false);
      return;
    }

    const fallback = role === "leader" ? "/leader" : "/dashboard";
    // Only accept same-origin relative paths from the query string.
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
    router.replace(target);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Sign in to ClubSync</h1>
        <p className="text-sm leading-relaxed text-muted">
          Members sign in with the username they made up. Club leaders use the login their school
          issued for the club.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Account type"
        className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-canvas-deep p-1"
      >
        {(["member", "leader"] as Role[]).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={role === value}
            onClick={() => {
              setRole(value);
              setError(null);
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              role === value ? "bg-surface-raised text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {value === "member" ? "I'm a member" : "I lead a club"}
          </button>
        ))}
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="identifier" className="cs-label">
            {role === "member" ? "Username" : "Club login"}
          </label>
          <input
            id="identifier"
            name="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder={role === "member" ? "quietfox" : "CCTIA"}
            className="cs-input font-mono"
          />
        </div>

        <div>
          <label htmlFor="password" className="cs-label">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="cs-input"
          />
        </div>

        <button type="submit" disabled={busy} className="cs-btn cs-btn-primary w-full">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="cs-divider" />

      <div className="space-y-2 text-sm">
        {role === "member" ? (
          <>
            <p className="text-muted">
              No account yet?{" "}
              <Link href="/register" className="cs-link font-semibold">
                Create an anonymous one
              </Link>
            </p>
            <p className="text-muted">
              Lost your password?{" "}
              <Link href="/recover" className="cs-link font-semibold">
                Use your recovery phrase
              </Link>
            </p>
          </>
        ) : (
          <p className="text-muted">
            Club logins are issued per club, not self-registered. If you do not have one, ask
            whoever administers ClubSync at your school to provision your club.
          </p>
        )}
      </div>
    </div>
  );
}
