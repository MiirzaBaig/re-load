#!/bin/sh
# Provider mocks only; no environment files, network calls, booking or wallet changes.
set -eu
oto_bundle=".oto-sandbox-test-$$.cjs"
trap 'rm -f "$oto_bundle"' EXIT HUP INT TERM
npx --yes esbuild tests/oto-sandbox.test.ts --bundle --platform=node --format=cjs --packages=external --alias:@/lib/admin-access=./tests/fixtures/admin-access.ts --alias:@=./src --alias:server-only=./node_modules/next/dist/compiled/server-only/empty.js --outfile="$oto_bundle"
node --test "$oto_bundle"
