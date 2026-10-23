#!/bin/sh
# Provider mocks only. Never loads private environment files.
set -eu
checkout_test_bundle=".zid-dev-checkout-test-$$.cjs"
trap 'rm -f "$checkout_test_bundle"' EXIT HUP INT TERM
npx --yes esbuild tests/zid-dev-checkout.test.ts --bundle --platform=node --format=cjs --packages=external --alias:@=./src --alias:server-only=./node_modules/next/dist/compiled/server-only/empty.js --outfile="$checkout_test_bundle"
node --test "$checkout_test_bundle"
