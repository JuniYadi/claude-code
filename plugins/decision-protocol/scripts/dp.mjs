#!/usr/bin/env node
// decision-protocol checker. Dependency-free, Node.js 18+.
// Commands: check [--stdin] | status | commit-msg <file> [--commit <sha>] | gate | run-tests | guard-env | version
// Global option: --root <dir> (default: git top level of the working directory).
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, posix, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Replaced with the plugin version when the checker is vendored into a repository. */
export const VERSION = "__DP_VERSION__";

const ID = /ADR-\d{4}\.D\d+/g;
const STATES = ["proposed", "accepted", "superseded", "rejected"];
const FIX_FIELDS = ["observed", "expected", "cause", "impact"];
const CONFIG_FILE = "decision-protocol.config.json";
const JS_FILE = /\.(?:[cm]?[jt]sx?)$/;
const ENV_ALLOWED = /^\.env\.(example|sample|template|dist)$/;

// ---- globs --------------------------------------------------------------
export function globToRegex(glob) {
  const expand = (s) => {
    const m = s.match(/\{([^{}]*)\}/);
    if (!m) return [s];
    return m[1].split(",").flatMap((alt) => expand(s.slice(0, m.index) + alt + s.slice(m.index + m[0].length)));
  };
  const one = (s) => {
    let r = "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "*") {
        if (s[i + 1] === "*") {
          i++;
          if (s[i + 1] === "/") {
            i++;
            r += "(?:.*/)?";
          } else r += ".*";
        } else r += "[^/]*";
      } else if (c === "?") r += "[^/]";
      else r += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
    return r;
  };
  return new RegExp("^(?:" + expand(glob).map(one).join("|") + ")$");
}
export const matches = (globs, p) => globs.some((g) => globToRegex(g).test(p));

