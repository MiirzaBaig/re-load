#!/bin/sh
# Isolated provider mocks: never loads .env or sends a real Zid request.
set -eu
zid_test_bundle=".zid-dev-oauth-test-$$.cjs"
trap 'rm -f "$zid_test_bundle"' EXIT HUP INT TERM
npx --yes esbuild tests/zid-dev-oauth.test.ts --bundle --platform=node --format=cjs --packages=external --alias:@=./src --alias:server-only=./node_modules/next/dist/compiled/server-only/empty.js --outfile="$zid_test_bundle"
node --test "$zid_test_bundle"
