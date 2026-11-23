#!/usr/bin/env node
// decision-protocol checker. Dependency-free, Node.js 18+.
// Commands: check [--stdin] | status | commit-msg <file> [--commit <sha>] | gate | run-tests | guard-env | version
// Global option: --root <dir> (default: git top level of the working directory).
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Replaced with the plugin version when the checker is vendored into a repository. */
export const VERSION = "__DP_VERSION__";

const DECISION_ID = /ADR-[0-9]{4}\.D[0-9]+/g;
const STATES = [
  "proposed",
  "accepted",
  "superseded",
  "rejected",
];
const FIX_FIELDS = [
  "observed",
  "expected",
  "cause",
  "impact",
];
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
const DEFAULT_TEST_PATTERNS = ["**/*.test.*", "**/*.spec.*", "**/*_test.*", "**/test_*.py", "**/test/**", "**/tests/**", "**/__tests__/**"];

/** Accepts only project-relative paths that stay inside the project. Returns the normalized path. */
export function safeRelPath(name, value) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`"${name}" must be a non-empty string`);
  const v = value.replace(/\\/g, "/");
  if (v.startsWith("/") || /^[A-Za-z]:/.test(v)) throw new Error(`"${name}" must be relative to the project (got '${value}')`);
  const norm = posix.normalize(v);
  if (norm.split("/").includes("..")) throw new Error(`"${name}" must stay inside the project (got '${value}')`);
  return norm.replace(/\/+$/, "") || ".";
}

function stringList(raw, key, fallback) {
  const v = raw[key] ?? fallback;
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw new Error(`"${key}" must be an array of strings`);
  return v;
}

export function loadConfig(root) {
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) return null;
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const adrDir = safeRelPath("adrDir", raw.adrDir ?? "docs/adr");
  const prdPaths = stringList(raw, "prdPaths", ["docs/prd/*.md"]);
  prdPaths.forEach((g) => safeRelPath("prdPaths", g));
  const rules = stringList(raw, "rules", []);
  rules.forEach((r) => safeRelPath("rules", r));
  return {
    scopes: stringList(raw, "scopes", []),
    adrDir,
    prdPaths,
    governed: stringList(raw, "governed", []),
    exempt: stringList(raw, "exempt", []),
    protected: stringList(raw, "protected", []),
    testPatterns: stringList(raw, "testPatterns", DEFAULT_TEST_PATTERNS),
    testCommand: String(raw.testCommand ?? ""),
    rules,
    commitTypes: stringList(raw, "commitTypes", ["feat", "fix", "refactor", "test", "perf"]),
    requireUseCase: raw.requireUseCase ?? true,
    statusFile: safeRelPath("statusFile", raw.statusFile ?? `${adrDir}/STATUS.md`),
  };
}

const isTest = (c, p) => matches(c.testPatterns, p);
export const isGoverned = (c, p) => matches(c.governed, p) && !matches(c.exempt, p) && !isTest(c, p);
const isProtectedFile = (c, p) => matches(c.protected, p) && !matches(c.exempt, p) && !isTest(c, p);
const coveredBy = (decision, p) => matches(decision.paths, p);

function listFiles(root) {
  const r = spawnSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" });
  if (r.status === 0) return r.stdout.split("\0").filter((f) => f && existsSync(join(root, f))).sort();
  const found = [];
  const descend = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (!entry.isDirectory()) found.push(rel);
      else if (entry.name !== "node_modules" && entry.name !== ".git") descend(rel);
    }
  };
  descend("");
  return found.sort();
}

