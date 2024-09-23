#!/usr/bin/env bash

set -o nounset      # Treat unset variables as an error when substituting
set -o errexit      # Exit immediately if any command returns a non-zero status
set -o pipefail     # Prevent errors in a pipeline from being masked
set -o xtrace       # Print each command to the terminal before execution

PATH_SUITCASE=$HOME/data/code/polymedia-suitcase
PATH_THIS_REPO=$HOME/data/code/polymedia-rpcs

cd $PATH_SUITCASE
pnpm build

cd $PATH_THIS_REPO/src/web
pnpm link $PATH_SUITCASE/src/core
pnpm link $PATH_SUITCASE/src/react
