#!/usr/bin/env node
// Copies a pinned decision-protocol checker, git hooks, CI workflow and scaffolding into a repository.
// Usage: node vendor.mjs --target <repo> [--overwrite <relative-path>]...
// Never overwrites a file that differs unless it is named with --overwrite. Prints one line per file:
// created | unchanged | differs | overwritten
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { safeRelPath } from "./dp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const plugin = resolve(here, "..");
const args = process.argv.slice(2);
const opt = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const target = resolve(opt("--target")[0] ?? "");
const overwrite = new Set(opt("--overwrite"));
if (!opt("--target")[0] || !existsSync(target)) {
  console.error("usage: node vendor.mjs --target <repo> [--overwrite <relative-path>]...");
  process.exit(64);
}

const version = JSON.parse(readFileSync(join(plugin, ".claude-plugin/plugin.json"), "utf8")).version;
const read = (rel) => readFileSync(join(plugin, rel), "utf8");
const stamped = read("scripts/dp.mjs").replace("__DP_VERSION__", version);

let adrDir = "docs/adr";
let configured;
try {
  configured = JSON.parse(readFileSync(join(target, "decision-protocol.config.json"), "utf8"));
} catch {}
try {
  adrDir = safeRelPath("adrDir", configured?.adrDir ?? adrDir);
  safeRelPath("statusFile", configured?.statusFile ?? `${adrDir}/STATUS.md`);
} catch (e) {
  console.error(`decision-protocol.config.json: ${e.message}`);
  process.exit(65);
}
const prdDir = "docs/prd";

const files = [
  { rel: ".decision-protocol/dp.mjs", text: stamped, mode: 0o755 },
  { rel: ".decision-protocol/VERSION", text: `${version}\n` },
  ...["commit-msg", "pre-commit", "pre-push"].map((h) => ({ rel: `.decision-protocol/githooks/${h}`, text: read(`templates/githooks/${h}`), mode: 0o755 })),
  { rel: ".github/workflows/decision-protocol.yml", text: read("templates/workflows/decision-protocol.yml") },
  { rel: "decision-protocol.config.json", text: read("templates/decision-protocol.config.json") },
  { rel: `${adrDir}/_template.md`, text: read("templates/adr.md") },
  { rel: `${prdDir}/_template.md`, text: read("templates/prd.md") },
];

for (const f of files) {
  const abs = join(target, f.rel);
  let state = "created";
  if (existsSync(abs)) {
    if (readFileSync(abs, "utf8") === f.text) {
      console.log(`unchanged ${f.rel}`);
      continue;
    }
    if (!overwrite.has(f.rel)) {
      console.log(`differs ${f.rel}`);
      continue;
    }
    state = "overwritten";
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, f.text);
  if (f.mode) chmodSync(abs, f.mode);
  console.log(`${state} ${f.rel}`);
}
console.log(`vendored decision-protocol ${version}`);