/** Writes a file below root, refusing targets that resolve (through symlinks) outside it. */
function writeInside(root, rel, text) {
  const abs = resolve(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  const realRoot = realpathSync(root);
  const realDir = realpathSync(dirname(abs));
  if (realDir !== realRoot && !realDir.startsWith(realRoot + sep)) throw new Error(`${rel} resolves outside the project`);
  writeFileSync(abs, text);
}

// ---- loading decisions and use cases ------------------------------------
export function load(root, config, files = listFiles(root)) {
  const ctx = { root, config, decisions: new Map(), useCases: new Set(), problems: [] };
  const complain = (msg) => ctx.problems.push(msg);
  const numbers = new Map();
  const adrFiles = files.filter((f) => f.startsWith(`${config.adrDir}/`) && /^\d{4}-[^/]*\.md$/.test(posix.basename(f)));

  for (const file of adrFiles) {
    const num = posix.basename(file).slice(0, 4);
    const folder = posix.dirname(file.slice(config.adrDir.length + 1));
    const scope = folder === "." ? "default" : folder.split("/")[0];
    if (config.scopes.length && !config.scopes.includes(scope))
      complain(`${file}: folder '${scope}' is not one of the "scopes" in ${CONFIG_FILE} (${config.scopes.join(", ")})`);
    if (numbers.has(num)) complain(`${file}: ADR number ${num} is also used by ${numbers.get(num)}`);
    numbers.set(num, file);

    const block = readFileSync(join(root, file), "utf8").replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/);
    if (!block) {
      complain(`${file}: no front matter block found`);
      continue;
    }
    let meta;
    try {
      meta = parseYaml(block[1]);
    } catch (e) {
      complain(`${file}: front matter could not be parsed (${e.message})`);
      continue;
    }
    if (meta?.adr !== `ADR-${num}`) complain(`${file}: front matter 'adr' should read ADR-${num}`);
    for (const [key, entry] of Object.entries(meta?.decisions ?? {})) {
      const id = `${meta?.adr}.${key}`;
      if (!/^D\d+$/.test(key) || !STATES.includes(entry?.state) || !entry?.title)
        complain(`${file}: ${id} requires a title and a state, one of ${STATES.join("|")}`);
      const decision = {
        id,
        file,
        title: String(entry?.title ?? ""),
        state: entry?.state,
        paths: entry?.paths ?? [],
        protected: entry?.protected === true,
        use_cases: entry?.use_cases ?? [],
        superseded_by: entry?.superseded_by,
        scope: String(meta?.scope ?? scope),
      };
      ctx.decisions.set(id, decision);
    }
  }
  for (const file of files) {
    if (!matches(config.prdPaths, file) || !file.endsWith(".md") || posix.basename(file).startsWith("_")) continue;
    for (const hit of readFileSync(join(root, file), "utf8").matchAll(/^(?:\|\s*|#+\s*)([A-Z][A-Z0-9]*-\d+)\b/gm)) ctx.useCases.add(hit[1]);
  }
  return ctx;
}

// ---- source scanning ----------------------------------------------------
/** Why a tag cannot be honored, or undefined when it is fine. */
function tagFault(ctx, p, id) {
  const d = ctx.decisions.get(id) ?? null;
  if (!d) return `${p}: @adr refers to ${id}, which no ADR defines`;
  if (d.state === "superseded") return `${p}: ${id} was superseded${d.superseded_by ? ` by ${d.superseded_by}` : ""}; tag the replacement`;
  if (d.state !== "accepted") return `${p}: ${id} is still '${d.state}'; only accepted decisions may be implemented`;
  if (!coveredBy(d, p)) return `${p}: ${id} governs ${d.paths.join(", ") || "no paths"}, not this file`;
}

/** Blanks comments and string contents (keeping offsets and newlines) so exports are only found in code. */
function maskNonCode(src) {
  let out = "";
  let i = 0;
  const blankTo = (end) => {
    out += src.slice(i, end).replace(/[^\n]/g, " ");
    i = end;
  };
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      const nl = src.indexOf("\n", i);
      blankTo(nl < 0 ? src.length : nl);
    } else if (c === "/" && next === "*") {
      const close = src.indexOf("*/", i + 2);
      blankTo(close < 0 ? src.length : close + 2);
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c && !(c !== "`" && src[j] === "\n")) j += src[j] === "\\" ? 2 : 1;
      blankTo(Math.min(j + 1, src.length));
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const EXPORT_FORMS = new RegExp(
  "^[ \\t]*(?:" +
    "export\\s+(?:declare\\s+)?(?:default\\s+)?(?:async\\s+)?(?:abstract\\s+)?(function\\*?|class|const|let|var|enum|namespace)\\b\\s*([A-Za-z_$][\\w$]*)?" +
    "|export\\s+default\\b" +
    "|export\\s*\\*" +
    "|export\\s*\\{(?!\\s*\\})" +
    "|module\\.exports\\b" +
    "|exports\\.[\\w$]+\\s*=" +
    ")",
  "gm",
);

/** True when the closest comment above line k is a block carrying an @adr tag (decorator lines are skipped). */
function hasDecisionDoc(lines, k) {
  let j = k - 1;
  while (j >= 0 && (lines[j].trim() === "" || /^\s*@[\w.]+/.test(lines[j]))) j--;
  if (j < 0 || !lines[j].trim().endsWith("*/")) return false;
  let start = j;
  while (start > 0 && !lines[start].includes("/*")) start--;
  return /@adr\b[^\n]*ADR-\d{4}\.D\d+/.test(lines.slice(start, j + 1).join("\n"));
}

/** Checks one governed file; returns the decision ids it implements and records problems on ctx. */
function scanSource(ctx, p, text) {
  const implemented = new Set();
  let tagCount = 0;
  for (const m of text.matchAll(/@adr\b(.*)/g)) {
    const ids = m[1].match(DECISION_ID);
    if (!ids) ctx.problems.push(`${p}: unreadable @adr tag '${m[0].trim()}'; write ADR-NNNN.Dn`);
    for (const id of ids || []) {
      tagCount++;
      const fault = tagFault(ctx, p, id);
      if (fault) ctx.problems.push(fault);
      else implemented.add(id);
    }
  }
  if (!JS_FILE.test(p)) {
    if (!tagCount) ctx.problems.push(`${p}: governed file carries no @adr comment; add one naming the decision it implements`);
    return Array.from(implemented);
  }
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const code = maskNonCode(lines.join("\n"));
  for (const m of code.matchAll(EXPORT_FORMS)) {
    const k = code.slice(0, m.index).split("\n").length - 1;
    if (hasDecisionDoc(lines, k)) continue;
    const name = m[2] ?? (m[1] ? "default" : m[0].trim().replace(/\s+/g, " "));
    ctx.problems.push(`${p}: '${name}' is exported without an @adr tag; every governed export must name the decision it implements`);
  }
  return Array.from(implemented);
}

function requireProtectedDecision(ctx, p) {
  const backed = [...ctx.decisions.values()].some((d) => d.protected && d.state === "accepted" && coveredBy(d, p));
  if (!backed) ctx.problems.push(`${p}: lies in a protected path but no accepted decision with protected: true covers it; record that decision first`);
}

async function loadRules(ctx) {
  const loaded = [];
  for (const rel of ctx.config.rules) {
    try {
      loaded.push((await import(pathToFileURL(resolve(ctx.root, rel)).href)).default);
    } catch (e) {
      ctx.problems.push(`rule module ${rel} failed to load: ${e.message}`);
    }
  }
  return loaded.filter(Boolean);
}

// ---- repository-wide analysis -------------------------------------------
export async function analyze(root, config, only) {
  const files = listFiles(root);
  const ctx = load(root, config, files);
  const implementedIn = new Map();
  const testedBy = new Map();
  const record = (map, key, file) => map.set(key, [...new Set([...(map.get(key) ?? []), file])]);
  const rules = await loadRules(ctx);
  const forRule = (extra) => ({ root, config, decisions: ctx.decisions, ...extra });

  for (const p of files) {
    if (only !== undefined && only !== p) continue;
    if (isProtectedFile(config, p)) requireProtectedDecision(ctx, p);
    if (isGoverned(config, p)) {
      const text = readFileSync(join(root, p), "utf8");
      for (const id of scanSource(ctx, p, text)) record(implementedIn, id, p);
      for (const rule of rules)
        for (const msg of (await rule.checkFile?.(forRule({ path: p, text }))) ?? []) ctx.problems.push(`${p}: [${rule.name ?? "rule"}] ${msg}`);
    }
    if (isTest(config, p)) {
      for (const m of readFileSync(join(root, p), "utf8").matchAll(/\[(ADR-\d{4}\.D\d+)\]/g)) {
        if (!only && !ctx.decisions.has(m[1])) ctx.problems.push(`${p}: test cites ${m[1]}, which no ADR defines`);
        record(testedBy, m[1], p);
      }
    }
  }
  if (only) {
    ctx.problems = ctx.problems.filter((e) => e.startsWith(`${only}:`));
    return { ctx, testedBy, implementedIn };
  }

  for (const d of [...ctx.decisions.values()]) {
    if (config.requireUseCase && d.state !== "rejected" && !d.use_cases.length) ctx.problems.push(`${d.id}: lists no use case, but at least one PRD use case is required`);
    for (const u of d.use_cases) if (!ctx.useCases.has(u)) ctx.problems.push(`${d.id}: use case ${u} was not found in the PRD files (${config.prdPaths.join(", ")})`);
    if (d.state === "accepted" && !d.paths.length) ctx.problems.push(`${d.id}: accepted decisions must list the 'paths' they govern`);
    if (d.state === "superseded" && !ctx.decisions.has(d.superseded_by)) ctx.problems.push(`${d.id}: marked superseded without a valid 'superseded_by' target`);
    if (d.state === "accepted" && d.protected && !testedBy.has(d.id) && implementedIn.has(d.id))
      ctx.problems.push(`${d.id}: protected decision has code but no test whose title starts with [${d.id}]`);
  }
  for (const rule of rules) for (const msg of (await rule.checkRepo?.(forRule({ files }))) ?? []) ctx.problems.push(`[${rule.name ?? "rule"}] ${msg}`);
  const result = { ctx, implementedIn, testedBy };
  const statusPath = join(root, config.statusFile);
  if (!existsSync(statusPath) || readFileSync(statusPath, "utf8") !== statusText(result))
    ctx.problems.push(`${config.statusFile} is out of date or missing; regenerate it with the 'status' command`);
  return result;
}

function progress(a, d) {
  if (d.state !== "accepted") return d.state;
  if (!a.implementedIn.has(d.id)) return "accepted, no code yet";
  return a.testedBy.has(d.id) ? "accepted, code and test present" : "accepted, code present, no test";
}

export const gaps = (a) =>
  [...a.ctx.decisions.values()].filter((d) => d.state === "accepted" && !(a.implementedIn.has(d.id) && a.testedBy.has(d.id))).map((d) => `${d.id} (${progress(a, d)})`);

export function statusText(a) {
  const files = (xs) => (xs?.length ? xs.map((x) => `\`${x}\``).join("<br>") : "-");
  const all = [...a.ctx.decisions.values()].sort((x, y) => x.id.localeCompare(y.id, "en", { numeric: true }));
  const out = [
    "# Decision status",
    "",
    "Generated file; change the ADRs or the code, then run the `status` command. Code lists files tagged `@adr`. Tests lists test files with a `[ADR-NNNN.Dn]` marker.",
  ];
  for (const scope of [...new Set(all.map((d) => d.scope))].sort()) {
    out.push("", `## ${scope}`, "", "| ID | Decision | Status | Use cases | Code | Tests |", "|:--|:--|:--|:--|:--|:--|");
    for (const d of all.filter((x) => x.scope === scope))
      out.push(`| ${d.id} | ${d.title} | ${progress(a, d)}${d.protected ? " (protected)" : ""} | ${d.use_cases.join(", ") || "-"} | ${files(a.implementedIn.get(d.id))} | ${files(a.testedBy.get(d.id))} |`);
  }
  return out.join("\n") + "\n";
}

// ---- commit message -----------------------------------------------------
/**
 * `kind` carries facts verified from git, never from the message: { merge: true } for a real merge
 * (several parents, or MERGE_HEAD present), { revert: true } for a verified revert.
 */
export function checkCommit(ctx, raw, files, addedTestText, kind = {}) {
  const { config } = ctx;
  const text = raw.split("\n").filter((l) => !l.startsWith("#")).join("\n").trim();
  const subject = text.split("\n")[0] ?? "";
  if (kind.merge) return [];
  if (kind.revert && /^Revert /.test(subject)) return [];
  if (/^(docs|chore)\(no-adr\): \S/.test(subject)) {
    const touched = files.filter((f) => isGoverned(config, f) || isProtectedFile(config, f));
    return touched.length ? [`a (no-adr) commit may not include governed or protected files (${touched.join(", ")}); cite a decision instead`] : [];
  }
  const head = subject.match(/^(\w+)\(([^)]*)\): \S/);
  if (!head || !config.commitTypes.includes(head[1]))
    return [`first line should look like 'type(ADR-NNNN.Dn): summary' with type one of ${config.commitTypes.join("|")}, or 'docs(no-adr): ...' / 'chore(no-adr): ...'; found '${subject}'`];
  const cited = head[2].split(/\s*,\s*/);
  const problems = [];
  for (const id of cited) {
    const d = ctx.decisions.get(id) ?? null;
    if (!d || !/^ADR-\d{4}\.D\d+$/.test(id)) problems.push(`${id} is not a decision defined in any ADR`);
    else if (d.state !== "accepted") problems.push(`${id} has state '${d.state}' and cannot be cited`);
  }
  if (head[1] === "fix") {
    for (const field of FIX_FIELDS)
      if (!new RegExp(`^${field}: \\S`, "im").test(text)) problems.push(`fix commits need a line starting '${field[0].toUpperCase() + field.slice(1)}:'`);
    const expected = text.match(/^expected: (.*)$/im)?.[1] ?? "";
    if (!cited.some((id) => expected.includes(id))) problems.push(`the Expected line must quote the restored decision (${cited.join(", ")})`);
    if (!cited.some((id) => addedTestText.includes(`[${id}]`))) problems.push(`a fix must add a test containing [${cited[0]}]`);
  }
  return problems;
}

function addedTestLines(config, diff) {
  let current = "";
  const added = [];
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) current = line.slice(4).replace(/^b\//, "");
    else if (line.startsWith("+") && isTest(config, current)) added.push(line);
  }
  return added.join("\n");
}

// ---- Claude gate --------------------------------------------------------
export function gate(ctx, file) {
  const { config, root } = ctx;
  const p = isAbsolute(file) ? relative(root, file) : file;
  const allow = { decision: "allow", reason: "" };
  if (!p || p.startsWith("..")) return allow;
  const rulesFile =
    p.startsWith(`${config.adrDir}/`) ||
    p === CONFIG_FILE ||
    p.startsWith(".decision-protocol/") ||
    p === ".github/workflows/decision-protocol.yml" ||
    config.rules.some((r) => posix.normalize(r) === p);
  if (rulesFile) return { decision: "ask", reason: `${p} is part of the decision rules; proceed only if the user asked for this change.` };
  if (!isProtectedFile(config, p)) return allow;
  const refuse = (why) => ({
    decision: "deny",
    reason: `${p} is in a protected path (${why}). Create .claude/intent.json with {"decision": "ADR-NNNN.Dn", "type": "${config.commitTypes.join("|")}"} (plus observed, expected, cause, impact for a fix) naming an accepted protected decision that covers this file; if there is none, propose an ADR and stop.`,
  });
  const intentFile = join(root, ".claude/intent.json");
  if (!existsSync(intentFile)) return refuse("no .claude/intent.json found");
  let intent;
  try {
    intent = JSON.parse(readFileSync(intentFile, "utf8"));
  } catch {
    return refuse("intent.json cannot be parsed as JSON");
  }
  const d = ctx.decisions.get(intent?.decision);
  if (!d || d.state !== "accepted" || !d.protected) return refuse(`${intent?.decision} is not an accepted protected decision`);
  if (!coveredBy(d, p)) return refuse(`${d.id} does not govern this file`);
  if (!config.commitTypes.includes(intent.type)) return refuse(`type must be one of ${config.commitTypes.join(", ")}`);
  if (intent.type === "fix") {
    const lacking = FIX_FIELDS.filter((k) => !String(intent[k] ?? "").trim());
    if (lacking.length) return refuse(`a fix intent also needs ${lacking.join(", ")}`);
  }
  return allow;
}

// ---- environment file guard ---------------------------------------------
export function envFiles(paths) {
  return paths.filter((f) => /^\.env(\..+)?$/.test(posix.basename(f)) && !ENV_ALLOWED.test(posix.basename(f)));
}

// ---- command line -------------------------------------------------------
const COMMANDS = ["check", "status", "commit-msg", "gate", "run-tests", "guard-env"];

function die(messages, code = 1) {
  if (!messages.length) return;
  for (const m of messages) console.error(`decision-protocol: ${m}`);
  process.exit(Number(code));
}

const gitOut = (root, ...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" }).stdout ?? "";
const gitOk = (root, ...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" }).status === 0;
const NO_RENAMES = ["--no-renames", "--no-color", "--no-ext-diff"];

/** Facts about the commit being checked, taken from git rather than from the message. */
function commitFacts(root, message, sha) {
  let merge;
  let pendingRevert = false;
  let files;
  let diff;
  if (sha) {
    merge = gitOut(root, "rev-list", "--parents", "-n", "1", sha).trim().split(/\s+/).length > 2;
    files = gitOut(root, "diff-tree", "--no-commit-id", "--name-only", "-r", ...NO_RENAMES, sha);
    diff = gitOut(root, "show", "-U0", "--format=", ...NO_RENAMES, sha);
  } else {
    const gitDir = resolve(root, gitOut(root, "rev-parse", "--git-dir").trim() || ".git");
    merge = existsSync(join(gitDir, "MERGE_HEAD"));
    pendingRevert = existsSync(join(gitDir, "REVERT_HEAD"));
    files = gitOut(root, "diff", "--cached", "--name-only", ...NO_RENAMES);
    diff = gitOut(root, "diff", "--cached", "-U0", ...NO_RENAMES);
  }
  const named = message.match(/^This reverts commit ([0-9a-f]{7,40})\b/m)?.[1];
  const revert = pendingRevert || Boolean(named && gitOk(root, "cat-file", "-e", `${named}^{commit}`));
  return { kind: { merge, revert }, files: files.split("\n").filter(Boolean), diff };
}

async function main() {
  const argv = process.argv.slice(2);
  let root;
  const flag = argv.indexOf("--root");
  if (flag >= 0) root = resolve(argv.splice(flag, 2)[1]);
  const [cmd, arg] = argv;
  if (cmd === "version") return console.log(VERSION);
  if (!COMMANDS.includes(cmd)) die([`usage: dp.mjs ${COMMANDS.join(" | ")} | version   (commit-msg <file> [--commit <sha>], check [--stdin])`], 64);
  root ??= gitOut(process.cwd(), "rev-parse", "--show-toplevel").trim() || process.cwd();

  let config;
  try {
    config = loadConfig(root);
  } catch (e) {
    return die([`${CONFIG_FILE} is invalid: ${e.message}`]);
  }
  if (!config) return die([`${CONFIG_FILE} is missing in ${root}; run the 'init' skill first`]);

  switch (cmd) {
    case "guard-env": {
      const staged = gitOut(root, "diff", "--cached", "--name-only", "--diff-filter=ACMR", ...NO_RENAMES).split("\n").filter(Boolean);
      return die(envFiles(staged).map((f) => `${f} looks like an environment file that may hold secrets and cannot be committed. Unstage it ('git restore --staged ${f}') and ignore it; templates such as .env.example are fine`));
    }
    case "run-tests": {
      if (!config.testCommand.trim()) return console.log(`decision-protocol: ${CONFIG_FILE} has no "testCommand"; skipping tests`);
      return process.exit(spawnSync(config.testCommand, { cwd: root, shell: true, stdio: "inherit" }).status ?? 1);
    }
    case "status": {
      const a = await analyze(root, config);
      writeInside(root, config.statusFile, statusText(a));
      return console.log(`${config.statusFile} written`);
    }
    case "check": {
      if (argv.includes("--stdin")) {
        const target = JSON.parse(readFileSync(0, "utf8") || "{}")?.tool_input?.file_path ?? "";
        const p = target ? relative(root, resolve(root, target)) : "";
        if (!p || p.startsWith("..") || !(isGoverned(config, p) || isProtectedFile(config, p))) return;
        const one = await analyze(root, config, p);
        return die(one.ctx.problems, 2);
      }
      const a = await analyze(root, config);
      for (const g of gaps(a)) console.log(`open: ${g}`);
      if (a.ctx.problems.length) return die(a.ctx.problems);
      return console.log("decision-protocol: all checks passed");
    }
    case "commit-msg": {
      const sha = argv[2] === "--commit" ? argv[3] : undefined;
      const message = readFileSync(arg, "utf8");
      const facts = commitFacts(root, message, sha);
      return die(checkCommit(load(root, config), message, facts.files, addedTestLines(config, facts.diff), facts.kind));
    }
    case "gate": {
      const input = JSON.parse(readFileSync(0, "utf8") || "{}");
      const verdict = gate(load(root, config), input?.tool_input?.file_path ?? "");
      if (verdict.decision === "deny") return die([verdict.reason], 2);
      if (verdict.decision === "ask")
        console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: verdict.reason } }));
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) await main();
