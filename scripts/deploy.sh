#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/MatLish00010/crash-slip.git"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"
npm test
npm run build

cd "$ROOT/dist"
touch .nojekyll
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy $(git -C "$ROOT" rev-parse --short HEAD)"
git -c credential.helper= -c credential.helper='!gh auth git-credential' push -f -q "$REPO_URL" gh-pages
rm -rf .git

echo "Deployed to https://matlish00010.github.io/crash-slip/"
