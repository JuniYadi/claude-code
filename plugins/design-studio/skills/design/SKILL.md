---
name: design
description: Local offline UI design workflow in `.design/`. Use when prototyping screens, generating visual variants, wiring multi-screen flows, tweaking design tokens, critiquing UI layouts, or converting Figma/HTML specs into local frames.
---

Produce and iterate on UI frames as self-contained HTML files inside the gitignored `.design/` workspace, driven by `DESIGN.md` tokens.

## Workflow

Execute in order; satisfy each step's completion criterion before advancing.

### 1. Ensure `.design/` Workspace
If `.design/index.html`, `.design/frames.json`, or `DESIGN.md` is missing, bootstrap cleanly without overwriting existing user files:
```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/studio.mjs" bootstrap --target "$PWD"
```
Done when `DESIGN.md`, `.design/index.html`, `.design/frames.json`, and `.design/frames/` exist.

### 2. Sync Tokens from `DESIGN.md`
Read `DESIGN.md` (YAML frontmatter + aesthetic rules). If the user supplies an incoming `.fig` file, Figma JSON, or external design reference, read [`references/figma-import.md`](references/figma-import.md) first and update `DESIGN.md` frontmatter.

Generate `.design/tokens.css` deterministically from `DESIGN.md`:
```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/studio.mjs" sync-tokens --target "$PWD"
```
Done when `.design/tokens.css` matches every frontmatter token in `DESIGN.md`.

### 3. Draft Self-Contained Frame(s)
Write each screen or variant to `.design/frames/<slug>.html`:
- Link `<link rel="stylesheet" href="../tokens.css">` and consume `var(--color-*)`, `var(--font-*)`, `var(--radius-*)`, `var(--space-*)`, `var(--motion-*)` throughout.
- Keep every frame self-contained (inline `<style>` and `<script>`, crisp inline SVG icons, zero external network dependencies required to render).
- Wire multi-screen navigation with `data-goto="<target-frame-id>"` on buttons, links, or `<form>` elements (or `window.parent.postMessage({ type: 'studio:goto', to: '<target-frame-id>' }, '*')` for conditional JS flows). Studio intercepts these to pan/focus on the canvas and transition inside Play mode.
- When generating alternatives, create 2–3 distinct frames (`<slug>-a.html`, `<slug>-b.html`, `<slug>-c.html`) under a shared `group` that vary layout structure or density rather than accent color alone.
- Populate realistic domain copy, interactive states, and `font-variant-numeric: tabular-nums` for metrics.

Done when every requested screen/variant exists under `.design/frames/` and renders cleanly at its target viewport.

### 4. Register in `.design/frames.json`
Update `.design/frames.json` with an optional `entry` frame ID (Play mode start screen) and one entry per frame:

```json
{
  "project": "Workspace",
  "entry": "auth-login",
  "frames": [
    {
      "id": "auth-login",
      "title": "Sign In",
      "file": "frames/auth-login.html",
      "group": "auth",
      "viewport": { "width": 1280, "height": 800 },
      "position": { "x": 80, "y": 140 },
      "status": "draft",
      "links": [
        { "to": "ops-dashboard", "label": "Sign in" },
        { "to": "auth-signup", "label": "Create account" }
      ],
      "notes": "Entry screen for authentication flow"
    }
  ]
}
```

Valid `status` values: `draft`, `review`, `approved`. `position` (`{x, y}`) is optional for 2D canvas placement; `links` draws labeled SVG flow arrows between frames. Remove entries whose files were deleted.

Done when `.design/frames.json` matches every frame in `.design/frames/`.

### 5. Validate, Critique & Verify
- Validate manifest paths, `entry`, `links[].to`, and in-HTML `data-goto` targets:
  ```sh
  node "${CLAUDE_PLUGIN_ROOT}/scripts/studio.mjs" check --target "$PWD"
  ```
- Score every new or revised frame against [`references/critique.md`](references/critique.md); revise any axis below 8/10.
- Preview locally via `python3 -m http.server 4173 -d .design` (or `bunx serve .design -l 4173`). Inspect in a browser when browser tooling is available; otherwise provide the preview command to the user.

Done when `check` exits 0, all frames pass critique, and preview/verification results are reported.

## Handoff to Production
Once a frame reaches `approved`:
- Back-port any token tweaks exported from the Studio `Tokens` drawer into `DESIGN.md` frontmatter and re-run `sync-tokens`.
- Translate approved `.design/frames/<slug>.html` markup into production components, keeping `.design/` out of git.
