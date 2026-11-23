#!/usr/bin/env node
// Per-user trust records for decision-protocol. This script only reads and hashes files; it never runs repository code.
// Usage: trust.mjs verify --root <repo> [--mode gate|check-file] | inspect --root <repo> | trust --root <repo> --yes | forget --root <repo>
// Optional: --data <dir> (default: $CLAUDE_PLUGIN_DATA, else ~/.local/share/decision-protocol)
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

function dataDir() {
  const given = opt("--data");
  if (given && !given.includes("$")) return resolve(given);
  if (process.env.CLAUDE_PLUGIN_DATA) return resolve(process.env.CLAUDE_PLUGIN_DATA);
  return join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "decision-protocol");
}

const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const slurp = (f) => (existsSync(f) ? readFileSync(f) : null);

/** Everything the plugin would execute on behalf of a repository: its vendored checker, its config (test command) and its rule modules. */
export function fingerprint(root) {
  const configRaw = slurp(join(root, "decision-protocol.config.json"));
  let rules = [];
  let testCommand = "";
  try {
    const cfg = JSON.parse(configRaw?.toString("utf8") ?? "{}");
    if (Array.isArray(cfg.rules)) rules = cfg.rules.filter((r) => typeof r === "string");
    testCommand = String(cfg.testCommand ?? "");
  } catch {}
  const parts = [
    [".decision-protocol/dp.mjs", slurp(join(root, ".decision-protocol/dp.mjs"))],
    ["decision-protocol.config.json", configRaw],
    ...rules.map((r) => [r, slurp(resolve(root, r))]),
  ].map(([label, buf]) => ({ label, hash: buf ? sha(buf) : "missing" }));
  const vendored = slurp(join(root, ".decision-protocol/VERSION"))?.toString("utf8").trim() ?? null;
  return { hash: sha(parts.map((p) => `${p.label}:${p.hash}`).join("\n")), parts, rules, testCommand, vendored };
}

const storeFile = () => join(dataDir(), "trust.json");
function readStore() {
  try {
    return JSON.parse(readFileSync(storeFile(), "utf8"));
  } catch {
    return { version: 1, repos: {} };
  }
}
const repoKey = (root) => {
  try {
    return realpathSync(root);
  } catch {
    return resolve(root);
  }
};

function status(root) {
  const known = readStore().repos?.[repoKey(root)];
  const fp = fingerprint(root);
  if (!known) return { state: "untrusted", fp };
  return { state: known.hash === fp.hash ? "trusted" : "changed", fp };
}

const root = opt("--root") ? resolve(opt("--root")) : process.cwd();

if (cmd === "verify") {
  const { state } = status(root);
  if (state === "trusted") process.exit(0);
  const why =
    state === "untrusted"
      ? "This repository has a decision-protocol.config.json but you have not trusted it, so nothing from the repository (its vendored checker, rule modules or test command) was run and decision checks are off."
      : "The vendored checker, config or rule modules of this repository changed since you trusted it, so nothing from the repository was run and decision checks are off.";
  const msg = `decision-protocol: ${why} To enable them, ask Claude to run the decision-protocol init skill, review what it lists, and confirm the trust step.`;
  const event = opt("--mode") === "gate" ? "PreToolUse" : "PostToolUse";
  console.log(JSON.stringify({ systemMessage: msg, hookSpecificOutput: { hookEventName: event, additionalContext: msg } }));
  process.exit(3);
} else if (cmd === "inspect") {
  const { state, fp } = status(root);
  console.log(`repository: ${repoKey(root)}`);
  console.log(`trust state: ${state}`);
  console.log(`vendored checker version: ${fp.vendored ?? "none (the plugin's own copy is used)"}`);
  console.log(`test command: ${fp.testCommand || "(none)"}`);
  console.log(`rule modules: ${fp.rules.length ? fp.rules.join(", ") : "(none)"}`);
  console.log(`fingerprint: ${fp.hash}`);
} else if (cmd === "trust") {
  if (!argv.includes("--yes")) {
    console.error("trust.mjs trust requires --yes, to be passed only after the user confirmed what 'inspect' showed");
    process.exit(64);
  }
  const store = readStore();
  store.repos ??= {};
  store.repos[repoKey(root)] = { hash: fingerprint(root).hash, trustedAt: new Date().toISOString() };
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(storeFile(), JSON.stringify(store, null, 2) + "\n");
  console.log(`trusted ${repoKey(root)}`);
} else if (cmd === "forget") {
  const store = readStore();
  delete store.repos?.[repoKey(root)];
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(storeFile(), JSON.stringify(store, null, 2) + "\n");
  console.log(`forgot ${repoKey(root)}`);
} else {
  console.error("usage: trust.mjs verify|inspect|trust|forget --root <repo>");
  process.exit(64);
}
