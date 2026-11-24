// Run with: node --test plugins/design-studio/tests
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  bootstrapWorkspace,
  checkWorkspace,
  extractGotoTargets,
  parseDesignFrontmatter,
  syncTokens,
  tokensCssFromDesign,
} from "../scripts/studio.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(here, "../scripts/studio.mjs");

function tempRepo() {
  return mkdtempSync(join(tmpdir(), "design-studio-"));
}

test("parseDesignFrontmatter and tokensCssFromDesign map all sections", () => {
  const md = `---
name: Demo
colors:
  bg: "#0b0c0e" # dark background
  accent: "#3b82f6"
typography:
  font-sans: "'Inter', sans-serif"
  body-size: "15px"
radii:
  sm: "6px"
spacing:
  unit: "4px"
motion:
  fast: "120ms ease"
---

# Body
`;
  const fm = parseDesignFrontmatter(md);
  assert.equal(fm.colors.bg, "#0b0c0e");
  assert.equal(fm.typography["font-sans"], "'Inter', sans-serif");

  const css = tokensCssFromDesign(md);
  assert.match(css, /--color-bg: #0b0c0e;/);
  assert.match(css, /--color-accent: #3b82f6;/);
  assert.match(css, /--font-sans: 'Inter', sans-serif;/);
  assert.match(css, /--radius-sm: 6px;/);
  assert.match(css, /--space-unit: 4px;/);
  assert.match(css, /--motion-fast: 120ms ease;/);
});

test("bootstrap is idempotent and refuses to overwrite modified files without --overwrite", () => {
  const root = tempRepo();
  const first = bootstrapWorkspace(root);
  assert.ok(first.every((r) => r.state === "created"));
  assert.ok(existsSync(join(root, "DESIGN.md")));
  assert.ok(existsSync(join(root, ".design/index.html")));
  assert.ok(existsSync(join(root, ".design/frames.json")));

  const second = bootstrapWorkspace(root);
  assert.ok(second.every((r) => r.state === "unchanged"));

  // Modify DESIGN.md locally; re-run must report differs and preserve user edits
  writeFileSync(join(root, "DESIGN.md"), "---\ncolors:\n  bg: \"#111111\"\n---\n");
  const third = bootstrapWorkspace(root);
  assert.equal(third.find((r) => r.rel === "DESIGN.md").state, "differs");
  assert.match(readFileSync(join(root, "DESIGN.md"), "utf8"), /#111111/);

  // Explicit overwrite replaces the named file
  const fourth = bootstrapWorkspace(root, { overwrite: new Set(["DESIGN.md"]) });
  assert.equal(fourth.find((r) => r.rel === "DESIGN.md").state, "overwritten");
  assert.match(readFileSync(join(root, "DESIGN.md"), "utf8"), /Default Studio System/);
});

test("bootstrap --with-demo + sync-tokens + check passes with zero broken links", () => {
  const root = tempRepo();
  const res = bootstrapWorkspace(root, { withDemo: true });
  assert.ok(res.some((r) => r.rel === ".design/frames/auth-login.html" && r.state === "created"));

  const synced = syncTokens(root);
  assert.ok(synced.tokenCount >= 20);
  assert.ok(existsSync(join(root, ".design/tokens.css")));

  const check = checkWorkspace(root);
  assert.equal(check.ok, true, check.problems.join("\n"));
  assert.equal(check.frameCount, 5);
  assert.equal(check.linkCount, 10);
});

test("check catches broken entry, broken links, broken data-goto, and path traversal", () => {
  const root = tempRepo();
  bootstrapWorkspace(root);
  writeFileSync(
    join(root, ".design/frames/a.html"),
    '<!DOCTYPE html><button data-goto="missing-screen">Go</button>'
  );
  writeFileSync(
    join(root, ".design/frames.json"),
    JSON.stringify({
      project: "Broken",
      entry: "nonexistent-entry",
      frames: [
        {
          id: "screen-a",
          title: "A",
          file: "frames/a.html",
          status: "invalid-status",
          links: [{ to: "ghost-target", label: "Ghost" }],
        },
        {
          id: "escape",
          title: "Escape",
          file: "../../etc/passwd",
        },
      ],
    })
  );

  const check = checkWorkspace(root);
  assert.equal(check.ok, false);
  const joined = check.problems.join("\n");
  assert.match(joined, /Manifest entry 'nonexistent-entry'/);
  assert.match(joined, /invalid status 'invalid-status'/);
  assert.match(joined, /unknown frame 'ghost-target'/);
  assert.match(joined, /broken data-goto target 'missing-screen'/);
  assert.match(joined, /escapes workspace/);
});

test("extractGotoTargets detects both data-goto attributes and postMessage calls", () => {
  const html = `
    <a data-goto="auth-signup">Sign up</a>
    <form data-goto='ops-dashboard'></form>
    <script>window.parent.postMessage({ type: 'studio:goto', to: 'auth-login' }, '*');</script>
  `;
  assert.deepEqual(extractGotoTargets(html).sort(), ["auth-login", "auth-signup", "ops-dashboard"]);
});

test("CLI end-to-end executes bootstrap, sync-tokens, check, and version", () => {
  const root = tempRepo();
  const run = (args) => spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });

  const ver = run(["version"]);
  assert.equal(ver.status, 0);
  assert.match(ver.stdout, /design-studio 1\.0\.0/);

  const boot = run(["bootstrap", "--target", root, "--with-demo"]);
  assert.equal(boot.status, 0, boot.stderr);
  assert.match(boot.stdout, /created \.design\/index\.html/);

  const sync = run(["sync-tokens", "--target", root]);
  assert.equal(sync.status, 0, sync.stderr);
  assert.match(sync.stdout, /synced \d+ tokens/);

  const chk = run(["check", "--target", root]);
  assert.equal(chk.status, 0, chk.stderr);
  assert.match(chk.stdout, /ok: 5 frame\(s\), 10 link\(s\) verified/);
});
