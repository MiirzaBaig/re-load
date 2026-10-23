#!/bin/sh
# Real browser POST/referrer regression; all requests are intercepted, no provider writes.
# Requires Playwright, optionally located with RELOAD_PLAYWRIGHT_MODULE.
set -eu
browser_test_bundle=".zid-checkout-browser-test-$$.cjs"
trap 'rm -f "$browser_test_bundle"' EXIT HUP INT TERM
npx --yes esbuild tests/zid-checkout-origin.test.ts --bundle --platform=node --format=cjs --packages=external --alias:@=./src --alias:server-only=./node_modules/next/dist/compiled/server-only/empty.js --outfile="$browser_test_bundle"
node --test "$browser_test_bundle"
