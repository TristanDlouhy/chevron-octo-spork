#!/usr/bin/env bash
# Run every line of a plan file (from plan.ts) in order, then evaluate it. Existing runs are skipped.
# Usage: harness/run-plan.sh <planFile> [outRoot]
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
OUT_ROOT=${2:-${CHEVRON_RUNS:-$HOME/chevron-runs}}
grep -v '^#' "$1" | while read -r VARIANT AGENT REP; do
  [[ -z "$VARIANT" ]] && continue
  RUN="$OUT_ROOT/${VARIANT}-${AGENT}-r${REP}"
  if [[ -e "$RUN/meta.json" ]]; then
    echo "skip $(basename "$RUN")"
    continue
  fi
  "$HERE/run-one.sh" "$VARIANT" "$AGENT" "$REP" "$OUT_ROOT"
  "$HERE/evaluate.sh" "$RUN"
done
