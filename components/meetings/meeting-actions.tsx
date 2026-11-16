"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconPencil, IconTrash, IconX } from "@/components/ui/icons";

export function MeetingActions({
  meetingId,
  status,
}: {
  meetingId: string;
  status: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "cancelling" | "deleting">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    setBusy(false);
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "That did not work.");
      return;
    }
    setMode("idle");
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/meetings/${meetingId}`, { method: "DELETE" });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    setBusy(false);
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "Could not delete the meeting.");
      return;
    }
    setMode("idle");
    router.refresh();
  }

  if (mode === "cancelling") {
    return (
      <div className="w-full max-w-xs space-y-2 sm:w-64">
        <label htmlFor={`reason-${meetingId}`} className="cs-label">
          Why is it cancelled? <span className="font-normal normal-case">(optional)</span>
        </label>
        <input
          id={`reason-${meetingId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={400}
          placeholder="Snow day"
          className="cs-input py-1.5 text-sm"
        />
        <p className="text-[0.6875rem] leading-relaxed text-muted">
          Every member is notified. The meeting stays on the calendar, struck through.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => patch({ status: "cancelled", cancellationReason: reason })}
            disabled={busy}
            className="cs-btn cs-btn-danger px-2.5 py-1 text-xs"
          >
            {busy ? "Cancelling…" : "Cancel meeting"}
          </button>
          <button
            onClick={() => setMode("idle")}
            className="cs-btn cs-btn-ghost px-2.5 py-1 text-xs"
          >
            Keep it
          </button>
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
    );
  }

  if (mode === "deleting") {
    return (
      <div className="w-full max-w-xs space-y-2 sm:w-56">
        <p className="text-xs leading-relaxed text-muted">
          Delete permanently? Members have already been told it was cancelled; this just removes the
          record.
        </p>
        <div className="flex gap-2">
          <button onClick={remove} disabled={busy} className="cs-btn cs-btn-danger px-2.5 py-1 text-xs">
            {busy ? "Deleting…" : "Delete"}
          </button>
          <button onClick={() => setMode("idle")} className="cs-btn cs-btn-ghost px-2.5 py-1 text-xs">
            Keep
          </button>
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "scheduled" ? (
        <>
          <Link
            href={`/leader/meetings/${meetingId}`}
            className="cs-btn cs-btn-ghost px-2.5 py-1 text-xs"
          >
            <IconPencil size={13} />
            Edit
          </Link>
          <button
            onClick={() => setMode("cancelling")}
            className="cs-btn cs-btn-ghost px-2.5 py-1 text-xs"
          >
            <IconX size={13} />
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => patch({ status: "scheduled", cancellationReason: "" })}
            disabled={busy}
            className="cs-btn cs-btn-ghost px-2.5 py-1 text-xs"
          >
            Reinstate
          </button>
          <button
            onClick={() => setMode("deleting")}
            className="cs-btn cs-btn-ghost px-2.5 py-1 text-xs"
          >
            <IconTrash size={13} />
            Delete
          </button>
        </>
      )}
      {error ? <p className="w-full text-xs text-danger">{error}</p> : null}
    </div>
  );
}
