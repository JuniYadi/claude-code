---
name: change-protocol
description: Required steps before adding, fixing, refactoring or removing code in a repo that has decision-protocol.config.json. Use whenever you are about to change governed code or are asked to fix a bug.
---

# Change protocol

Decisions are the source of truth. No code without a decision. The checker (`node .decision-protocol/dp.mjs check`), git hooks and CI enforce this; never skip or work around them. If the repo has no `decision-protocol.config.json`, this skill does not apply.

## Order

PRD use case, then ADR decision, then code.

- New behaviour: add the use case to the PRD and a decision `Dn` with state `proposed`. A human accepts it. Never mark a decision `accepted` yourself and ask the user.
- Changing behaviour: add a new `Dn` that supersedes the old one.
- Code may only be tagged with, and commits may only cite, an accepted decision.

## Before editing code

1. Read `docs/adr/STATUS.md` and the matching ADR. Note the id `ADR-NNNN.Dn` and its `paths`.
2. No decision covers it: stop and propose one. Behaviour nobody specified is not a bug.
3. Classify: `feat`, `fix`, `refactor` (no behaviour change), `test`, `perf`.
4. `fix`: write Observed, Expected (cite the accepted decision), Cause, Impact first. If Expected cannot cite a decision it is not a bug. Add a test titled `[ADR-NNNN.Dn] ...` that fails before the fix.
5. Protected paths (see config): get the plan approved, then write `.claude/intent.json` with `decision`, `type` and, for fix, the four fields. The gate hook denies edits without it.

## While writing

- Every exported function, class, enum or const in governed JS/TS gets `/** @adr ADR-NNNN.Dn */`. Other governed languages need an `@adr` comment in the file. Tests and exempt paths are excluded.
- Run `node .decision-protocol/dp.mjs check` and the project tests, then `node .decision-protocol/dp.mjs status` and commit `STATUS.md`.

## Commit

`type(ADR-NNNN.Dn): summary`. Use `docs(no-adr)` or `chore(no-adr)` only when no governed code is touched. A `fix` body has `Observed:`, `Expected:`, `Cause:`, `Impact:` lines. When a hook rejects a commit or push, fix the cause; do not skip hooks.

## Before merge

1. Independent review: someone other than the author (a separate reviewer agent or a person, with a fresh context) reads the diff against the decision and PRD use case, not against the author's summary. Findings are fixed or answered.
2. Adversarial verification: a verifier tries to break it. Add an untagged export, cite a proposed decision, drop the fix test, run the suite on a clean checkout. Record what was tried and the result.

## Rule files

`docs/adr/`, `decision-protocol.config.json`, `.decision-protocol/`, and the CI workflow ask the user before editing. Change them only when the user asked for that in this session. Never read or commit `.env` files.
