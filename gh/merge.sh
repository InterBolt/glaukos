#!/bin/zsh

# ensures that if any command fails, the script stops running
set -e;

# load env variables
source .env;

# exit early if we have any uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Uncommitted changes, aborting.";
  exit 1;
fi

# exit early if the current branch is called "release"
if [ "$(git rev-parse --abbrev-ref HEAD)" = "release" ]; then
  echo "Not on dev branch, aborting.";
  exit 1;
fi

# use the latest stable version of nodejs
[[ -s $HOME/.nvm/nvm.sh ]] && . $HOME/.nvm/nvm.sh
nvm use 18;

BRANCH=$(git rev-parse --abbrev-ref HEAD);

# open the PR in browser
GH_LIST_RESPONSE=$(GH_TOKEN="$GH_TOKEN" gh pr list --base "release" --head "$BRANCH" --limit 1);
GH_PR_NUMBER=$(echo "$LIST_RESPONSE" | head -n1 | awk '{print $1;}');

# merge it
GH_TOKEN="$GH_TOKEN" gh pr merge $GH_PR_NUMBER --delete-branch --squash --auto;

git checkout release;
git fetch;
git pull;
git checkout -b dev;