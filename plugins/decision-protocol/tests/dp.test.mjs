// Run with: node --test plugins/decision-protocol/tests
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { analyze, checkCommit, envFiles, gate, globToRegex, isGoverned, load, loadConfig, parseYaml, statusText } from "../scripts/dp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const plugin = resolve(here, "..");
const CONFIG = { scopes: ["billing"], governed: ["src/**/*.{ts,js}"], protected: ["src/auth/**"], testCommand: "" };
const ADR = (state = "accepted") => `---
adr: ADR-0001
decisions:
  D1: { title: Invoices, state: ${state}, paths: ["src/billing/**"], use_cases: [BIL-1] }
  D2: { title: Auth rule, state: accepted, paths: ["src/auth/**"], protected: true, use_cases: [BIL-1] }
---
`;

function repo(files, config = CONFIG) {
  const root = mkdtempSync(join(tmpdir(), "dp-"));
  const all = { "decision-protocol.config.json": JSON.stringify(config), "docs/adr/billing/0001-x.md": ADR(), "docs/prd/billing.md": "| BIL-1 | Pay invoice |\n", ...files };
  for (const [p, c] of Object.entries(all)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), c);
  }
  return root;
}
const errorsOf = async (root) => {
  const c = loadConfig(root);
  return (await analyze(root, c)).ctx.errors.filter((e) => !e.includes("stale"));
};

test("globs", () => {
  assert.ok(globToRegex("src/**/*.{ts,js}").test("src/a/b.ts"));
  assert.ok(globToRegex("src/**/*.{ts,js}").test("src/b.js"));
  assert.ok(!globToRegex("src/*.ts").test("src/a/b.ts"));
  assert.ok(globToRegex("**/*.test.*").test("a/b.test.ts"));
});

test("yaml subset", () => {
  const y = parseYaml("adr: ADR-0001 # c\nprotected_paths: [\"a/**\", b]\ndecisions:\n  D1: { title: 'A: b', state: accepted, paths: [x] }\n  D2:\n    title: T\n    paths:\n      - p\n");
  assert.equal(y.decisions.D1.title, "A: b");
  assert.deepEqual(y.protected_paths, ["a/**", "b"]);
  assert.deepEqual(y.decisions.D2.paths, ["p"]);
  assert.throws(() => parseYaml("a: [1,\n"));
});

test("orphan export fails, tagged accepted export passes", async () => {
  let r = repo({ "src/billing/a.ts": "export function pay() {}\n" });
  assert.match((await errorsOf(r)).join("\n"), /export 'pay' has no @adr tag/);
  r = repo({ "src/billing/a.ts": "/** @adr ADR-0001.D1 */\nexport function pay() {}\nexport type T = string;\n" });
  assert.deepEqual(await errorsOf(r), []);
});

test("proposed, unknown and uncovered tags fail", async () => {
  const src = (id) => ({ "src/billing/a.ts": `/** @adr ${id} */\nexport const x = 1;\n` });
  assert.match((await errorsOf(repo({ ...src("ADR-0001.D1"), "docs/adr/billing/0001-x.md": ADR("proposed") }))).join(), /is proposed, not accepted/);
  assert.match((await errorsOf(repo(src("ADR-0001.D9")))).join(), /does not exist/);
  assert.match((await errorsOf(repo({ "src/other/a.ts": "/** @adr ADR-0001.D1 */\nexport const x = 1;\n" }))).join(), /does not cover/);
});

test("non-JS governed file needs a file-level tag", async () => {
  const cfg = { ...CONFIG, governed: ["src/**/*.py"] };
  assert.match((await errorsOf(repo({ "src/billing/a.py": "def f(): pass\n" }, cfg))).join(), /no @adr tag/);
  assert.deepEqual(await errorsOf(repo({ "src/billing/a.py": "# @adr ADR-0001.D1\ndef f(): pass\n" }, cfg)), []);
});

test("exempt paths and tests are not governed", () => {
  const c = { ...loadConfig(repo({})), exempt: ["**/generated/**"] };
  assert.ok(isGoverned(c, "src/billing/a.ts"));
  assert.ok(!isGoverned(c, "src/billing/generated/a.ts"));
  assert.ok(!isGoverned(c, "src/billing/a.test.ts"));
});

test("use cases must exist in a PRD; protected area needs a protected decision", async () => {
  assert.match((await errorsOf(repo({ "docs/prd/billing.md": "nothing\n" }))).join(), /use case BIL-1 is not in any PRD/);
  const unprotected = ADR().replace("protected: true", "protected: false");
  assert.match((await errorsOf(repo({ "src/auth/s.ts": "/** @adr ADR-0001.D2 */\nexport const s = 1;\n", "docs/adr/billing/0001-x.md": unprotected }))).join(), /protected area with no accepted protected decision/);
});

