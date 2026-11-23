// Run with: node --test plugins/decision-protocol/tests
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { analyze, loadConfig, safeRelPath } from "../scripts/dp.mjs";

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DP = join(plugin, "scripts/dp.mjs");
const CONFIG = { scopes: ["billing"], governed: ["src/**/*.{ts,js}"], exempt: ["docs/**"], testCommand: "" };
const ADR = `---
adr: ADR-0001
decisions:
  D1: { title: Invoices, state: accepted, paths: ["src/billing/**"], use_cases: [BIL-1] }
---
`;
const NODE_PATH = `${dirname(process.execPath)}:/usr/bin:/bin`;
const ID_ENV = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", ...opts, env: { ...process.env, ...ID_ENV, ...opts.env } });
function write(root, files) {
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), c);
  }
}
function repo(files = {}, config = CONFIG, git = false) {
  const root = mkdtempSync(join(tmpdir(), "dp-h-"));
  write(root, { "decision-protocol.config.json": JSON.stringify(config), "docs/adr/billing/0001-x.md": ADR, "docs/prd/billing.md": "| BIL-1 | Pay |\n", ...files });
  if (git) {
    run("git", ["init", "-q", "-b", "main", root]);
    run("git", ["-C", root, "add", "-A"]);
    run("git", ["-C", root, "commit", "-q", "-m", "base"]);
  }
  return root;
}
const git = (root, ...a) => run("git", ["-C", root, ...a]);
const commitMsg = (root, msg, ...extra) => {
  const f = join(root, ".git/MSG");
  writeFileSync(f, msg);
  return run(process.execPath, [DP, "--root", root, "commit-msg", f, ...extra]);
};
const problems = async (root, file) => {
  const a = await analyze(root, loadConfig(root), file);
  return a.ctx.problems.filter((e) => !e.includes("out of date"));
};

// ---- merge and revert exemptions are verified, not trusted by title ----------
test("a fake Merge or Revert subject touching governed code is still checked", () => {
  const root = repo({}, CONFIG, true);
  write(root, { "src/billing/a.ts": "export const x = 1;\n" });
  git(root, "add", "-A");
  for (const subject of ["Merge x", "Revert x", 'Revert "x"']) {
    const r = commitMsg(root, subject);
    assert.equal(r.status, 1, subject);
    assert.match(r.stderr, /first line should look like/);
  }
});

test("a real pending merge and a real revert are exempt", () => {
  const root = repo({}, CONFIG, true);
  git(root, "checkout", "-q", "-b", "side");
  write(root, { "src/billing/a.ts": "export const x = 1;\n" });
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "side work");
  git(root, "checkout", "-q", "main");
  write(root, { "other.txt": "o\n" });
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "main work");
  assert.equal(git(root, "merge", "--no-commit", "--no-ff", "side").status, 0);
  assert.equal(commitMsg(root, "Merge branch 'side'").status, 0, "MERGE_HEAD present");
  git(root, "commit", "-q", "-m", "Merge branch 'side'");
  const sha = git(root, "rev-parse", "HEAD").stdout.trim();
  assert.equal(commitMsg(root, "Merge branch 'side'", "--commit", sha).status, 0, "two parents");
  const plain = git(root, "rev-parse", "HEAD~1").stdout.trim();
  assert.equal(commitMsg(root, "Merge x", "--commit", plain).status, 1, "one parent");

  assert.equal(git(root, "revert", "--no-commit", "HEAD~1").status, 0);
  assert.equal(commitMsg(root, 'Revert "main work"').status, 0, "REVERT_HEAD present");
});

test("a Revert line naming a missing commit does not exempt", () => {
  const root = repo({}, CONFIG, true);
  write(root, { "src/billing/a.ts": "export const x = 1;\n" });
  git(root, "add", "-A");
  assert.equal(commitMsg(root, "Revert x\n\nThis reverts commit 0123456789abcdef0123456789abcdef01234567.").status, 1);
  const head = git(root, "rev-parse", "HEAD").stdout.trim();
  assert.equal(commitMsg(root, `Revert x\n\nThis reverts commit ${head}.`).status, 0);
});

// ---- renames cannot hide a governed file --------------------------------
test("moving a governed file to an exempt path under no-adr is rejected", () => {
  const root = repo({ "src/billing/a.ts": "/** @adr ADR-0001.D1 */\nexport const x = 1;\n" }, CONFIG, true);
  git(root, "mv", "src/billing/a.ts", "docs/a.ts");
  const r = commitMsg(root, "chore(no-adr): move file");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /src\/billing\/a\.ts/);
});

