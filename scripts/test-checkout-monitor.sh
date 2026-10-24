#!/bin/sh
set -eu
monitor_test_bundle=".checkout-monitor-test-$$.cjs"
trap 'rm -f "$monitor_test_bundle"' EXIT HUP INT TERM
npx --yes esbuild tests/checkout-monitor.test.ts --bundle --platform=node --format=cjs --packages=external --outfile="$monitor_test_bundle"
node --test "$monitor_test_bundle"
