# Clean Local Branches

Delete all local branches except protected ones (master, main, development, staging).

**Protected branches:** `master`, `main`, `development`, `staging`

**Behavior:** Auto-deletes with a log showing what was removed.

## Key Principle

Keep your local repository clean by removing merged branches, but always preserve protected branches and check for unmerged work.

---

## Quick Decision Tree

Start here every time:

```bash
git status
git branch --show-current
git worktree list
```

| Your Situation | Go To Section |
|----------------|---------------|
| Working tree is dirty | 3A |
| On protected branch | 3B |
| On feature branch | 3C |
| Clean working tree on main | 3D |
| Multiple worktrees exist | 3E |

---

## 3A: Working tree is dirty

First, commit or stash your changes:

```bash
# Option 1: Commit changes
git add .
git commit -m "chore: save work before cleaning branches"

# Option 2: Stash changes
git stash push -m "work in progress"
```

Then proceed to [Section 4](#4-clean-branches).

---

## 3B: You're on a protected branch

If you're on main/master/development/staging, proceed directly to [Section 4](#4-clean-branches).

---

## 3C: You're on a feature branch

Switch to main first:

```bash
git checkout main
# OR if your default is master:
git checkout master
```

Then proceed to [Section 4](#4-clean-branches).

---

## 3D: Clean working tree on main

Proceed directly to [Section 4](#4-clean-branches).

---

## 3E: Multiple worktrees exist

Handle worktrees carefully before cleaning branches:

```bash
# List all worktrees
git worktree list

# For each worktree, check its status
# cd /path/to/worktree
git status

# If worktree is no longer needed:
# cd /path/to/worktree && git worktree remove .

# Prune metadata for deleted worktrees
git worktree prune
```

**Warning:** Never delete a branch that is checked out in another worktree. Switch worktrees to protected branches first.

Then proceed to [Section 4](#4-clean-branches).

---

## 4: Clean Branches

Once on a protected branch with clean working tree:

```bash
# 1. Ensure you're on a protected branch
git branch --show-current

# 2. Check worktrees and prune if needed
git worktree list
git worktree prune

# 3. Fetch latest from remote to see merged branches
git fetch --prune

# 4. List all branches
git branch -a

# 5. Delete merged local branches (except current and protected)
git branch --merged | grep -v "^\*" | grep -v "master\|main\|development\|staging" | xargs -r git branch -d

# 6. Check for unmerged branches (be careful!)
git branch --no-merged
```

**Note:** The command above only deletes branches that have been merged. If you have unmerged branches, review them manually. Also ensure no worktree is using branches you're about to delete.

---

## 5: Review and Verify

```bash
# See remaining branches
git branch

# Check if any important work was lost
git reflog --since="1 week ago" | head -20
```

---

## 6: Restore if Needed

If you accidentally deleted something important:

```bash
# Find the commit hash from reflog
git reflog

# Recreate the branch
git checkout -b recovered-branch <commit-hash>
```

---

## 7: Advanced Cleanup (Optional)

For more aggressive cleanup:

```bash
# Delete branches that are gone from remote
git branch -r | awk '{print $1}' | egrep -v -f /dev/stdin <(git branch -vv | grep origin) | awk '{print $1}' | xargs git branch -d

# Or use git's built-in command
git remote prune origin

# Clean up worktree metadata aggressively
git worktree prune --verbose
```

---

## 8: Verify Final State

```bash
git status    # Should show clean working tree
git branch    # Should show only protected branches
```
