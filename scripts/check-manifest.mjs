#!/usr/bin/env node
/**
 * Check `export/GAME.json` against the marketplace's published schema before packing.
 *
 * Runs as part of `npm run export:game`, so an invalid manifest cannot even produce a `.kbg`. This
 * is the fast feedback loop; it is not the authority. The marketplace's `sync-catalog` action
 * validates against the same schema at publish time and cannot be skipped, which is why a missing
 * network connection here is a warning rather than a failure — being unable to reach the schema
 * should not stop you building a game for your own server.
 *
 *   node scripts/check-manifest.mjs            warn about template placeholders
 *   node scripts/check-manifest.mjs --strict   fail on them (what the release workflow uses)
 *
 * The schema URL is read from the manifest's own `$schema` key, so it is written down exactly once.
 */

import { readFileSync } from "node:fs";
import { Validator } from "@cfworker/json-schema";

const MANIFEST = "export/GAME.json";
const FETCH_TIMEOUT_MS = 15_000;
const strict = process.argv.includes("--strict");

/**
 * Values the template ships so its example is complete. Every one of them is wrong for a real game,
 * and the marketplace has no way to tell a placeholder from a deliberate choice — a published entry
 * crediting "Your Name" and linking to `your-name/your-game` is the most likely way a game built
 * from this template reaches the catalog broken.
 */
const PLACEHOLDERS = [
  ["id", "knockbox-game-template"],
  ["name", "KnockBox Game Template"],
  ["description", "A starter template for building server-authoritative KnockBox games."],
  ["author.name", "Your Name"],
  ["homepage", "https://github.com/your-name/your-game"],
  ["bugs", "https://github.com/your-name/your-game/issues"],
  ["tags", ["template", "example"]],
];

const problems = [];
const warnings = [];

const read = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
} catch (err) {
  console.error(`check-manifest: cannot read ${MANIFEST}: ${err.message}`);
  process.exit(1);
}

// --- placeholders -------------------------------------------------------------------------------

const unchanged = PLACEHOLDERS.filter(
  ([path, placeholder]) => JSON.stringify(read(manifest, path)) === JSON.stringify(placeholder)
);

if (strict) {
  // Releasing is the moment these stop being harmless, so name each one.
  for (const [path, placeholder] of unchanged) {
    problems.push(`${path} is still the template's placeholder (${JSON.stringify(placeholder)})`);
  }
} else if (unchanged.length > 0) {
  // One line, not seven: this runs on every local pack, and a fresh clone trips all of them.
  warnings.push(
    `${unchanged.length} field(s) still hold template placeholders ` +
      `(${unchanged.map(([path]) => path).join(", ")}) — see the rename table in README.md`
  );
}

// --- schema -------------------------------------------------------------------------------------

const ASSERTIONS = new Set([
  "type", "enum", "const", "format", "pattern", "required", "dependentRequired",
  "minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems", "uniqueItems",
]);
const BRANCH_PATH = new RegExp("/(oneOf|anyOf)/[0-9]+/");
const named = (message) => message.match(/"([^"]+)"/)?.[1];

/** Drop the structural bookkeeping that restates a nested failure one level up. */
function readable(errors) {
  const lines = [];
  for (const e of errors) {
    const at = e.instanceLocation === "#" ? "(root)" : e.instanceLocation.replace(/^#/, "");
    if (BRANCH_PATH.test(e.keywordLocation)) continue;
    if (ASSERTIONS.has(e.keyword)) lines.push(`${at}: ${e.error}`);
    else if (e.keyword === "oneOf" || e.keyword === "anyOf") lines.push(`${at}: no allowed form matched`);
    else if (e.keyword === "additionalProperties") lines.push(`${at}: unknown property ${JSON.stringify(named(e.error))}`);
  }
  return [...new Set(lines)];
}

/**
 * `AbortSignal.timeout()` would be shorter, but it leaves a handle alive that `process.exit()`
 * aborts on during teardown (a libuv assertion on Windows, and exit code 127 instead of 1 — which
 * would make this gate report the wrong kind of failure to CI). An explicit timer can be cleared.
 */
async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`no response in ${FETCH_TIMEOUT_MS} ms`)), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const schemaUrl = manifest.$schema;
if (!schemaUrl) {
  warnings.push(`no "$schema" key, so the manifest cannot be schema-checked; the marketplace still will`);
} else {
  try {
    const response = await fetchWithTimeout(schemaUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const schema = await response.json();
    const result = new Validator(schema, "2020-12", false).validate(manifest);
    if (!result.valid) problems.push(...readable(result.errors));
  } catch (err) {
    // Offline, or the schema host is down. Not this script's job to block the build over it.
    warnings.push(`could not fetch ${schemaUrl} (${err.message}); skipped the schema check`);
  }
}

// --- report -------------------------------------------------------------------------------------

for (const line of warnings) console.warn(`check-manifest: warning: ${line}`);

if (problems.length > 0) {
  console.error(`check-manifest: ${MANIFEST} is not ready to ship:`);
  for (const line of problems) console.error(`  ${line}`);
  process.exitCode = 1;
} else {

  console.log(`check-manifest: ${MANIFEST} ok${warnings.length > 0 ? ` (${warnings.length} warning(s))` : ""}`);
}
