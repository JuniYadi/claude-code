# design-studio

Local offline HTML design canvas and Claude Code workflow driven by `DESIGN.md` tokens and plain HTML frames inside a gitignored `.design/` directory.

## Install

```sh
claude plugin marketplace add JuniYadi/claude-code
claude plugin install design-studio@juniyadi-plugins
```

## Requirements

- Claude Code with plugin support
- Node.js 18 or newer (zero runtime dependencies)
- Any local static HTTP server to preview `.design/` (e.g. `python3 -m http.server`, `bunx serve`)

## Quick start

1. In your repository, run `/design-studio:init` (pass `--with-demo` to include the sample Login → Sign Up → Reset Password → Dashboard flow). It creates `DESIGN.md`, bootstraps `.design/`, syncs `.design/tokens.css`, and offers to add `.design/` to `.gitignore`.
2. Preview locally:
   ```sh
   python3 -m http.server 4173 -d .design
   # open http://localhost:4173
   ```
3. Describe screens, variants, multi-screen flows, or incoming Figma specs — Claude uses `/design-studio:design` to write self-contained HTML frames in `.design/frames/`, register them in `.design/frames.json`, and validate all links.

## Skills

| Skill | Invocation | Purpose |
|---|---|---|
| `/design-studio:init` | User-invoked (`disable-model-invocation: true`) | Bootstrap `DESIGN.md`, `.design/index.html`, `.design/tokens.css`, `.design/frames.json`, and `.gitignore` entry |
| `/design-studio:design` | Model- or user-invoked | Sync tokens, draft HTML frames with `data-goto` links, validate manifest/links, and run 5-axis critique |

## CLI (`scripts/studio.mjs`)

- `bootstrap --target <dir> [--with-demo] [--overwrite <rel>]...` — idempotent setup; never overwrites differing files without `--overwrite`.
- `sync-tokens --target <dir> [--design <path>]` — parses YAML frontmatter in `DESIGN.md` and emits `.design/tokens.css`.
- `check --target <dir>` — validates `.design/frames.json`, rejects path traversal, checks `entry`, `links[].to`, and in-HTML `data-goto` targets.
- `version` — prints plugin version.

## Studio features

- **Canvas & Grid modes (`G`):** infinite pan/zoom artboard canvas (`Space`+drag, `Cmd/Ctrl`+scroll, `F` fit) and side-by-side comparison grid.
- **Flow connectors (`L`):** SVG Bézier arrows with labels drawn from `frames[].links` and optional 2D `position: { x, y }`.
- **Interactive Play mode (`P`):** full-screen prototype player starting from `entry`, with `←`/`→` history, screen jumper, clickable `[data-goto]` transitions, and hotspot flash (`H`).
- **Live Tokens drawer (`T`):** edits `:root` CSS variables across all iframes live, with Copy CSS / Export `.css`.
- **Config JSON drawer (`J`):** inspect/edit `frames.json` live (`Apply JSON`), import/export `frames.json` or portable `.design.json` bundles (manifest + tokens + embedded frame HTML rendered offline via `srcdoc`), or drag-and-drop any `.json` file onto the canvas.
- **Zero-daemon live reload:** polls `frames.json`, `tokens.css`, and frame headers every 1.5s.

## Tests

```sh
node --test plugins/design-studio/tests
```

## License

MIT, see repository `LICENSE`.
