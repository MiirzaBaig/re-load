#!/bin/sh
# Generate mock provider pages and exercise them in a real browser. No private env/provider writes.
# Requires Playwright; RELOAD_PLAYWRIGHT_MODULE may point to an external installation.
set -eu
ui_test_bundle=".zid-checkout-ui-test-$$.cjs"
ui_fixture_dir=$(mktemp -d "${TMPDIR:-/tmp}/reload-checkout-ui.XXXXXX")
trap 'rm -f "$ui_test_bundle"; rm -rf "$ui_fixture_dir"' EXIT HUP INT TERM
export RELOAD_CHECKOUT_UI_DIR="$ui_fixture_dir"
sh scripts/test-zid-dev-checkout.sh
npx --yes esbuild tests/zid-checkout-ui.test.ts --bundle --platform=node --format=cjs --packages=external --alias:@=./src --alias:server-only=./node_modules/next/dist/compiled/server-only/empty.js --outfile="$ui_test_bundle"
node --test "$ui_test_bundle"
