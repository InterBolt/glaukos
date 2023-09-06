#!/bin/zsh

# ensures that if any command fails, the script stops running
set -e;

# load env variables
source .env;

# use the latest stable version of nodejs
[[ -s $HOME/.nvm/nvm.sh ]] && . $HOME/.nvm/nvm.sh
nvm use 18;

git fetch;
git checkout release;
git branch -D dev;

# open the PR in browser
GH_LIST_RESPONSE=$(GH_TOKEN="$GH_TOKEN" gh pr list --head "dev" --limit 1);
GH_PR_NUMBER=(echo "$LIST_RESPONSE" | head -n1 | awk '{print $1;}');

# merge it
GH_TOKEN="$GH_TOKEN" gh pr merge $GH_PR_NUMBER --delete-branch --squash --auto;

git fetch;
git pull;
git checkout -b dev;