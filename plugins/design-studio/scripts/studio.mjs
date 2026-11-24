#!/usr/bin/env node
// Local offline design-studio CLI (zero dependencies, Node 18+).
// Commands:
//   node studio.mjs bootstrap --target <repo> [--with-demo] [--overwrite <rel>]...
//   node studio.mjs sync-tokens --target <repo> [--design <path>]
//   node studio.mjs check --target <repo>
//   node studio.mjs version
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(here, "..");
const VALID_STATUSES = new Set(["draft", "review", "approved"]);

export function safeRelPath(label, p) {
  if (typeof p !== "string" || !p.trim()) throw new Error(`${label} must be a non-empty relative path`);
  if (isAbsolute(p)) throw new Error(`${label} must be relative: ${p}`);
  const norm = normalize(p).replace(/\\/g, "/");
  if (norm === ".." || norm.startsWith("../") || norm.includes("/../")) {
    throw new Error(`${label} escapes workspace: ${p}`);
  }
  return norm;
}

function unquote(raw) {
  const s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function stripInlineComment(raw) {
  let quote = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      if (ch === quote && raw[i - 1] !== "\\") quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "#" && (i === 0 || /\s/.test(raw[i - 1]))) {
      return raw.slice(0, i).trim();
    }
  }
  return raw.trim();
}

export function parseDesignFrontmatter(markdown) {
  const m = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!m) throw new Error("DESIGN.md is missing YAML frontmatter (--- ... ---)");

  const result = {};
  let section = null;
  for (const rawLine of m[1].split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) continue;
    const indent = rawLine.match(/^(\s*)/)[1].length;
    const cleaned = stripInlineComment(rawLine);
    const colonIdx = cleaned.indexOf(":");
    if (colonIdx === -1) continue;

    const key = cleaned.slice(0, colonIdx).trim();
    const val = cleaned.slice(colonIdx + 1).trim();

    if (indent === 0) {
      if (!val) {
        section = key;
        result[section] = {};
      } else {
        section = null;
        result[key] = unquote(val);
      }
    } else if (section) {
      result[section][key] = unquote(val);
    }
  }
  return result;
}

export function tokensCssFromDesign(markdown) {
  const fm = parseDesignFrontmatter(markdown);
  const lines = [":root {"];
  const emitSection = (sectionName, prefix) => {
    const obj = fm[sectionName];
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== "") lines.push(`  --${prefix}${k}: ${v};`);
    }
  };
  emitSection("colors", "color-");
  emitSection("typography", "");
  emitSection("radii", "radius-");
  emitSection("spacing", "space-");
  emitSection("motion", "motion-");

  if (lines.length === 1) throw new Error("DESIGN.md frontmatter defines no token sections");
  lines.push("}", "");
  return lines.join("\n");
}

export function syncTokens(targetDir, designRel = "DESIGN.md") {
  const root = resolve(targetDir);
  const designPath = join(root, safeRelPath("design", designRel));
  if (!existsSync(designPath)) {
    throw new Error(`Missing ${designRel} at ${designPath}`);
  }
  const md = readFileSync(designPath, "utf8");
  const css = tokensCssFromDesign(md);
  const outPath = join(root, ".design/tokens.css");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, css);
  return { outPath, tokenCount: (css.match(/^\s+--/gm) || []).length };
}

export function bootstrapWorkspace(targetDir, { withDemo = false, overwrite = new Set() } = {}) {
  const root = resolve(targetDir);
  if (!existsSync(root)) throw new Error(`Target directory does not exist: ${root}`);

  const readPlugin = (rel) => readFileSync(join(pluginRoot, rel), "utf8");
  const files = [
    { rel: "DESIGN.md", text: readPlugin("templates/DESIGN.md") },
    { rel: ".design/index.html", text: readPlugin("assets/studio.html") },
  ];

  if (withDemo) {
    files.push({ rel: ".design/frames.json", text: readPlugin("templates/demo/frames.json") });
    const demoDir = join(pluginRoot, "templates/demo/frames");
    for (const name of readdirSync(demoDir).sort()) {
      if (name.endsWith(".html")) {
        files.push({ rel: `.design/frames/${name}`, text: readPlugin(`templates/demo/frames/${name}`) });
      }
    }
  } else {
    files.push({
      rel: ".design/frames.json",
      text: `${JSON.stringify({ project: "Workspace", frames: [] }, null, 2)}\n`,
    });
  }

  mkdirSync(join(root, ".design/frames"), { recursive: true });
  const results = [];
  for (const f of files) {
    const abs = join(root, f.rel);
    let state = "created";
    if (existsSync(abs)) {
      if (readFileSync(abs, "utf8") === f.text) {
        results.push({ rel: f.rel, state: "unchanged" });
        continue;
      }
      if (!overwrite.has(f.rel)) {
        results.push({ rel: f.rel, state: "differs" });
        continue;
      }
      state = "overwritten";
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, f.text);
    results.push({ rel: f.rel, state });
  }
  return results;
}

