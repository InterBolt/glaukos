#!/usr/bin/env bash

# Stop script execution if any command fails
set -e;

# Load environment variables from .env file
source .env;

# Use the latest stable version of nodejs
[[ -s $HOME/.nvm/nvm.sh ]] && . $HOME/.nvm/nvm.sh
nvm use 18;

# Check for uncommitted changes and abort if found
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: There are uncommitted changes. Aborting script execution." >&2
  exit 1;
fi

# Abort if the current branch is called "release"
if [ "$(git rev-parse --abbrev-ref HEAD)" = "release" ]; then
  echo "Error: You are not on the development branch. Aborting script execution." >&2
  exit 1;
fi

CHECKED_OUT_BRANCH=$(git rev-parse --abbrev-ref HEAD);

# Get the PR number so we can merge
GH_LIST_RESPONSE=$(GH_TOKEN="$GH_TOKEN" gh pr list --base "release" --head "$CHECKED_OUT_BRANCH" --limit 1);
GH_PR_NUMBER=$(echo "$LIST_RESPONSE" | head -n1 | awk '{print $1;}');

# Merge the remote branch into release
GH_TOKEN="$GH_TOKEN" gh pr merge $GH_PR_NUMBER --delete-branch --squash --auto;

git checkout release;
git fetch;
git pull;
git checkout -b dev;