"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Banner } from "@/components/ui/bits";
import { MIN_PASSWORD, loginEmail } from "@/lib/slots";
import { supabaseBrowser } from "@/lib/supabase/client";

export function JoinForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, code }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !payload.ok) {
      setError(payload.error ?? "Could not sign up.");
      setBusy(false);
      return;
    }

    const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({
      email: loginEmail(username, "student"),
      password,
    });
    setBusy(false);
    if (signInError) { setError("Account made — now sign in."); return; }
    router.replace("/student");
    router.refresh();
  }

  return (
    <div className="card p-6">
      <h1 className="text-xl font-bold tracking-tight">Create an account</h1>
      <p className="mt-1 text-sm text-muted">Make up a username. No email, no real name.</p>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder="quietfox"
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
          placeholder={`Password (${MIN_PASSWORD}+ characters)`}
          required
          minLength={MIN_PASSWORD}
          className="field"
          aria-label="Password"
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Club code"
          autoCapitalize="characters"
          spellCheck={false}
          required
          className="field font-mono tracking-widest"
          aria-label="Club code"
        />
        {error ? <Banner tone="bad">{error}</Banner> : null}
        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy ? "…" : "Join"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        Have an account? <a href="/login" className="font-semibold text-primary">Sign in</a>
      </p>
    </div>
  );
}