export function extractGotoTargets(html) {
  const targets = new Set();
  const attrRe = /data-goto\s*=\s*(?:"([^"]+)"|'([^']+)')/g;
  let m;
  while ((m = attrRe.exec(html)) !== null) targets.add((m[1] ?? m[2]).trim());

  const msgRe = /studio:goto['"]\s*,\s*to\s*:\s*['"]([^'"]+)['"]/g;
  while ((m = msgRe.exec(html)) !== null) targets.add(m[1].trim());
  return [...targets];
}

export function checkWorkspace(targetDir) {
  const root = resolve(targetDir);
  const designDir = join(root, ".design");
  const manifestPath = join(designDir, "frames.json");
  const problems = [];

  if (!existsSync(manifestPath)) {
    return { ok: false, frameCount: 0, linkCount: 0, problems: ["Missing .design/frames.json"] };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    return { ok: false, frameCount: 0, linkCount: 0, problems: [`Invalid .design/frames.json: ${err.message}`] };
  }

  if (!manifest || !Array.isArray(manifest.frames)) {
    return { ok: false, frameCount: 0, linkCount: 0, problems: [".design/frames.json must contain a frames array"] };
  }

  const ids = new Set();
  for (const f of manifest.frames) {
    if (!f || typeof f.id !== "string" || !f.id.trim()) {
      problems.push("Frame entry is missing a non-empty string id");
      continue;
    }
    if (ids.has(f.id)) problems.push(`Duplicate frame id '${f.id}'`);
    ids.add(f.id);
    if (f.status && !VALID_STATUSES.has(f.status)) {
      problems.push(`Frame '${f.id}' has invalid status '${f.status}' (expected draft|review|approved)`);
    }
  }

  if (manifest.entry && !ids.has(manifest.entry)) {
    problems.push(`Manifest entry '${manifest.entry}' does not match any frame id`);
  }

  let linkCount = 0;
  for (const f of manifest.frames) {
    if (!f || !f.id) continue;
    let relFile;
    try {
      relFile = safeRelPath(`frame '${f.id}' file`, f.file);
    } catch (err) {
      problems.push(err.message);
      continue;
    }

    const absFile = resolve(designDir, relFile);
    if (relative(designDir, absFile).startsWith("..")) {
      problems.push(`Frame '${f.id}' file escapes .design/: ${f.file}`);
      continue;
    }
    if (!existsSync(absFile)) {
      problems.push(`Frame '${f.id}' file not found: .design/${relFile}`);
      continue;
    }

    if (Array.isArray(f.links)) {
      for (const lk of f.links) {
        linkCount += 1;
        if (!lk || typeof lk.to !== "string" || !ids.has(lk.to)) {
          problems.push(`Frame '${f.id}' link points to unknown frame '${lk?.to ?? ""}'`);
        }
      }
    }

    const html = readFileSync(absFile, "utf8");
    for (const target of extractGotoTargets(html)) {
      if (!ids.has(target)) {
        problems.push(`Frame '${f.id}' (${relFile}) has broken data-goto target '${target}'`);
      }
    }
  }

  return { ok: problems.length === 0, frameCount: manifest.frames.length, linkCount, problems };
}

function getVersion() {
  return JSON.parse(readFileSync(join(pluginRoot, ".claude-plugin/plugin.json"), "utf8")).version;
}

function runCli() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const opt = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
  const flag = (name) => args.includes(name);

  if (cmd === "version") {
    console.log(`design-studio ${getVersion()}`);
    return;
  }

  const target = opt("--target")[0] ?? process.cwd();

  if (cmd === "bootstrap") {
    const results = bootstrapWorkspace(target, {
      withDemo: flag("--with-demo"),
      overwrite: new Set(opt("--overwrite")),
    });
    for (const r of results) console.log(`${r.state} ${r.rel}`);
    console.log(`bootstrapped design-studio ${getVersion()}`);
    return;
  }

  if (cmd === "sync-tokens") {
    const designRel = opt("--design")[0] ?? "DESIGN.md";
    const { tokenCount } = syncTokens(target, designRel);
    console.log(`synced ${tokenCount} tokens to .design/tokens.css`);
    return;
  }

  if (cmd === "check") {
    const res = checkWorkspace(target);
    if (!res.ok) {
      for (const p of res.problems) console.error(`ERROR: ${p}`);
      process.exit(1);
    }
    console.log(`ok: ${res.frameCount} frame(s), ${res.linkCount} link(s) verified`);
    return;
  }

  console.error(
    "usage: node studio.mjs <bootstrap|sync-tokens|check|version> [--target <dir>] [--with-demo] [--overwrite <rel>]"
  );
  process.exit(64);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  }
}
