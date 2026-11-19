"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Banner } from "@/components/ui/bits";
import { loginEmail, type Role } from "@/lib/slots";
import { supabaseBrowser } from "@/lib/supabase/client";

const ROLES: { key: Role; label: string; emoji: string }[] = [
  { key: "officer", label: "Officer", emoji: "🗳️" },
  { key: "student", label: "Student", emoji: "✋" },
];

export function LoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error: authError } = await supabaseBrowser().auth.signInWithPassword({
      email: loginEmail(handle, role),
      password,
    });

    if (authError) {
      setError("That username and password don't match.");
      setBusy(false);
      return;
    }
    router.replace(role === "officer" ? "/officer" : "/student");
    router.refresh();
  }

  return (
    <div className="card p-6">
      <h1 className="text-xl font-bold tracking-tight">Sign in</h1>

      <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-xl bg-sunken p-1.5">
        {ROLES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => { setRole(r.key); setError(null); }}
            aria-pressed={role === r.key}
            className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
              role === r.key ? "bg-surface shadow-[var(--shadow-soft)]" : "text-muted"
            }`}
          >
            <span className="block text-base">{r.emoji}</span>
            {r.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder={role === "officer" ? "CCTIA" : "quietfox"}
          autoCapitalize="none"
          spellCheck={false}
          required
          className="field font-mono"
          aria-label="Username"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="field"
          aria-label="Password"
        />
        {error ? <Banner tone="bad">{error}</Banner> : null}
        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy ? "…" : "Sign in"}
        </button>
      </form>

      {role === "student" ? (
        <p className="mt-4 text-center text-sm text-muted">
          New?{" "}
          <a href="/join" className="font-semibold text-primary">Create an account</a>
        </p>
      ) : null}
    </div>
  );
}
