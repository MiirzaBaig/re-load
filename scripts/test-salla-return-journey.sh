#!/bin/sh
# Actual Edge/WhatsApp handlers, dummy Salla/PostgREST fixtures. Network denied.
# Does not load .env, touch hosted data, send messages or book shipping.
set -eu
"${DENO_BIN:-deno}" test --allow-env --deny-net supabase/functions/tests/salla-return-journey.test.ts
