# decision-protocol

A Claude Code plugin that makes decisions the source of truth for a codebase.

Flow: PRD use case, then ADR decision (`proposed`; a human accepts it), then code tagged `@adr ADR-NNNN.Dn`, committed as `type(ADR-NNNN.Dn): ...`. A fix restores a named accepted decision (Observed, Expected, Cause, Impact) and adds a test. A generated `STATUS.md` shows what is implemented and tested. Independent review and adversarial verification happen before merge.

## Install

```sh
claude plugin marketplace add JuniYadi/claude-code
claude plugin install decision-protocol@claude-code-plugins
```

## Requirements

- Claude Code with plugin support
- git
- Node.js 18 or newer (the checker has no other dependencies)

## Quick start

1. In your repository, ask Claude to run the `init` skill (`/decision-protocol:init`). It asks for ADR scopes, governed, exempt and protected paths, and a test command, then writes `decision-protocol.config.json`.
2. `init` vendors a pinned copy of the checker, git hooks and a GitHub Actions workflow into the repo (`.decision-protocol/`, `.github/workflows/decision-protocol.yml`). CI cannot see an installed plugin, so the repo carries its own copy; the plugin version is in `.decision-protocol/VERSION`. Existing files are never overwritten without asking.
3. Add a PRD use case (`docs/prd/`), then a `proposed` ADR from `docs/adr/_template.md`. A human sets it to `accepted`.
4. Code under governed paths exports only symbols tagged `/** @adr ADR-0001.D1 */`. Skill `change-protocol` guides Claude through this.
5. Run `node .decision-protocol/dp.mjs status` to regenerate `docs/adr/STATUS.md`, and `node .decision-protocol/dp.mjs check` to verify.

Commands: `check`, `status`, `commit-msg <file>`, `gate`, `run-tests`, `guard-env`, `version`.

## Configuration

`decision-protocol.config.json`: `scopes`, `adrDir`, `prdPaths`, `governed`, `exempt`, `protected`, `testCommand`, `rules`, and optional `testPatterns`, `commitTypes`, `requireUseCase`, `statusFile`. `rules` lists optional repo-specific rule modules (empty by default; see `templates/examples/`). The core has no layout or boundary rules of its own.

## Hooks

The plugin hooks run in every project but do nothing unless `decision-protocol.config.json` exists. When it exists and Node.js is missing, they say how to install it. The vendored git hooks are `commit-msg` (message format and fix rules), `pre-commit` (blocks committing environment files; only `.env.example` style templates pass) and `pre-push` (check plus tests). Fix the reported problem instead of skipping hooks.

## Tests and databases

`pre-push` and CI run only your `testCommand`. They never default to a database. If tests need one, make `testCommand` create a throwaway database (a container or a temporary database dropped afterwards), never a shared developer database. The checker never reads environment files.

## Limits

- Export detection is line based for JS and TS (`export function|class|const|let|var|enum|default`). `export { a }` lists and type-only exports are not checked. Other languages need one `@adr` comment per governed file.
- `STATUS.md` and the stale check cover decisions, tags and test titles `[ADR-NNNN.Dn]`; they do not prove a test is meaningful.
- Accepting a decision is a human act; the tooling cannot tell who edited the front matter.
- Hooks can be bypassed by someone with shell access; CI is the backstop.
- Not tested here: installing through `claude plugin install` on a real machine.

## License

MIT, see `LICENSE`.
