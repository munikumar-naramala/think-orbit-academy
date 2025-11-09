#!/usr/bin/env bash
set -euo pipefail

# clean_secrets.sh
# Safe helper script to remove a specific secret file from git history using git-filter-repo,
# clean, and force-push the cleaned branches. You MUST review the commands before running.
# This script will NOT run automatically on your behalf; run it locally from the repo root.

SECRET_PATH="$1"
if [ -z "$SECRET_PATH" ]; then
  echo "Usage: $0 <path-to-secret-file-to-remove>">
  exit 1
fi

echo "*** BACKUP: creating backups of .git and working tree"
cp -a .git ../git-backup-$(date +%Y%m%d%H%M%S)
tar -czf ../worktree-backup-$(date +%Y%m%d%H%M%S).tgz .

echo "*** Checking for git-filter-repo"
if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "git-filter-repo not found. Installing to user site via pip..."
  python3 -m pip install --user git-filter-repo
  if ! command -v git-filter-repo >/dev/null 2>&1; then
    echo "git-filter-repo still not available. Install it manually and re-run this script." >&2
    exit 1
  fi
fi

echo "*** Removing $SECRET_PATH from git history (this rewrites history)"
git filter-repo --invert-paths --path "$SECRET_PATH"

echo "*** Expire reflog and garbage collect"
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "*** Verify the path is gone from history"
if git log --all --pretty=format:%H -- "$SECRET_PATH" | grep -q .; then
  echo "ERROR: The path still appears in history. Aborting push." >&2
  exit 1
fi

echo "*** Force-pushing cleaned branches to origin (use --force-with-lease)"
read -p "Push cleaned branches to origin? This will rewrite remote history. Type 'yes' to continue: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted by user. The repo history is cleaned locally. You must push manually when ready.";
  exit 0
fi

git push --force-with-lease origin --all
git push --force-with-lease origin --tags || true

echo "*** Done. Remember to rotate the exposed credential in Google Cloud Console immediately."