// ---- export detection ---------------------------------------------------
test("export forms: orphans fail, tagged forms and non-exports pass", async () => {
  const orphans = [
    "export * from './a';",
    "export * as ns from './a';",
    "export { a } from './a';",
    "export { a, b };",
    "export declare function f(): void;",
    "  export const x = 1;",
    "export\nfunction f() {}",
    "export\n  default class {}",
    "module.exports = {};",
    "exports.a = 1;",
  ];
  for (const src of orphans) {
    const root = repo({ "src/billing/a.ts": `${src}\n` });
    assert.equal((await problems(root)).length, 1, src);
    const tagged = repo({ "src/billing/a.ts": `/** @adr ADR-0001.D1 */\n${src}\n` });
    assert.deepEqual(await problems(tagged), [], `tagged: ${src}`);
  }
  const quiet = [
    "export type T = string;\nexport interface I {}\nexport {};",
    "// export const x = 1;\n/* export function f() {} */",
    "const s = 'export const x = 1';\nconst t = `\nexport function g() {}\n`;",
  ];
  for (const src of quiet) assert.deepEqual(await problems(repo({ "src/billing/a.ts": `${src}\n` })), [], src);
});

// ---- config paths -------------------------------------------------------
test("config paths must be relative and stay inside the project", () => {
  for (const [key, bad] of [["statusFile", "/etc/status.md"], ["statusFile", "../status.md"], ["adrDir", "../../adr"], ["adrDir", "C:/adr"], ["rules", ["/abs/rule.mjs"]], ["prdPaths", ["../prd/*.md"]]]) {
    const root = repo({}, { ...CONFIG, [key]: bad });
    assert.throws(() => loadConfig(root), /must (be relative|stay inside)/, `${key}=${bad}`);
  }
  assert.equal(safeRelPath("x", "docs/adr/"), "docs/adr");
  const root = repo({}, { ...CONFIG, statusFile: "../x.md" });
  const r = run(process.execPath, [DP, "--root", root, "status"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /is invalid/);
  const v = run(process.execPath, [join(plugin, "scripts/vendor.mjs"), "--target", root]);
  assert.equal(v.status, 65);
});

// ---- trust model --------------------------------------------------------
function evilRepo() {
  const root = repo({}, { ...CONFIG, rules: ["evil-rule.mjs"], testCommand: "touch MARK_TEST" });
  const mark = (name) => join(root, name);
  write(root, {
    "src/billing/a.ts": "/** @adr ADR-0001.D1 */\nexport const x = 1;\n",
    "evil-rule.mjs": `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(mark("MARK_RULE"))}, "x"); export default { name: "evil" };\n`,
    ".decision-protocol/dp.mjs": `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(mark("MARK_CHECKER"))}, "x");\n`,
  });
  return { root, mark };
}
const hook = (root, data, mode) =>
  run("/bin/sh", [join(plugin, "scripts/hook.sh"), mode], { env: { PATH: NODE_PATH, CLAUDE_PROJECT_DIR: root, CLAUDE_PLUGIN_DATA: data }, input: JSON.stringify({ tool_input: { file_path: "src/billing/a.ts" } }), cwd: tmpdir() });
const trustCmd = (root, data, ...a) => run(process.execPath, [join(plugin, "scripts/trust.mjs"), ...a, "--root", root, "--data", data]);

test("a cloned repository with malicious config runs nothing on the first edit", () => {
  const { root, mark } = evilRepo();
  const data = mkdtempSync(join(tmpdir(), "dp-data-"));
  for (const mode of ["gate", "check-file"]) {
    const r = hook(root, data, mode);
    assert.equal(r.status, 0, mode);
    assert.match(JSON.parse(r.stdout).systemMessage, /have not trusted it/);
  }
  for (const m of ["MARK_RULE", "MARK_CHECKER", "MARK_TEST"]) assert.ok(!existsSync(mark(m)), m);
  assert.equal(trustCmd(root, data, "trust").status, 64, "trust needs --yes");
});

test("trust is per user, covers the checker, config and rules, and expires on change", () => {
  const { root, mark } = evilRepo();
  const data = mkdtempSync(join(tmpdir(), "dp-data-"));
  assert.match(trustCmd(root, data, "inspect").stdout, /touch MARK_TEST/);
  assert.equal(trustCmd(root, data, "trust", "--yes").status, 0);
  hook(root, data, "check-file");
  assert.ok(existsSync(mark("MARK_CHECKER")), "runs once trusted");
  // a different data directory (another user) does not inherit the trust
  const other = mkdtempSync(join(tmpdir(), "dp-data-"));
  assert.match(hook(root, other, "check-file").stdout, /have not trusted it/);
  // any change to checker, config or rule module revokes trust
  for (const [file, text] of [["decision-protocol.config.json", JSON.stringify({ ...CONFIG, rules: ["evil-rule.mjs"], testCommand: "touch OTHER" })], ["evil-rule.mjs", "export default {};\n"], [".decision-protocol/dp.mjs", "// changed\n"]]) {
    assert.equal(trustCmd(root, data, "trust", "--yes").status, 0);
    write(root, { [file]: text });
    const r = hook(root, data, "check-file");
    assert.match(JSON.parse(r.stdout).systemMessage, /changed since you trusted it/, file);
  }
});
