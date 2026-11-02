#!/bin/sh
set -eu
oto_return_bundle=".oto-return-test-$$.cjs"
trap 'rm -f "$oto_return_bundle"' EXIT HUP INT TERM
npx --yes esbuild tests/oto-return.test.ts --bundle --platform=node --format=cjs --packages=external --alias:@/lib/billing-server=./tests/fixtures/shipping-billing-server.ts --alias:@=./src --alias:server-only=./node_modules/next/dist/compiled/server-only/empty.js --outfile="$oto_return_bundle"
node --test "$oto_return_bundle"
