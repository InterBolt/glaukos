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

# Run some code only if a package.json file exists at root
if [ -f "package.json" ]; then
  # Save a variable supplied in the arguments called 'version'
  # if no version is supplied, use '--prerelease'
  VERSION=${1:-'--prerelease'};

  # Bump version and commit the new package.json version
  yarn version $VERSION --no-git-tag-version;
  git add package.json;
  git commit -m "chore: release $version";
  git push origin $CHECKED_OUT_BRANCH;
fi

# Ensure release is up to date for accurate diffs
git fetch;
git checkout release;
git pull;
git checkout $CHECKED_OUT_BRANCH;

# Open a new PR and view in browser
GH_TOKEN="$GH_TOKEN" gh pr create --base "release" --head "$BRANCH" --fill-first;
GH_LIST_RESPONSE=$(GH_TOKEN="$GH_TOKEN" gh pr list --head "$BRANCH" --limit 1);
GH_TOKEN="$GH_TOKEN" gh pr view $(echo "$LIST_RESPONSE" | head -n1 | awk '{print $1;}') --web;
