"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { IconArrowRight, IconCheck, IconUsers } from "@/components/ui/icons";
import { CLUB_CODE_PATTERN } from "@/lib/constants";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { ClubLookup } from "@/lib/types";

export function JoinClubForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [found, setFound] = useState<ClubLookup | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState<{ name: string; number: number } | null>(null);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFound(null);
    setChecked(false);

    const normalized = code.trim().toUpperCase();
    if (!CLUB_CODE_PATTERN.test(normalized)) {
      setError("Club codes are 3–16 characters: capital letters, numbers and hyphens.");
      return;
    }

    setBusy(true);
    const { data, error: rpcError } = await supabaseBrowser().rpc("lookup_club_by_code", {
      p_code: normalized,
    });
    setBusy(false);
    setChecked(true);

    if (rpcError) {
      setError("Could not check that code. Check your connection and try again.");
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;
    setFound(row as ClubLookup);
  }

  async function join() {
    if (!found) return;
    setBusy(true);
    setError(null);

    const response = await fetch("/api/clubs/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: found.code }),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      clubName?: string;
      memberNumber?: number;
    };
    setBusy(false);

    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "Could not join that club.");
      return;
    }

    setJoined({ name: payload.clubName ?? found.name, number: payload.memberNumber ?? 0 });
    router.refresh();
  }

  if (joined) {
    return (
      <div className="space-y-5">
        <Alert tone="success" title={`You're in — ${joined.name}`}>
          You are <strong>Member #{joined.number}</strong> in this club. That number is how the
          club counts you; it is not shown to your leader next to anything you submit.
        </Alert>
        <div className="flex flex-wrap gap-3">
          <a href="/availability" className="cs-btn cs-btn-primary">
            Set my availability
            <IconArrowRight size={16} />
          </a>
          <button
            type="button"
            onClick={() => {
              setJoined(null);
              setFound(null);
              setChecked(false);
              setCode("");
            }}
            className="cs-btn cs-btn-ghost"
          >
            Join another club
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form onSubmit={lookup} className="cs-card space-y-4 p-5">
        <div>
          <label htmlFor="club-code" className="cs-label">Club code</label>
          <input
            id="club-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setChecked(false);
              setFound(null);
            }}
            placeholder="CCTIA"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            required
            className="cs-input font-mono text-lg tracking-[0.12em]"
          />
          <p className="mt-1.5 text-xs text-muted">
            Your club leader shares this. ClubSync has no public club directory — the code is what
            grants access, so keep it within the club.
          </p>
        </div>
        <button type="submit" disabled={busy} className="cs-btn cs-btn-primary w-full">
          {busy ? "Checking…" : "Find my club"}
        </button>
      </form>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {checked && !found && !error ? (
        <Alert tone="warning" title="No club uses that code">
          Double-check the spelling with whoever runs your club. Codes are not case sensitive, but
          every character has to match.
        </Alert>
      ) : null}

      {found ? (
        <div className="cs-card space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 h-10 w-10 shrink-0 rounded-xl"
              style={{
                backgroundColor: `${found.accent_color}26`,
                border: `1px solid ${found.accent_color}66`,
              }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold tracking-tight text-ink">{found.name}</h2>
              <p className="font-mono text-xs text-muted">{found.code}</p>
              {found.school ? <p className="mt-0.5 text-sm text-muted">{found.school}</p> : null}
            </div>
          </div>

          {found.description ? (
            <p className="text-sm leading-relaxed text-muted">{found.description}</p>
          ) : null}

          <p className="flex items-center gap-2 text-sm text-muted">
            <IconUsers size={15} className="text-muted-dim" />
            {found.member_count} {found.member_count === 1 ? "member" : "members"} already joined
          </p>

          {found.already_member ? (
            <Alert tone="info" title="You are already a member">
              Nothing to do here.{" "}
              <a href="/availability" className="cs-link font-semibold">Update your availability</a>{" "}
              instead.
            </Alert>
          ) : (
            <button onClick={join} disabled={busy} className="cs-btn cs-btn-primary w-full">
              <IconCheck size={16} />
              {busy ? "Joining…" : `Join ${found.name}`}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
