---
name: init
description: Initialize local offline design-studio workspace (DESIGN.md, .gitignore entry, and .design/ canvas).
disable-model-invocation: true
---

# Init design-studio

Set up the local offline HTML design canvas in the current repository. Safe to re-run; never overwrite an existing `DESIGN.md` or modified file without asking. Requires Node.js 18+.

## Steps

1. Run bootstrap (add `--with-demo` only when the user asks for the sample Login → Sign Up → Reset Password → Dashboard flow):
   ```sh
   node "${CLAUDE_PLUGIN_ROOT}/scripts/studio.mjs" bootstrap --target "$PWD"
   ```
   It prints `created`, `unchanged`, or `differs` per file. For any `differs`, show the user which files differ and ask before re-running with `--overwrite <relative-path>`.

2. Sync CSS custom properties from `DESIGN.md` into `.design/tokens.css`:
   ```sh
   node "${CLAUDE_PLUGIN_ROOT}/scripts/studio.mjs" sync-tokens --target "$PWD"
   ```

3. `.gitignore`: inspect `${CLAUDE_PLUGIN_ROOT}/templates/gitignore.snippet` (`.design/`). If `.design/` is not already ignored in `.gitignore`, show the snippet and append it after the user agrees.

4. Validate workspace integrity:
   ```sh
   node "${CLAUDE_PLUGIN_ROOT}/scripts/studio.mjs" check --target "$PWD"
   ```

5. Report created/updated files and print the local preview command:
   ```sh
   python3 -m http.server 4173 -d .design
   # open http://localhost:4173
   ```

Next step: invoke `/design-studio:design` (or describe any screen, variant, flow, or Figma spec) to draft frames in `.design/frames/`.