// ---- minimal YAML (front matter subset) ---------------------------------
// Supports block mappings, block lists, flow [a, b] and {k: v}, quoted and plain scalars, # comments.
function stripComment(l) {
  let q = null;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) {
      if (c === q) q = null;
    } else if (c === '"' || c === "'") q = c;
    else if (c === "#" && (i === 0 || /\s/.test(l[i - 1]))) return l.slice(0, i);
  }
  return l;
}
const unquote = (s) => (/^(".*"|'.*')$/.test(s) ? s.slice(1, -1) : s);
function scalar(s) {
  s = s.trim();
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "~" || s === "") return null;
  return unquote(s);
}
function flow(st) {
  const ws = () => {
    while (/\s/.test(st.s[st.p] ?? "")) st.p++;
  };
  ws();
  const c = st.s[st.p];
  if (c === "[") {
    st.p++;
    const arr = [];
    for (;;) {
      ws();
      if (st.s[st.p] === "]") {
        st.p++;
        return arr;
      }
      if (st.p >= st.s.length) throw new Error("unterminated [");
      arr.push(flow(st));
      ws();
      if (st.s[st.p] === ",") st.p++;
    }
  }
  if (c === "{") {
    st.p++;
    const obj = {};
    for (;;) {
      ws();
      if (st.s[st.p] === "}") {
        st.p++;
        return obj;
      }
      if (st.p >= st.s.length) throw new Error("unterminated {");
      const km = st.s.slice(st.p).match(/^("[^"]*"|'[^']*'|[^:,{}[\]]+?)\s*:/);
      if (!km) throw new Error(`bad key near '${st.s.slice(st.p, st.p + 20)}'`);
      st.p += km[0].length;
      obj[unquote(km[1].trim())] = flow(st);
      ws();
      if (st.s[st.p] === ",") st.p++;
    }
  }
  if (c === '"' || c === "'") {
    const end = st.s.indexOf(c, st.p + 1);
    if (end < 0) throw new Error("unterminated quote");
    const v = st.s.slice(st.p + 1, end);
    st.p = end + 1;
    return v;
  }
  const m = st.s.slice(st.p).match(/^[^,\]}]*/);
  st.p += m[0].length;
  return scalar(m[0]);
}
function parseValue(s) {
  s = s.trim();
  if (s[0] === "[" || s[0] === "{") {
    const st = { s, p: 0 };
    const v = flow(st);
    if (s.slice(st.p).trim()) throw new Error(`unexpected '${s.slice(st.p).trim()}'`);
    return v;
  }
  return scalar(s);
}
function parseBlock(lines, st, indent) {
  const isItem = (t) => t.startsWith("- ") || t === "-";
  if (isItem(lines[st.i].text)) {
    const arr = [];
    while (st.i < lines.length && lines[st.i].indent === indent && isItem(lines[st.i].text)) {
      arr.push(parseValue(lines[st.i].text.slice(1)));
      st.i++;
    }
    return arr;
  }
  const obj = {};
  while (st.i < lines.length && lines[st.i].indent === indent) {
    const { text } = lines[st.i];
    const m = text.match(/^("[^"]*"|'[^']*'|[^:\s][^:]*?)\s*:(?:\s+(.*))?$/);
    if (!m) throw new Error(`cannot parse '${text}'`);
    st.i++;
    if (m[2] !== undefined && m[2] !== "") obj[unquote(m[1])] = parseValue(m[2]);
    else if (st.i < lines.length && (lines[st.i].indent > indent || (lines[st.i].indent === indent && isItem(lines[st.i].text))))
      obj[unquote(m[1])] = parseBlock(lines, st, lines[st.i].indent);
    else obj[unquote(m[1])] = null;
  }
  if (st.i < lines.length && lines[st.i].indent > indent) throw new Error(`bad indentation at '${lines[st.i].text}'`);
  return obj;
}
export function parseYaml(text) {
  const lines = text
    .split("\n")
    .map(stripComment)
    .filter((l) => l.trim() !== "")
    .map((l) => ({ indent: l.match(/^ */)[0].length, text: l.trim() }));
  if (!lines.length) return {};
  return parseBlock(lines, { i: 0 }, lines[0].indent);
}

// ---- configuration ------------------------------------------------------
export function loadConfig(root) {
  const f = join(root, CONFIG_FILE);
  if (!existsSync(f)) return null;
  const raw = JSON.parse(readFileSync(f, "utf8"));
  const adrDir = String(raw.adrDir ?? "docs/adr").replace(/\/+$/, "");
  return {
    scopes: raw.scopes ?? [],
    adrDir,
    prdPaths: raw.prdPaths ?? ["docs/prd/*.md"],
    governed: raw.governed ?? [],
    exempt: raw.exempt ?? [],
    protected: raw.protected ?? [],
    testPatterns: raw.testPatterns ?? [
      "**/*.test.*",
      "**/*.spec.*",
      "**/*_test.*",
      "**/test_*.py",
      "**/test/**",
      "**/tests/**",
      "**/__tests__/**",
    ],
    testCommand: raw.testCommand ?? "",
    rules: raw.rules ?? [],
    commitTypes: raw.commitTypes ?? ["feat", "fix", "refactor", "test", "perf"],
    requireUseCase: raw.requireUseCase ?? true,
    statusFile: raw.statusFile ?? `${adrDir}/STATUS.md`,
  };
}

const isTest = (c, p) => matches(c.testPatterns, p);
export const isGoverned = (c, p) => matches(c.governed, p) && !matches(c.exempt, p) && !isTest(c, p);
const isProtectedFile = (c, p) => matches(c.protected, p) && !matches(c.exempt, p) && !isTest(c, p);

function listFiles(root) {
  const r = spawnSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" });
  if (r.status === 0)
    return r.stdout
      .split("\0")
      .filter((f) => f && existsSync(join(root, f)))
      .sort();
  const out = [];
  const rec = (rel) => {
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
      const q = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) e.name !== "node_modules" && e.name !== ".git" && rec(q);
      else out.push(q);
    }
  };
  rec("");
  return out.sort();
}

