#!/bin/zsh

# ensures that if any command fails, the script stops running
set -e;

# load env variables
source .env;

# use the latest stable version of nodejs
[[ -s $HOME/.nvm/nvm.sh ]] && . $HOME/.nvm/nvm.sh
nvm use 18;

# exit early if we have any uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Uncommitted changes, aborting.";
  exit 1;
fi

# exit early if the current branch isn't called "dev"
if [ "$(git rev-parse --abbrev-ref HEAD)" != "dev" ]; then
  echo "Not on dev branch, aborting.";
  exit 1;
fi

# save a variable supplied in the arguments called 'version'
# if no version is supplied, use '--prerelease'
VERSION=${1:-'--prerelease'};

# bump version
yarn version $VERSION --no-git-tag-version;

# commit the new package.json version and push to dev
git add package.json;
git commit -m "chore: release $version";
git push origin dev;

# open a new PR and view in browser
GH_TOKEN="$GH_TOKEN" gh pr create --base "release" --head "dev" --fill-first;
LIST_RESPONSE=$(GH_TOKEN="$GH_TOKEN" gh pr list --head "dev" --limit 1);
PR_NUMBER=$(echo "$LIST_RESPONSE" | head -n1 | awk '{print $1;}')

gh pr view $PR_NUMBER --web;