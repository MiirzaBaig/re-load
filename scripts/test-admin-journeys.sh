#!/bin/sh
# Auth/RPC mocks only. No environment files or live requests.
set -eu
admin_test_bundle=".admin-journeys-test-$$.cjs"
trap 'rm -f "$admin_test_bundle"' EXIT HUP INT TERM
npx --yes esbuild tests/admin-journeys.test.ts --bundle --platform=node --format=cjs --packages=external --alias:@/lib/admin-access=./tests/fixtures/admin-access.ts --alias:@=./src --outfile="$admin_test_bundle"
node --test "$admin_test_bundle"
