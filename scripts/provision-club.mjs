#!/usr/bin/env node
/**
 * Provision a club and its leader account.
 *
 *   node scripts/provision-club.mjs --code CCTIA --name "CCTIA" --school "Demo High"
 *
 * Each club gets its own administrative identity and an individually generated
 * password, printed once. There is no shared or default password anywhere in
 * ClubSync, and the leader is required to change theirs on first sign-in.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
 * environment (e.g. `node --env-file=.env.local scripts/provision-club.mjs ...`).
 */
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

function arg(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 5 }, () => alphabet[randomInt(0, alphabet.length)]).join(""),
  ).join("-");
}

const code = (arg("--code") ?? "").trim().toUpperCase();
const name = arg("--name") ?? code;
const school = arg("--school");
const description = arg("--description");
const accent = arg("--color", "#00AD98");

if (!/^[A-Z0-9][A-Z0-9-]{2,15}$/.test(code)) {
  console.error(
    "A --code of 3-16 characters is required (capitals, digits and hyphens).\n" +
      'Example: node scripts/provision-club.mjs --code CCTIA --name "CCTIA"',
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n" +
      "Try: node --env-file=.env.local scripts/provision-club.mjs --code CCTIA",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existingClub } = await admin.from("clubs").select("id").eq("code", code).maybeSingle();
if (existingClub) {
  console.error(`A club with code ${code} already exists.`);
  process.exit(1);
}

const { data: club, error: clubError } = await admin
  .from("clubs")
  .insert({ code, name, school, description, accent_color: accent })
  .select("*")
  .single();

if (clubError) {
  console.error("Could not create the club:", clubError.message);
  process.exit(1);
}

const password = generatePassword();
const email = `${code.toLowerCase()}@admins.clubsync.invalid`;

const { data: created, error: userError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { app_role: "leader", club_code: code },
});

if (userError || !created?.user) {
  await admin.from("clubs").delete().eq("id", club.id);
  console.error("Could not create the leader account:", userError?.message);
  process.exit(1);
}

const { error: adminRowError } = await admin.from("club_admins").insert({
  club_id: club.id,
  user_id: created.user.id,
  admin_handle: code,
  display_name: `${name} leader`,
  must_change_password: true,
});

if (adminRowError) {
  await admin.auth.admin.deleteUser(created.user.id);
  await admin.from("clubs").delete().eq("id", club.id);
  console.error("Could not link the leader account:", adminRowError.message);
  process.exit(1);
}

console.log(`
Club provisioned.

  Club name     ${name}
  Club code     ${code}      <- share this with members
  Leader login  ${code}
  Password      ${password}      <- shown once; store it in a password manager

The leader is prompted to change this password on first sign-in.
Sign in at /login using the "I lead a club" tab.
`);
