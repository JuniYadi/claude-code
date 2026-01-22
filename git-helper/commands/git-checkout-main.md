This guide provides step-by-step instructions for checking the current Git branch, handling worktrees, switching to the main branch, pulling updates from origin, and resolving potential merge conflicts.

### Git Branch and Update Instructions

1. **Check current branch**:
    - Run: `git branch --show-current`
    - This shows the branch you're currently on.

2. **Check if in a git worktree**:
    - Run: `git worktree list`
    - If the output shows multiple worktrees, you're in a worktree setup. Note the path of the main worktree (usually the primary repo directory).

3. **Check git worktree branch main**:
    - If not already in the main worktree, navigate to it (e.g., `cd /path/to/main/worktree`).
    - Run: `git branch --show-current` in the main worktree to confirm it's on main. If not, proceed to checkout.

4. **Checkout to main**:
    - Run: `git checkout main`
    - This switches to the main branch in the current worktree.

5. **Pull from origin for latest updates**:
    - Run: `git pull origin main`
    - This fetches and merges changes from the remote main branch.

6. **Handle conflicts**:
    - If the pull results in merge conflicts (Git will notify you), stop and ask the user:
        - Do you want to reset the local main branch to match origin/main (discarding local changes)? If yes, run: `git reset --hard origin/main`
        - Or do you want to rebase your local changes on top of origin/main? If yes, run: `git rebase origin/main` (resolve any rebase conflicts manually, then `git rebase --continue`).
