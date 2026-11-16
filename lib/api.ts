import "server-only";

import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function jsonOk<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function asString(value: unknown, max = 500): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * Supabase error messages can leak schema details, so client-facing errors are
 * mapped to short, human sentences. The original is logged server-side only.
 */
export function friendlyDbError(error: { message?: string; code?: string } | null): string {
  const message = error?.message ?? "";
  if (/duplicate key/i.test(message)) return "That already exists.";
  if (/violates check constraint/i.test(message)) return "Some of those values are not allowed.";
  if (/violates foreign key/i.test(message)) return "That refers to something which no longer exists.";
  if (/permission denied|row-level security/i.test(message)) return "You do not have access to that.";
  if (/clubsync: /.test(message)) return message.replace(/^.*clubsync: /, "");
  return "The request could not be completed.";
}
