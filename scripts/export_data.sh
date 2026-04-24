#!/usr/bin/env bash
# Export pilot data as CSV for analysis in the ai-teen project.
# Works against a local SQLite file. On the source Mac, grab a fresh copy
# from the target first:
#   scp marx@marxs-imac:~/Developer/_mercury-pilot/data/pilot.sqlite ./data/
#
# Usage:
#   ./scripts/export_data.sh [db_path] [out_dir]
# Defaults:
#   db_path = ./data/pilot.sqlite
#   out_dir = ./data-export

set -euo pipefail

DB="${1:-./data/pilot.sqlite}"
OUT="${2:-./data-export}"

if [[ ! -f "$DB" ]]; then
  echo "!! DB not found at $DB"
  exit 1
fi
mkdir -p "$OUT"

run() {
  local name="$1"
  local sql="$2"
  echo "→ $name"
  sqlite3 -header -csv "$DB" "$sql" > "$OUT/$name.csv"
}

run participants \
  "select id, participant_code, age, consent_at, enrolled_at from participants order by enrolled_at;"
run messages \
  "select id, participant_id, role, content, created_at from messages order by created_at;"
run esm_responses \
  "select id, participant_id, survey_id, answers, triggered_at, submitted_at from esm_responses order by submitted_at;"
run esm_surveys \
  "select id, slug, title, questions, active, created_at from esm_surveys;"

echo
echo "Done. CSVs in $OUT/"
