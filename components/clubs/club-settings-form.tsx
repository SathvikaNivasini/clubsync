"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { IconCheck } from "@/components/ui/icons";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CLUB_PALETTE } from "@/lib/viz";
import type { Club } from "@/lib/types";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "UTC",
];

export function ClubSettingsForm({ club }: { club: Club }) {
  const router = useRouter();
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description ?? "");
  const [school, setSchool] = useState(club.school ?? "");
  const [accent, setAccent] = useState(club.accent_color);
  const [timezone, setTimezone] = useState(club.timezone);
  const [joinEnabled, setJoinEnabled] = useState(club.join_enabled);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (name.trim().length < 2) {
      setError("The club needs a name of at least 2 characters.");
      return;
    }

    setBusy(true);
    const { error: updateError } = await supabaseBrowser()
      .from("clubs")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        school: school.trim() || null,
        accent_color: accent,
        timezone,
        join_enabled: joinEnabled,
      })
      .eq("id", club.id);
    setBusy(false);

    if (updateError) {
      setError(
        updateError.message.includes("check constraint")
          ? "One of those values is not allowed — check the name and colour."
          : "Could not save the club settings.",
      );
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="cs-card space-y-4 p-5">
      <div>
        <h2 className="text-sm font-bold text-ink">Club details</h2>
        <p className="mt-1 text-xs text-muted">
          What members see when they join and on their calendar.
        </p>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {saved ? (
        <Alert tone="success">
          <span className="inline-flex items-center gap-1.5">
            <IconCheck size={14} /> Club settings saved.
          </span>
        </Alert>
      ) : null}

      <div>
        <label htmlFor="c-name" className="cs-label">Club name</label>
        <input
          id="c-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          required
          maxLength={80}
          className="cs-input"
        />
      </div>

      <div>
        <label htmlFor="c-school" className="cs-label">
          School <span className="font-normal normal-case tracking-normal">(optional)</span>
        </label>
        <input
          id="c-school"
          value={school}
          onChange={(e) => {
            setSchool(e.target.value);
            setSaved(false);
          }}
          maxLength={120}
          className="cs-input"
        />
      </div>

      <div>
        <label htmlFor="c-description" className="cs-label">
          Description <span className="font-normal normal-case tracking-normal">(optional)</span>
        </label>
        <textarea
          id="c-description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setSaved(false);
          }}
          rows={3}
          maxLength={600}
          placeholder="What the club does, so members know they have the right code."
          className="cs-input resize-y"
        />
      </div>

      <div>
        <span className="cs-label">Calendar colour</span>
        <div className="flex flex-wrap gap-2">
          {CLUB_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                setAccent(color);
                setSaved(false);
              }}
              aria-label={`Use colour ${color}`}
              aria-pressed={accent.toLowerCase() === color.toLowerCase()}
              className={`h-9 w-9 rounded-lg border-2 transition-transform hover:scale-105 ${
                accent.toLowerCase() === color.toLowerCase()
                  ? "border-ink"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">
          These five are checked for colour-blind separation against the dark interface. Members
          always see the club name next to the colour, never the colour alone.
        </p>
      </div>

      <div>
        <label htmlFor="c-timezone" className="cs-label">Timezone</label>
        <select
          id="c-timezone"
          value={timezone}
          onChange={(e) => {
            setTimezone(e.target.value);
            setSaved(false);
          }}
          className="cs-input max-w-sm"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-canvas-deep p-3">
        <input
          type="checkbox"
          checked={joinEnabled}
          onChange={(e) => {
            setJoinEnabled(e.target.checked);
            setSaved(false);
          }}
          className="mt-0.5 h-4 w-4 accent-[#35C6B1]"
        />
        <span className="text-sm text-ink">
          Accept new members with the club code
          <span className="mt-0.5 block text-xs text-muted">
            Uncheck once your roster is set. Existing members keep their access; the code simply
            stops working for new joins.
          </span>
        </span>
      </label>

      <button type="submit" disabled={busy} className="cs-btn cs-btn-primary">
        {busy ? "Saving…" : "Save club settings"}
      </button>
    </form>
  );
}