// ---- loading decisions and use cases ------------------------------------
export function load(root, config, files = listFiles(root)) {
  const ctx = { root, config, decisions: new Map(), protectedPaths: [], useCases: new Set(), errors: [] };
  const adrFiles = files.filter((f) => f.startsWith(`${config.adrDir}/`) && /^\d{4}-[^/]*\.md$/.test(posix.basename(f)));
  const seen = new Map();
  for (const f of adrFiles) {
    const base = posix.basename(f);
    const sub = posix.dirname(f.slice(config.adrDir.length + 1));
    const scope = sub === "." ? "default" : sub.split("/")[0];
    if (config.scopes.length && !config.scopes.includes(scope))
      ctx.errors.push(`${f}: scope '${scope}' is not in "scopes" of ${CONFIG_FILE} (${config.scopes.join(", ")})`);
    const n = base.slice(0, 4);
    if (seen.has(n)) ctx.errors.push(`${f}: number ${n} is already used by ${seen.get(n)}`);
    seen.set(n, f);
    const m = readFileSync(join(root, f), "utf8").replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/);
    if (!m) {
      ctx.errors.push(`${f}: missing YAML front matter`);
      continue;
    }
    let fm;
    try {
      fm = parseYaml(m[1]);
    } catch (e) {
      ctx.errors.push(`${f}: front matter is not valid: ${e.message}`);
      continue;
    }
    if (fm?.adr !== `ADR-${n}`) ctx.errors.push(`${f}: front matter 'adr' must be ADR-${n}`);
    ctx.protectedPaths.push(...(fm?.protected_paths ?? []));
    for (const [key, v] of Object.entries(fm?.decisions ?? {})) {
      const id = `${fm?.adr}.${key}`;
      if (!/^D\d+$/.test(key) || !STATES.includes(v?.state) || !v?.title)
        ctx.errors.push(`${f}: ${id} needs a title and a state in ${STATES.join("|")}`);
      ctx.decisions.set(id, {
        id,
        file: f,
        title: String(v?.title ?? ""),
        state: v?.state,
        paths: v?.paths ?? [],
        protected: v?.protected === true,
        use_cases: v?.use_cases ?? [],
        superseded_by: v?.superseded_by,
        scope: String(fm?.scope ?? scope),
      });
    }
  }
  for (const f of files) {
    if (!matches(config.prdPaths, f) || posix.basename(f).startsWith("_") || !f.endsWith(".md")) continue;
    for (const m of readFileSync(join(root, f), "utf8").matchAll(/^(?:\|\s*|#+\s*)([A-Z][A-Z0-9]*-\d+)\b/gm)) ctx.useCases.add(m[1]);
  }
  return ctx;
}

const covers = (d, p) => matches(d.paths, p);

// ---- per-file checks ----------------------------------------------------
function tagProblem(ctx, p, id) {
  const d = ctx.decisions.get(id);
  if (!d) return `${p}: tag ${id} does not exist`;
  if (d.state === "superseded") return `${p}: tag ${id} is superseded${d.superseded_by ? ` by ${d.superseded_by}` : ""}`;
  if (d.state !== "accepted") return `${p}: tag ${id} is ${d.state}, not accepted`;
  if (!covers(d, p)) return `${p}: tag ${id} does not cover this file (its paths: ${d.paths.join(", ") || "none"})`;
}

const EXPORT = /^export\s+(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(function\*?|class|const|let|var|enum)\b\s*([A-Za-z_$][\w$]*)?/;
const EXPORT_DEFAULT = /^export\s+default\b/;

function hasAdrDoc(lines, k) {
  let j = k - 1;
  while (j >= 0 && lines[j].trim() === "") j--;
  if (j < 0 || !lines[j].trim().endsWith("*/")) return false;
  let s = j;
  while (s > 0 && !lines[s].includes("/*")) s--;
  const block = lines.slice(s, j + 1).join("\n");
  return /@adr\b[^\n]*ADR-\d{4}\.D\d+/.test(block);
}

/** Returns the decision ids implemented by one governed file and records problems in ctx.errors. */
function checkSource(ctx, p, text) {
  const implemented = new Set();
  let tags = 0;
  for (const m of text.matchAll(/@adr\b([^\n]*)/g)) {
    const ids = m[1].match(ID);
    if (!ids) ctx.errors.push(`${p}: malformed @adr tag '${m[0].trim()}' (expected ADR-NNNN.Dn)`);
    for (const id of ids ?? []) {
      tags++;
      const e = tagProblem(ctx, p, id);
      e ? ctx.errors.push(e) : implemented.add(id);
    }
  }
  if (JS_FILE.test(p)) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    lines.forEach((line, k) => {
      const m = line.match(EXPORT);
      if (!m && !EXPORT_DEFAULT.test(line)) return;
      if (!hasAdrDoc(lines, k)) ctx.errors.push(`${p}: export '${m?.[2] ?? "default"}' has no @adr tag (no code without a decision)`);
    });
  } else if (!tags) ctx.errors.push(`${p}: governed file has no @adr tag (add a comment containing '@adr ADR-NNNN.Dn')`);
  return [...implemented];
}

function checkProtected(ctx, p) {
  const ok = [...ctx.decisions.values()].some((d) => d.protected && d.state === "accepted" && covers(d, p));
  if (!ok) ctx.errors.push(`${p}: protected area with no accepted protected decision covering it. Write the ADR first`);
}

async function loadRules(ctx) {
  const rules = [];
  for (const rel of ctx.config.rules) {
    try {
      const mod = await import(pathToFileURL(resolve(ctx.root, rel)).href);
      rules.push(mod.default);
    } catch (e) {
      ctx.errors.push(`rule module ${rel} could not be loaded: ${e.message}`);
    }
  }
  return rules.filter(Boolean);
}

// ---- whole-repo analysis ------------------------------------------------
export async function analyze(root, config, only) {
  const files = listFiles(root);
  const ctx = load(root, config, files);
  const implementedIn = new Map();
  const testedBy = new Map();
  const add = (m, k, v) => m.set(k, [...new Set([...(m.get(k) ?? []), v])]);
  const rules = await loadRules(ctx);
  const ruleCtx = (extra) => ({ root, config, decisions: ctx.decisions, ...extra });

  for (const p of files) {
    if (only && p !== only) continue;
    const text = () => readFileSync(join(root, p), "utf8");
    if (isProtectedFile(config, p)) checkProtected(ctx, p);
    if (isGoverned(config, p)) {
      const t = text();
      for (const id of checkSource(ctx, p, t)) add(implementedIn, id, p);
      for (const r of rules) for (const e of (await r.checkFile?.(ruleCtx({ path: p, text: t }))) ?? []) ctx.errors.push(`${p}: [${r.name ?? "rule"}] ${e}`);
    }
    if (isTest(config, p)) {
      for (const m of text().matchAll(/\[(ADR-\d{4}\.D\d+)\]/g)) {
        if (!ctx.decisions.has(m[1]) && !only) ctx.errors.push(`${p}: test is tagged to unknown ${m[1]}`);
        add(testedBy, m[1], p);
      }
    }
  }
  if (only) {
    ctx.errors = ctx.errors.filter((e) => e.startsWith(`${only}:`));
    return { ctx, implementedIn, testedBy };
  }

  for (const d of ctx.decisions.values()) {
    if (config.requireUseCase && d.state !== "rejected" && !d.use_cases.length) ctx.errors.push(`${d.id}: needs at least one use case from a PRD`);
    for (const u of d.use_cases) if (!ctx.useCases.has(u)) ctx.errors.push(`${d.id}: use case ${u} is not in any PRD (${config.prdPaths.join(", ")})`);
    if (d.state === "accepted" && !d.paths.length) ctx.errors.push(`${d.id}: accepted decision needs 'paths' (the files it governs)`);
    if (d.state === "superseded" && !(d.superseded_by && ctx.decisions.has(d.superseded_by)))
      ctx.errors.push(`${d.id}: superseded but 'superseded_by' is missing or unknown`);
    if (d.protected && d.state === "accepted" && implementedIn.has(d.id) && !testedBy.has(d.id))
      ctx.errors.push(`${d.id}: protected decision is implemented but has no test titled '[${d.id}] ...'`);
  }
  for (const r of rules) for (const e of (await r.checkRepo?.(ruleCtx({ files }))) ?? []) ctx.errors.push(`[${r.name ?? "rule"}] ${e}`);
  const a = { ctx, implementedIn, testedBy };
  const sf = join(root, config.statusFile);
  if (!existsSync(sf) || readFileSync(sf, "utf8") !== statusText(a)) ctx.errors.push(`${config.statusFile} is missing or stale: run the 'status' command`);
  return a;
}

const label = (a, d) => {
  const s = d.state[0].toUpperCase() + d.state.slice(1);
  if (d.state !== "accepted") return s;
  if (!a.implementedIn.has(d.id)) return `${s} · Not implemented`;
  return `${s} · Implemented · ${a.testedBy.has(d.id) ? "Tested" : "Untested"}`;
};

export const gaps = (a) =>
  [...a.ctx.decisions.values()].filter((d) => d.state === "accepted" && !(a.implementedIn.has(d.id) && a.testedBy.has(d.id))).map((d) => `${d.id} ${label(a, d)}`);

export function statusText(a) {
  const cell = (xs) => (xs?.length ? xs.map((x) => `\`${x}\``).join("<br>") : "—");
  const row = (d) =>
    `| ${d.id} | ${d.title} | ${label(a, d)}${d.protected ? " · protected" : ""} | ${d.use_cases.join(", ") || "—"} | ${cell(a.implementedIn.get(d.id))} | ${cell(a.testedBy.get(d.id))} |`;
  const decisions = [...a.ctx.decisions.values()].sort((x, y) => x.id.localeCompare(y.id, "en", { numeric: true }));
  const scopes = [...new Set(decisions.map((d) => d.scope))].sort();
  return [
    "# Decision status",
    "",
    "Generated by the decision-protocol `status` command. Do not edit. Implemented = code tagged `@adr`; Tested = test titled `[ADR-NNNN.Dn]`.",
    "",
    ...scopes.flatMap((scope) => [
      `## ${scope}`,
      "",
      "| Decision | Title | State | Use cases | Implemented in | Tested by |",
      "|---|---|---|---|---|---|",
      ...decisions.filter((d) => d.scope === scope).map(row),
      "",
    ]),
  ].join("\n");
}

// ---- commit message -----------------------------------------------------
export function checkCommit(ctx, raw, files, addedTestText) {
  const { config } = ctx;
  const msg = raw.split("\n").filter((l) => !l.startsWith("#")).join("\n").trim();
  const subject = msg.split("\n")[0] ?? "";
  if (/^(Merge|Revert) /.test(subject)) return [];
  if (/^(docs|chore)\(no-adr\): \S/.test(subject)) {
    const hit = files.filter((f) => isGoverned(config, f) || isProtectedFile(config, f));
    return hit.length ? [`(no-adr) commit touches governed code: ${hit.join(", ")}. Name a decision: type(ADR-NNNN.Dn): ...`] : [];
  }
  const m = subject.match(/^(\w+)\(([^)]*)\): \S/);
  if (!m || !config.commitTypes.includes(m[1]))
    return [`subject must be 'type(ADR-NNNN.Dn): summary' (type: ${config.commitTypes.join("|")}) or 'docs|chore(no-adr): summary'; got '${subject}'`];
  const ids = m[2].split(/\s*,\s*/);
  const errs = [];
  for (const id of ids) {
    const d = ctx.decisions.get(id);
    if (!/^ADR-\d{4}\.D\d+$/.test(id) || !d) errs.push(`${id} is not a known decision`);
    else if (d.state !== "accepted") errs.push(`${id} is ${d.state}, not accepted`);
  }
  if (m[1] === "fix") {
    for (const f of FIX_FIELDS) if (!new RegExp(`^${f}: \\S`, "im").test(msg)) errs.push(`fix needs a '${f[0].toUpperCase() + f.slice(1)}: ...' line`);
    const exp = msg.match(/^expected: (.*)$/im)?.[1] ?? "";
    if (!ids.some((id) => exp.includes(id))) errs.push(`'Expected:' must cite the decision (${ids.join(", ")})`);
    if (!ids.some((id) => addedTestText.includes(`[${id}]`))) errs.push(`fix must add a test titled '[${ids[0]}] ...'`);
  }
  return errs;
}

function addedTestLines(config, diff) {
  let cur = "";
  const out = [];
  for (const l of diff.split("\n")) {
    if (l.startsWith("+++ ")) cur = l.slice(4).replace(/^b\//, "");
    else if (l.startsWith("+") && isTest(config, cur)) out.push(l);
  }
  return out.join("\n");
}

// ---- Claude gate --------------------------------------------------------
export function gate(ctx, file) {
  const { config, root } = ctx;
  const p = isAbsolute(file) ? relative(root, file) : file;
  const allow = { decision: "allow", reason: "" };
  if (!p || p.startsWith("..")) return allow;
  const ruleFile =
    p.startsWith(`${config.adrDir}/`) ||
    p === CONFIG_FILE ||
    p.startsWith(".decision-protocol/") ||
    p === ".github/workflows/decision-protocol.yml" ||
    config.rules.some((r) => posix.normalize(r) === p);
  if (ruleFile) return { decision: "ask", reason: `${p} defines the decision rules. Confirm the user asked for this change.` };
  if (!isProtectedFile(config, p)) return allow;
  const deny = (why) => ({
    decision: "deny",
    reason: `${p} is a protected area: ${why}. Write .claude/intent.json {"decision":"ADR-NNNN.Dn","type":"${config.commitTypes.join("|")}"[,"observed","expected","cause","impact" for fix]} naming an accepted protected decision that covers this file. If none exists, propose an ADR and stop.`,
  });
  const f = join(root, ".claude/intent.json");
  if (!existsSync(f)) return deny("no .claude/intent.json");
  let i;
  try {
    i = JSON.parse(readFileSync(f, "utf8"));
  } catch {
    return deny("intent.json is not valid JSON");
  }
  const d = ctx.decisions.get(i?.decision);
  if (!d || d.state !== "accepted" || !d.protected) return deny(`'${i?.decision}' is not an accepted protected decision`);
  if (!covers(d, p)) return deny(`${d.id} does not cover this file`);
  if (!config.commitTypes.includes(i.type)) return deny(`type must be one of ${config.commitTypes.join(", ")}`);
  if (i.type === "fix") {
    const missing = FIX_FIELDS.filter((k) => !String(i[k] ?? "").trim());
    if (missing.length) return deny(`fix intent is missing ${missing.join(", ")}`);
  }
  return allow;
}

// ---- env file guard -----------------------------------------------------
export function envFiles(paths) {
  return paths.filter((f) => {
    const b = posix.basename(f);
    return /^\.env(\..+)?$/.test(b) && !ENV_ALLOWED.test(b);
  });
}

// ---- CLI ----------------------------------------------------------------
function fail(errs, code = 1) {
  if (!errs.length) return;
  for (const e of errs) console.error(`decision-protocol: ${e}`);
  process.exit(code);
}
const git = (root, ...a) => spawnSync("git", a, { cwd: root, encoding: "utf8" }).stdout ?? "";

async function main() {
  const argv = process.argv.slice(2);
  let root;
  const ri = argv.indexOf("--root");
  if (ri >= 0) root = resolve(argv.splice(ri, 2)[1]);
  const [cmd, arg] = argv;
  if (cmd === "version") return console.log(VERSION);
  root ??= (spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).stdout || "").trim() || process.cwd();
  if (!cmd || !["check", "status", "commit-msg", "gate", "run-tests", "guard-env"].includes(cmd))
    fail(["usage: dp.mjs check [--stdin] | status | commit-msg <file> [--commit <sha>] | gate | run-tests | guard-env | version"], 64);

  let config;
  try {
    config = loadConfig(root);
  } catch (e) {
    return fail([`${CONFIG_FILE} is not valid JSON: ${e.message}`]);
  }
  if (!config) return fail([`${CONFIG_FILE} not found in ${root}. Run the 'init' skill first.`]);

  if (cmd === "guard-env") {
    const bad = envFiles(git(root, "diff", "--cached", "--name-only", "--diff-filter=ACMR").split("\n").filter(Boolean));
    fail(bad.map((f) => `${f} is an environment file and may hold secrets. Unstage it with 'git restore --staged ${f}' and add it to .gitignore (only .env.example style templates may be committed)`));
  } else if (cmd === "run-tests") {
    if (!config.testCommand.trim()) return console.log(`decision-protocol: no "testCommand" in ${CONFIG_FILE}; skipping tests`);
    const r = spawnSync(config.testCommand, { cwd: root, shell: true, stdio: "inherit" });
    process.exit(r.status ?? 1);
  } else if (cmd === "status") {
    const a = await analyze(root, config);
    const f = join(root, config.statusFile);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, statusText(a));
    console.log(`${config.statusFile} updated`);
  } else if (cmd === "check") {
    if (arg === "--stdin") {
      const file = JSON.parse(readFileSync(0, "utf8") || "{}")?.tool_input?.file_path ?? "";
      const p = file ? relative(root, resolve(root, file)) : "";
      if (!p || p.startsWith("..") || !(isGoverned(config, p) || isProtectedFile(config, p))) process.exit(0);
      fail((await analyze(root, config, p)).ctx.errors, 2);
      return;
    }
    const a = await analyze(root, config);
    for (const g of gaps(a)) console.log(`gap: ${g}`);
    fail(a.ctx.errors);
    console.log("decision-protocol check passed");
  } else if (cmd === "commit-msg") {
    const sha = argv[2] === "--commit" ? argv[3] : undefined;
    const files = (sha ? git(root, "diff-tree", "--no-commit-id", "--name-only", "-r", sha) : git(root, "diff", "--cached", "--name-only")).split("\n").filter(Boolean);
    const diff = sha ? git(root, "show", sha, "-U0", "--format=", "--no-color") : git(root, "diff", "--cached", "-U0", "--no-color");
    const ctx = load(root, config);
    fail(checkCommit(ctx, readFileSync(arg, "utf8"), files, addedTestLines(config, diff)));
  } else if (cmd === "gate") {
    const input = JSON.parse(readFileSync(0, "utf8") || "{}");
    const v = gate(load(root, config), input?.tool_input?.file_path ?? "");
    if (v.decision === "deny") fail([v.reason], 2);
    if (v.decision === "ask")
      console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: v.reason } }));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) await main();
