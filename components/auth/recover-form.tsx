"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { MIN_PASSWORD_LENGTH, memberEmail } from "@/lib/constants";
import { supabaseBrowser } from "@/lib/supabase/client";

export function RecoverForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const name = username.trim().toLowerCase();
    const response = await fetch("/api/auth/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name, phrase, password }),
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "Could not reset the password.");
      setBusy(false);
      return;
    }

    const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({
      email: memberEmail(name),
      password,
    });
    if (signInError) {
      setError("Your password was reset. Sign in with the new one.");
      setBusy(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Recover your account</h1>
        <p className="text-sm leading-relaxed text-muted">
          Enter your username and the twelve-word recovery phrase from when you signed up, then
          choose a new password.
        </p>
      </header>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="r-username" className="cs-label">Username</label>
          <input
            id="r-username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            autoCapitalize="none"
            spellCheck={false}
            required
            className="cs-input font-mono"
          />
        </div>

        <div>
          <label htmlFor="r-phrase" className="cs-label">Recovery phrase</label>
          <textarea
            id="r-phrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            rows={3}
            required
            spellCheck={false}
            placeholder="amber anchor apple arrow aspen atlas autumn badge bamboo basil beacon birch"
            className="cs-input resize-y font-mono text-sm"
          />
          <p className="mt-1.5 text-xs text-muted">
            Capitals and extra spaces do not matter.
          </p>
        </div>

        <div>
          <label htmlFor="r-password" className="cs-label">New password</label>
          <input
            id="r-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            className="cs-input"
          />
        </div>

        <button type="submit" disabled={busy} className="cs-btn cs-btn-primary w-full">
          {busy ? "Checking…" : "Reset password and sign in"}
        </button>
      </form>

      <Alert tone="info" title="If you have lost the phrase too">
        There is no other route in. Because ClubSync holds no email address or phone number for
        you, there is nothing to verify you against. Create a new account and rejoin your clubs
        with their codes — your old availability will simply stop counting.
      </Alert>

      <p className="text-sm text-muted">
        <Link href="/login" className="cs-link font-semibold">Back to sign in</Link>
      </p>
    </div>
  );
}
