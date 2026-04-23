#!/usr/bin/env bash
# Export pilot data as CSV for analysis in the ai-teen project.
# Requires: supabase CLI authenticated and linked to the project.
#
# Usage:
#   ./scripts/export_data.sh [output_dir]
#
# Writes:
#   <out>/participants.csv
#   <out>/messages.csv
#   <out>/esm_responses.csv

set -euo pipefail

OUT_DIR="${1:-./data-export}"
mkdir -p "$OUT_DIR"

run() {
  local name="$1"
  local sql="$2"
  echo "→ $name"
  supabase db execute --file <(echo "$sql") --format csv > "$OUT_DIR/$name.csv"
}

run participants "select id, participant_code, age, consent_at, enrolled_at from public.participants order by enrolled_at;"
run messages "select id, participant_id, role, content, created_at from public.messages order by created_at;"
run esm_responses "select id, participant_id, survey_id, answers::text as answers, triggered_at, submitted_at from public.esm_responses order by submitted_at;"

echo "Done. CSVs written to $OUT_DIR/"
