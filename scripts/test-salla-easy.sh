#!/bin/sh
# Local, disposable SQL only. Does not read credentials or call Salla.
set -eu
case "${PGHOST:-localhost}" in localhost|127.0.0.1|/tmp|/var/run/postgresql) ;; *) exit 1;; esac
salla_test_db="reload_salla_easy_$$"
createdb "$salla_test_db"
trap 'dropdb --if-exists "$salla_test_db"' EXIT HUP INT TERM
psql -X -v ON_ERROR_STOP=1 -d "$salla_test_db" -f supabase/tests/salla-easy.sql
