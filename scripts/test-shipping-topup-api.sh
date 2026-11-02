#!/bin/sh
set -eu
shipping_bundle=".shipping-topup-test-$$.cjs"
trap 'rm -f "$shipping_bundle"' EXIT HUP INT TERM
npx --yes esbuild tests/shipping-topup-api.test.ts --bundle --platform=node --format=cjs --packages=external --alias:@/lib/billing-server=./tests/fixtures/shipping-billing-server.ts --alias:@=./src --alias:server-only=./node_modules/next/dist/compiled/server-only/empty.js --outfile="$shipping_bundle"
node --test "$shipping_bundle"
