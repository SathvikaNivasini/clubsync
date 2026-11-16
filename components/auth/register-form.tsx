"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { IconCheck, IconKey, IconShield } from "@/components/ui/icons";
import { MIN_PASSWORD_LENGTH, USERNAME_PATTERN, memberEmail } from "@/lib/constants";
import { supabaseBrowser } from "@/lib/supabase/client";

const SUGGESTIONS = ["quietfox", "bluepanda", "swiftotter", "calmheron", "brightkoi", "mossfinch"];

export function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const name = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(name)) {
      setError("Usernames are 3–20 characters: lowercase letters, numbers and underscores.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name, password }),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      recoveryPhrase?: string;
    };

    if (!response.ok || !payload.ok || !payload.recoveryPhrase) {
      setError(payload.error ?? "Could not create the account.");
      setBusy(false);
      return;
    }

    // Sign in straight away so the member lands on their dashboard.
    const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({
      email: memberEmail(name),
      password,
    });
    if (signInError) {
      setError("The account was created, but signing in failed. Try signing in manually.");
      setBusy(false);
      return;
    }

    setPhrase(payload.recoveryPhrase);
    setBusy(false);
  }

  async function copyPhrase() {
    if (!phrase) return;
    try {
      await navigator.clipboard.writeText(phrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  if (phrase) {
    return (
      <div className="space-y-5">
        <header className="space-y-2">
          <span className="cs-pill border-[#4ed2a659] bg-[#4ed2a614] text-success">
            <IconCheck size={13} /> Account created
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Write down your recovery phrase
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            ClubSync has no email address for you, so there is no reset link we can send. These
            twelve words are the only way back into <strong className="text-ink">{username.trim().toLowerCase()}</strong>{" "}
            if you forget your password.
          </p>
        </header>

        <div className="cs-card space-y-3 p-4">
          <div className="flex items-center gap-2 text-accent">
            <IconKey size={15} />
            <span className="text-xs font-bold uppercase tracking-[0.08em]">Recovery phrase</span>
          </div>
          <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {phrase.split(" ").map((word, index) => (
              <li
                key={`${word}-${index}`}
                className="flex items-baseline gap-1.5 rounded-md border border-line bg-canvas-deep px-2 py-1.5"
              >
                <span className="cs-numeric text-[0.625rem] text-muted-dim">{index + 1}</span>
                <span className="font-mono text-sm text-ink">{word}</span>
              </li>
            ))}
          </ol>
          <button type="button" onClick={copyPhrase} className="cs-btn cs-btn-ghost w-full text-sm">
            {copied ? "Copied to clipboard" : "Copy all twelve words"}
          </button>
        </div>

        <Alert tone="warning" title="This is the only time you will see it">
          We store a one-way hash of the phrase, never the words. Nobody at your school and nobody
          running ClubSync can look it up for you. If you lose it and forget your password, the
          account cannot be recovered and you would need to make a new one and rejoin your clubs.
        </Alert>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-canvas-deep p-3">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#35C6B1]"
          />
          <span className="text-sm text-muted">
            I have written these words down somewhere I can find them.
          </span>
        </label>

        <button
          type="button"
          disabled={!acknowledged}
          onClick={() => {
            router.replace("/join");
            router.refresh();
          }}
          className="cs-btn cs-btn-primary w-full"
        >
          Continue — join your first club
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Create an anonymous account</h1>
        <p className="text-sm leading-relaxed text-muted">
          Make up a username. ClubSync never asks for your real name, email address, phone number
          or student ID — and your club leader only ever sees counts, never who you are.
        </p>
      </header>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="username" className="cs-label">
            Pick a username
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="quietfox"
            className="cs-input font-mono"
            aria-describedby="username-help"
          />
          <p id="username-help" className="mt-1.5 text-xs text-muted">
            3–20 characters, lowercase letters, numbers and underscores. Do not use your real name.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setUsername(s)}
                className="rounded-full border border-line bg-canvas-deep px-2.5 py-1 font-mono text-xs text-muted transition-colors hover:border-primary hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="new-password" className="cs-label">
            Password
          </label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            className="cs-input"
          />
          <p className="mt-1.5 text-xs text-muted">
            At least {MIN_PASSWORD_LENGTH} characters. It is hashed by Supabase Auth — ClubSync
            never sees or stores it.
          </p>
        </div>

        <div>
          <label htmlFor="confirm-password" className="cs-label">
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            className="cs-input"
          />
        </div>

        <button type="submit" disabled={busy} className="cs-btn cs-btn-primary w-full">
          {busy ? "Creating your account…" : "Create account"}
        </button>
      </form>

      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-canvas-deep p-3">
        <IconShield size={16} className="mt-0.5 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-muted">
          Anonymous here means pseudonymous: there is no name or contact detail attached to this
          account, but hosting infrastructure still processes technical data like IP addresses.{" "}
          <Link href="/privacy" className="cs-link">
            Read exactly what is stored
          </Link>
          .
        </p>
      </div>

      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="cs-link font-semibold">
          Sign in
        </Link>
      </p>
    </div>
  );
}
