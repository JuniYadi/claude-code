---
name: init
description: Set up decision-protocol in the current repository (config, vendored checker, git hooks, CI workflow). Use when the user asks to adopt or install the decision workflow in a repo. Safe to re-run.
---

# Init decision-protocol

Goal: this repo gets `decision-protocol.config.json`, a vendored checker in `.decision-protocol/`, git hooks, and a CI workflow. CI cannot see an installed plugin, so everything CI needs is copied into the repo.

Rules: never overwrite or edit an existing file without asking. Never read `.env` files. Requires `git` and Node.js 18+; if Node is missing, say so and stop.

1. Confirm the working directory is a git repository. If `decision-protocol.config.json` exists, this is a re-run: skip the interview and go to step 4.
2. Ask the user (one message, offer defaults):
   - ADR scopes (default `app`): folders under `docs/adr/`.
   - Governed paths (globs of code that needs a decision), exempt paths (generated code, type files), protected paths (security or core areas that get extra gating, may be empty).
   - Test command (may be empty). If tests need a database, it must be a throwaway one created for the run (container or temp database); never a shared developer database.
3. Write `decision-protocol.config.json` from the answers. Fields: `scopes`, `adrDir`, `prdPaths`, `governed`, `exempt`, `protected`, `testCommand`, `rules` (optional repo-specific rule modules, empty by default).
4. Vendor the files:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/vendor.mjs" --target "$PWD"`
   It prints `created`, `unchanged` or `differs` per file. For each `differs`, show the user what differs and ask; only then re-run with `--overwrite <path>` for approved files.
5. Hooks: if `git config core.hooksPath` is unset, ask to set it to `.decision-protocol/githooks`. If it points elsewhere, do not change it; tell the user to call the three hook scripts from their existing hooks.
6. `.gitignore`: show `${CLAUDE_PLUGIN_ROOT}/templates/gitignore.snippet` (ignores `.claude/intent.json` and env files) and append the missing lines after the user agrees.
7. Trust (required before anything from this repo runs from the plugin hooks). Run
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/trust.mjs" inspect --root "$PWD" --data "${CLAUDE_PLUGIN_DATA}"`
   and show the user the test command, the rule modules and the vendored checker version it prints. Ask explicitly whether to trust this repository. Only after a clear yes, run the same command with `trust` and `--yes` instead of `inspect`. Never trust on your own, and never for a repo the user has not reviewed (for example a fresh clone). If the user declines, say the plugin hooks stay off here. Trust is stored per user outside the repo and expires when the vendored checker, config or a rule module changes; re-running this skill re-trusts after a fresh review.
8. Only if trusted: run `node .decision-protocol/dp.mjs status` then `node .decision-protocol/dp.mjs check` and report. Do not commit or push unless asked; list the files to review.

Then tell the user the next step: add a PRD use case, then a `proposed` ADR from `docs/adr/_template.md`, and follow the `change-protocol` skill.
