#!/bin/sh
# Claude Code hook entry for decision-protocol. Usage: hook.sh gate | check-file
# Silent no-op unless the project has decision-protocol.config.json.
mode="$1"
root="${CLAUDE_PROJECT_DIR:-$PWD}"
[ -f "$root/decision-protocol.config.json" ] || exit 0

here="$(cd "$(dirname "$0")" && pwd)"
checker="$root/.decision-protocol/dp.mjs"
[ -f "$checker" ] || checker="$here/dp.mjs"

if ! command -v node >/dev/null 2>&1; then
  msg="decision-protocol is configured in this repository but Node.js 18 or newer was not found on PATH. Install Node.js (https://nodejs.org), restart Claude Code, then retry. Enforcement is paused until then."
  case "$mode" in
    gate) printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"%s"}}\n' "$msg" ;;
    *) echo "$msg" >&2; exit 2 ;;
  esac
  exit 0
fi

case "$mode" in
  gate) exec node "$checker" --root "$root" gate ;;
  check-file) exec node "$checker" --root "$root" check --stdin ;;
  *) echo "decision-protocol hook: unknown mode '$mode'" >&2; exit 64 ;;
esac
