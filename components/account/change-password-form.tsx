"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";

export function ChangePasswordForm({ required = false }: { required?: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (newPassword !== confirm) {
      setError("The two new passwords do not match.");
      return;
    }

    setBusy(true);
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    setBusy(false);

    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "Could not change the password.");
      return;
    }

    setDone(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
  }

  return (
    <form onSubmit={submit} className="cs-card space-y-4 p-5">
      <div>
        <h2 className="text-sm font-bold text-ink">
          {required ? "Choose your own password" : "Change password"}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {required
            ? "Your club was provisioned with a one-time password. Replace it with one only you know."
            : "You will need your current password. Passwords are hashed by Supabase Auth; ClubSync never stores them."}
        </p>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {done ? <Alert tone="success">Password changed.</Alert> : null}

      <div>
        <label htmlFor="current-password" className="cs-label">Current password</label>
        <input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="cs-input"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="next-password" className="cs-label">New password</label>
          <input
            id="next-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            className="cs-input"
          />
        </div>
        <div>
          <label htmlFor="next-password-confirm" className="cs-label">Confirm new password</label>
          <input
            id="next-password-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            className="cs-input"
          />
        </div>
      </div>

      <button type="submit" disabled={busy} className="cs-btn cs-btn-primary">
        {busy ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
