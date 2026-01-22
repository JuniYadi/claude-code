# Merge and UnCommit: Commit and Merge to Main Safely

Ensure all uncommitted changes are committed before merging to main, keeping git history clean.

## Key Principle

Always work on a feature branch, never commit directly to main. Merge only when working tree is clean.

---

## Quick Decision Tree

Start here every time:

```bash
git status
git branch --show-current
```

| Your Situation | Go To Section |
|----------------|---------------|
| On `main` with uncommitted changes | 3A |
| On feature branch with uncommitted changes | 3B |
| Clean working tree | 3C |

---

## 3A: You're on `main` with uncommitted changes

First, create a feature branch:

```bash
git checkout -b feature/$(date +%Y%m%d-%H%M%S)
```

Then proceed to [Section 4](#4-commit-your-changes) to commit your changes.

---

## 3B: You're on a feature branch with uncommitted changes

Proceed directly to [Section 4](#4-commit-your-changes) to commit your changes.

---

## 3C: Clean working tree

If everything is already committed, skip to [Section 5](#5-merge-to-main).

---

## 4: Commit Your Changes

**Important:** Never use `git add .` as it can stage unintended files and harm your git history. Always stage and commit each file individually.

```bash
# See what needs to be committed
git status

# For each file that has changes:
# 1. Review the changes
git diff path/to/file      # for modified files
cat path/to/newfile        # for new untracked files

# 2. Stage the specific file
git add path/to/file

# 3. Review the staged changes to generate commit message
git diff --staged

# 4. Commit with a message generated from the diff
git commit -m "type: description based on diff changes"
```

**Conventional commit types:**
- `feat` - new feature
- `fix` - bug fix
- `refactor` - refactoring
- `docs` - documentation
- `chore` - maintenance
- `test` - test changes
- `style` - formatting

**Commit Message Guidelines:**
- Review the `git diff --staged` output carefully
- Describe what changed in the file based on the diff
- Use conventional commit format: `type: brief description`
- Make the message specific to the changes in that file

---

## 5: Merge to Main

Once all changes are committed:

```bash
# 1. Ensure main is up to date
git fetch origin main

# 2. Switch to main
git checkout main

# 3. Merge your feature branch (creates merge commit)
git merge your-feature-branch --no-ff

# 4. If merge conflicts occur:
#    - Edit conflicted files to resolve
#    - git add resolved-files
#    - git commit (complete the merge)

# 5. Push to remote
git push origin main
```

---

## 6: Cleanup (Optional)

```bash
# Delete the merged feature branch locally
git branch -d your-feature-branch

# Delete from remote (if it was pushed)
git push origin --delete your-feature-branch
```

---

## 7: Verify Final State

```bash
git status    # Should show "nothing to commit, working tree clean"
git log --oneline -5    # Review recent commits
```
