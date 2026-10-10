#!/usr/bin/env bash
# Copy the ai-config branch into the working tree without touching git's index.
# Run from the repo root. Safe to run more than once.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git fetch -q origin ai-config
git archive origin/ai-config | tar -x
for p in CLAUDE.md CLAUDE.local.md AGENTS.md .claude/; do
  grep -qxF "$p" .git/info/exclude 2>/dev/null || echo "$p" >> .git/info/exclude
done
if [ -n "$(git diff --cached --name-only -- CLAUDE.md '**/CLAUDE.md' AGENTS.md .claude)" ]; then
  echo "ai-config: assistant files are staged, refusing to continue" >&2
  exit 1
fi