test("protected decision implemented without test fails; with test passes", async () => {
  const code = { "src/auth/s.ts": "/** @adr ADR-0001.D2 */\nexport const s = 1;\n" };
  assert.match((await errorsOf(repo(code))).join(), /no test titled '\[ADR-0001.D2\]/);
  assert.deepEqual(await errorsOf(repo({ ...code, "src/auth/s.test.ts": "test('[ADR-0001.D2] s', () => {})\n" })), []);
});

test("status is generated and staleness is reported", async () => {
  const r = repo({});
  const a = await analyze(r, loadConfig(r));
  assert.ok(a.ctx.errors.some((e) => e.includes("stale")));
  assert.match(statusText(a), /ADR-0001\.D1 \| Invoices \| Accepted · Not implemented/);
});

test("commit messages", () => {
  const r = repo({});
  const ctx = load(r, loadConfig(r));
  assert.deepEqual(checkCommit(ctx, "feat(ADR-0001.D1): add pay", [], ""), []);
  assert.match(checkCommit(ctx, "added pay", [], "")[0], /subject must be/);
  assert.match(checkCommit(ctx, "feat(ADR-0001.D7): x", [], "")[0], /not a known decision/);
  assert.deepEqual(checkCommit(ctx, "docs(no-adr): notes", ["README.md"], ""), []);
  assert.match(checkCommit(ctx, "chore(no-adr): x", ["src/billing/a.ts"], "")[0], /touches governed code/);
  const fix = "fix(ADR-0001.D1): rounding\n\nObserved: a\nExpected: per ADR-0001.D1, b\nCause: c\nImpact: d\n";
  assert.match(checkCommit(ctx, fix, [], "").join(), /must add a test/);
  assert.deepEqual(checkCommit(ctx, fix, [], "+test('[ADR-0001.D1] rounds')"), []);
  assert.match(checkCommit(ctx, "fix(ADR-0001.D1): x", [], "+[ADR-0001.D1]").join(), /Observed/);
});

test("gate asks for rule files and denies protected edits without intent", () => {
  const r = repo({});
  const ctx = load(r, loadConfig(r));
  assert.equal(gate(ctx, "docs/adr/billing/0001-x.md").decision, "ask");
  assert.equal(gate(ctx, "src/billing/a.ts").decision, "allow");
  assert.equal(gate(ctx, join(r, "src/auth/s.ts")).decision, "deny");
  mkdirSync(join(r, ".claude"));
  writeFileSync(join(r, ".claude/intent.json"), JSON.stringify({ decision: "ADR-0001.D2", type: "feat" }));
  assert.equal(gate(ctx, "src/auth/s.ts").decision, "allow");
});

test("env guard allows templates only", () => {
  const dot = ".en" + "v";
  assert.deepEqual(envFiles([dot, `a/${dot}.local`, `${dot}.example`, "src/env.ts", `${dot}.production`]), [dot, `a/${dot}.local`, `${dot}.production`]);
});

test("repo rule modules are loaded when configured", async () => {
  const rule = "export default { name: 'nc', checkFile: ({text}) => /console\\.log/.test(text) ? ['no console'] : [] };\n";
  const r = repo({ "src/billing/a.ts": "/** @adr ADR-0001.D1 */\nexport const x = () => console.log(1);\n", "rules/r.mjs": rule }, { ...CONFIG, rules: ["rules/r.mjs"] });
  assert.match((await errorsOf(r)).join(), /\[nc\] no console/);
});

// ---- hooks and vendoring ------------------------------------------------
const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", ...opts });
const hook = (root, mode, env = {}) =>
  sh("/bin/sh", [join(plugin, "scripts/hook.sh"), mode], { env: { PATH: "/usr/bin:/bin", CLAUDE_PROJECT_DIR: root, ...env }, input: '{"tool_input":{"file_path":"src/x.ts"}}' });

test("plugin hook is a silent no-op without config, even without node", () => {
  const empty = mkdtempSync(join(tmpdir(), "dp-empty-"));
  for (const mode of ["gate", "check-file"]) {
    const r = hook(empty, mode, { PATH: "/nonexistent" });
    assert.equal(r.status, 0);
    assert.equal(r.stdout + r.stderr, "");
  }
});

test("plugin hook explains the fix when node is missing and config exists", () => {
  const root = repo({});
  const g = hook(root, "gate", { PATH: "/nonexistent" });
  assert.equal(g.status, 0);
  assert.match(g.stdout, /Install Node\.js/);
  const c = hook(root, "check-file", { PATH: "/nonexistent" });
  assert.equal(c.status, 2);
  assert.match(c.stderr, /Install Node\.js/);
  assert.doesNotMatch(g.stdout + c.stderr, /no-verify/);
});

test("vendor is idempotent, stamps the version and never overwrites silently", () => {
  const root = mkdtempSync(join(tmpdir(), "dp-vendor-"));
  const run = (...a) => sh(process.execPath, [join(plugin, "scripts/vendor.mjs"), "--target", root, ...a]).stdout;
  assert.match(run(), /created \.decision-protocol\/dp\.mjs/);
  const version = JSON.parse(readFileSync(join(plugin, ".claude-plugin/plugin.json"), "utf8")).version;
  assert.equal(readFileSync(join(root, ".decision-protocol/VERSION"), "utf8").trim(), version);
  assert.equal(sh(process.execPath, [join(root, ".decision-protocol/dp.mjs"), "version"]).stdout.trim(), version);
  assert.doesNotMatch(run(), /created|differs/);
  writeFileSync(join(root, "decision-protocol.config.json"), "{}");
  assert.match(run(), /differs decision-protocol\.config\.json/);
  assert.equal(readFileSync(join(root, "decision-protocol.config.json"), "utf8"), "{}");
  assert.ok(existsSync(join(root, ".github/workflows/decision-protocol.yml")));
});
