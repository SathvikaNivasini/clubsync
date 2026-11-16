import "server-only";

import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Account recovery without personal contact information.
 *
 * At registration a member is shown a twelve-word recovery phrase. Only a
 * scrypt hash of it is stored, so ClubSync cannot reconstruct the phrase and
 * staff cannot look it up. The phrase is the entire recovery path.
 *
 * The trade-off is deliberate and documented for the member: no email means
 * no "reset by email" link, so a lost phrase means a lost account. That is
 * the price of not collecting an address, and the UI says so plainly.
 */

const WORDS = [
  "amber", "anchor", "apple", "arrow", "aspen", "atlas", "autumn", "badge",
  "bamboo", "basil", "beacon", "birch", "bison", "blossom", "bramble", "breeze",
  "bridge", "bright", "bronze", "brook", "canvas", "canyon", "cedar", "chalk",
  "cherry", "cinder", "citrus", "clover", "cobalt", "comet", "compass", "copper",
  "coral", "cosmos", "cotton", "crane", "crater", "crescent", "crystal", "dahlia",
  "daisy", "dawn", "delta", "domino", "dune", "echo", "ember", "falcon",
  "fern", "fjord", "flint", "forest", "fossil", "fountain", "garnet", "ginger",
  "glacier", "granite", "harbor", "harvest", "hazel", "heron", "hollow", "indigo",
  "ivory", "jasmine", "jasper", "juniper", "kestrel", "lagoon", "lantern", "laurel",
  "lichen", "lilac", "linen", "lotus", "lumen", "magnet", "maple", "marble",
  "meadow", "mesa", "meteor", "mint", "mirror", "mosaic", "moss", "nectar",
  "nimbus", "oasis", "olive", "onyx", "opal", "orbit", "orchid", "osprey",
  "otter", "palm", "pebble", "pepper", "petal", "pewter", "pine", "plum",
  "pollen", "poplar", "prairie", "prism", "quartz", "quill", "quiver", "raven",
  "ribbon", "ridge", "river", "rowan", "rust", "saffron", "sage", "sandal",
  "sapphire", "shale", "silver", "slate", "solstice", "sorrel", "spruce", "zenith",
] as const;

const PHRASE_LENGTH = 12;

export function generateRecoveryPhrase(): string {
  const picked: string[] = [];
  for (let i = 0; i < PHRASE_LENGTH; i += 1) {
    picked.push(WORDS[randomInt(0, WORDS.length)]);
  }
  return picked.join(" ");
}

export function normalizePhrase(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean).join(" ");
}

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;

export function hashRecoveryPhrase(phrase: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(normalizePhrase(phrase), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export function verifyRecoveryPhrase(phrase: string, stored: string | null): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(hashRaw, "base64url");
  } catch {
    return false;
  }

  const actual = scryptSync(normalizePhrase(phrase), Buffer.from(saltRaw, "base64url"), expected.length, {
    N,
    r,
    p,
  });

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Strong one-time password for a freshly provisioned club leader account. */
export function generateProvisionedPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const groups: string[] = [];
  for (let g = 0; g < 4; g += 1) {
    let chunk = "";
    for (let i = 0; i < 5; i += 1) chunk += alphabet[randomInt(0, alphabet.length)];
    groups.push(chunk);
  }
  return groups.join("-");
}
