---
name: issue-reviews
description: Analyze GitHub issue and post fix plan
model: opus
---

# Handle Issue Command

Analyzes a GitHub issue labeled with `claude:auto-fix` and posts a structured fix plan for approval.

## Usage

```bash
/handle-issue <issue-number>
```

**Example:**
```bash
/handle-issue 42
```

## Prerequisites

Before running, verify:
1. GitHub CLI authenticated: `gh auth status`
2. In a git repository: `git rev-parse --git-dir`
3. Issue exists and has `claude:auto-fix` label

## Implementation

### Step 1: Validate Input

Check issue number provided:

```bash
if [ -z "$1" ]; then
  echo "❌ Error: Issue number required"
  echo "Usage: /handle-issue <issue-number>"
  exit 1
fi

ISSUE_NUMBER="$1"
```

### Step 2: Verify GitHub CLI

```bash
if ! command -v gh &> /dev/null; then
  echo "❌ Error: GitHub CLI (gh) not found"
  echo "Install: https://cli.github.com/"
  exit 1
fi

if ! gh auth status &> /dev/null; then
  echo "❌ Error: GitHub CLI not authenticated"
  echo "Run: gh auth login"
  exit 1
fi
```

### Step 3: Verify Git Repository

```bash
if ! git rev-parse --git-dir &> /dev/null; then
  echo "❌ Error: Not in a git repository"
  exit 1
fi

# Get repository info
REMOTE=$(git remote get-url origin)
OWNER=$(echo "$REMOTE" | sed -E 's/.*github\.com[:/]([^/]+).*/\1/')
REPO=$(echo "$REMOTE" | sed -E 's/.*github\.com[:/][^/]+\/([^.]+).*/\1/')
```

### Step 4: Fetch Issue

```bash
echo "📥 Fetching issue #$ISSUE_NUMBER..."

ISSUE_JSON=$(gh issue view "$ISSUE_NUMBER" --json number,title,body,labels,author,state 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Failed to fetch issue:"
  echo "$ISSUE_JSON"
  exit 1
fi
```

### Step 5: Validate Issue

Use lib/issue-parser to extract trigger label:

```bash
TRIGGER_LABEL="claude:auto-fix"

HAS_LABEL=$(echo "$ISSUE_JSON" | jq -r --arg label "$TRIGGER_LABEL" '.labels[]? | select(.name == $label) | .name')

if [ -z "$HAS_LABEL" ]; then
  echo "⚠️  Issue #$ISSUE_NUMBER doesn't have required label: $TRIGGER_LABEL"

  # Use lib/error-handler template #1
  gh issue comment "$ISSUE_NUMBER" --body "$(cat <<'EOF'
⚠️ **Cannot Process Issue**

This issue needs the `claude:auto-fix` label to be processed automatically.

**To enable automatic handling:**
```bash
gh issue edit $ISSUE_NUMBER --add-label "claude:auto-fix"
```

Then run: `/handle-issue $ISSUE_NUMBER`
EOF
)"

  exit 0
fi

# Check if open
STATE=$(echo "$ISSUE_JSON" | jq -r '.state')
if [ "$STATE" != "OPEN" ]; then
  echo "⚠️  Issue #$ISSUE_NUMBER is $STATE (not OPEN)"
  exit 0
fi
```

### Step 6: Parse Issue

Use @lib/issue-parser:

```markdown
Parse the issue using lib/issue-parser:

Extract from issue JSON:
- Title: for primary keywords
- Body: for error messages, stack traces, file paths
- Labels: for additional context

Store extracted information:
- Error messages: ["error1", "error2"]
- File paths: ["src/file1.ts", "src/file2.ts"]
- Functions: ["functionName", "ClassName"]
- Keywords: ["timeout", "authentication", "session"]
```

### Step 7: Explore Codebase

Use @lib/code-explorer with hybrid strategy:

```markdown
Explore code using lib/code-explorer:

Phase 1: Targeted Search
- Run Grep for error messages
- Run Grep for function names
- Run Glob for file patterns
- Evaluate: ≥3 relevant files?

Phase 2: Deep Analysis (if needed)
- Spawn Task tool with subagent_type=Explore
- Analyze execution flow
- Identify root cause

Output: ExplorationResults with root cause and files
```

### Step 8: Generate Plan

Use @lib/plan-generator:

```markdown
Generate plan using lib/plan-generator:

Input: ExplorationResults + ParsedIssue
Output: Formatted markdown plan with:
- Summary sentence
- Detailed root cause
- What we'll do / won't do
- Files to change
- Testing approach
- Risks
```

### Step 9: Post Plan to GitHub

```bash
echo "📤 Posting plan to issue #$ISSUE_NUMBER..."

# Save plan to temp file
PLAN_FILE="/tmp/issue-${ISSUE_NUMBER}-plan.md"
echo "$GENERATED_PLAN" > "$PLAN_FILE"

# Post to GitHub
gh issue comment "$ISSUE_NUMBER" --body "$(cat "$PLAN_FILE")"

if [ $? -eq 0 ]; then
  echo "✅ Plan posted successfully!"
  echo ""
  echo "📋 Next steps:"
  echo "1. Review plan: https://github.com/${OWNER}/${REPO}/issues/${ISSUE_NUMBER}"
  echo "2. Approve with 👍 or comment 'approve'"
  echo "3. Run: /continue-issue ${ISSUE_NUMBER}"
else
  echo "❌ Failed to post plan"
  echo "Plan saved to: $PLAN_FILE"
  exit 1
fi
```

### Step 10: Cleanup

```bash
# Remove temp file
rm -f "$PLAN_FILE"
```

## Error Handling

All errors use @lib/error-handler templates:

- **Issue not found:** Exit gracefully with message
- **No label:** Post template #1, exit gracefully
- **Code not found:** Post template #2, exit gracefully
- **GitHub API error:** Post template #3, exit with error

## Complete Flow

```
/handle-issue 42
    ↓
Validate input
    ↓
Verify gh CLI + git repo
    ↓
Fetch issue from GitHub
    ↓
Validate label + state
    ↓
Parse issue → keywords
    ↓
Explore code → root cause
    ↓
Generate plan
    ↓
Post to GitHub
    ↓
Show next steps
```

## Testing

**Manual test:**

```bash
# Create test issue
gh issue create --title "Test: timeout error" --body "Error in src/test.ts" --label "claude:auto-fix"

# Run command
/handle-issue <number>

# Verify:
# - Plan posted to issue
# - Contains root cause, files, testing
# - Format correct (emoji, collapsible details)
```

## Performance

- Targeted search: ~30 seconds
- Deep analysis: 2-5 minutes
- Total: 1-5 minutes typically

## YAGNI Notes

**Not included:**
- Multiple issues at once
- Automatic scheduling
- Issue templates
- Analytics

Keep it simple: one issue, one plan, human approval.
