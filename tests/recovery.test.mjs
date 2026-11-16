/**
 * Recovery-phrase crypto checks.
 *   node --experimental-strip-types --test tests/
 *
 * lib/recovery.ts opens with `import "server-only"`, a build-time guard that
 * makes the bundle fail if the module is ever pulled into client code. That
 * import has no meaning outside the Next build, so the loader below copies the
 * file with just that line removed and imports the real implementation —
 * nothing here re-implements the hashing.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const source = readFileSync(new URL("../lib/recovery.ts", import.meta.url), "utf8");
assert.ok(
  source.includes('import "server-only";'),
  "lib/recovery.ts must keep its server-only guard",
);

const dir = mkdtempSync(join(tmpdir(), "clubsync-recovery-"));
const file = join(dir, "recovery.ts");
writeFileSync(file, source.replace('import "server-only";\n', ""));

const {
  generateRecoveryPhrase,
  hashRecoveryPhrase,
  verifyRecoveryPhrase,
  normalizePhrase,
  generateProvisionedPassword,
} = await import(pathToFileURL(file).href);

test("a generated phrase is twelve lowercase words", () => {
  const words = generateRecoveryPhrase().split(" ");
  assert.equal(words.length, 12);
  for (const word of words) assert.match(word, /^[a-z]+$/);
});

test("phrases differ between calls", () => {
  assert.notEqual(generateRecoveryPhrase(), generateRecoveryPhrase());
});

test("a hash verifies against its own phrase", () => {
  const phrase = generateRecoveryPhrase();
  assert.equal(verifyRecoveryPhrase(phrase, hashRecoveryPhrase(phrase)), true);
});

test("the stored hash never contains the phrase itself", () => {
  const phrase = generateRecoveryPhrase();
  const hash = hashRecoveryPhrase(phrase);
  for (const word of new Set(phrase.split(" "))) {
    assert.equal(hash.includes(word), false, `hash leaked the word "${word}"`);
  }
});

test("hashing the same phrase twice differs — the hash is salted", () => {
  const phrase = generateRecoveryPhrase();
  assert.notEqual(hashRecoveryPhrase(phrase), hashRecoveryPhrase(phrase));
});

test("a different phrase is rejected", () => {
  const hash = hashRecoveryPhrase(generateRecoveryPhrase());
  assert.equal(verifyRecoveryPhrase(generateRecoveryPhrase(), hash), false);
});

test("one wrong word is enough to fail", () => {
  const phrase = generateRecoveryPhrase();
  const hash = hashRecoveryPhrase(phrase);
  const words = phrase.split(" ");
  words[4] = words[4] === "amber" ? "zenith" : "amber";
  assert.equal(verifyRecoveryPhrase(words.join(" "), hash), false);
});

test("capitalisation, punctuation and spacing are normalised away", () => {
  const phrase = generateRecoveryPhrase();
  const hash = hashRecoveryPhrase(phrase);
  const messy = `  ${phrase.toUpperCase().split(" ").join(",   ")}.  `;
  assert.equal(normalizePhrase(messy), phrase);
  assert.equal(verifyRecoveryPhrase(messy, hash), true);
});

test("a missing or malformed hash never verifies", () => {
  for (const bad of [null, "", "not-a-hash", "scrypt$1$2$3$4", "bcrypt$a$b$c$d$e"]) {
    assert.equal(verifyRecoveryPhrase("anything at all", bad), false);
  }
});

test("provisioned passwords are long, grouped and unique", () => {
  const a = generateProvisionedPassword();
  assert.match(a, /^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/);
  assert.notEqual(a, generateProvisionedPassword());
  assert.equal(a.replace(/-/g, "").length, 20);
});
