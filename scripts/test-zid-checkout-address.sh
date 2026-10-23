#!/bin/sh
# Address contract and safe provider-error tests; no environment files or real requests.
set -eu
address_test_bundle=".zid-checkout-address-test-$$.cjs"
trap 'rm -f "$address_test_bundle"' EXIT HUP INT TERM
npx --yes esbuild tests/zid-checkout-address.test.ts --bundle --platform=node --format=cjs --packages=external --alias:@=./src --alias:server-only=./node_modules/next/dist/compiled/server-only/empty.js --outfile="$address_test_bundle"
node --test "$address_test_bundle"
