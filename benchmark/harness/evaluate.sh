#!/usr/bin/env bash
# Evaluate one finished run: tsc, hidden acceptance tests, token usage. Runs inside the container.
# Usage: harness/evaluate.sh <runDir>
set -euo pipefail

RUN=$(cd "$1" && pwd)
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
IMAGE=${CHEVRON_IMAGE:-chevron-bench:latest}
mkdir -p "$RUN/eval"

docker run --rm -v "$RUN/work:/work" "$IMAGE" sh -c 'npx tsc --noEmit' >"$RUN/eval/tsc.txt" 2>&1 \
  && echo '{"ok":true}' >"$RUN/eval/tsc.json" || echo '{"ok":false}' >"$RUN/eval/tsc.json"

# The hidden tests run from the repository checkout, against the solution mounted read-only.
docker run --rm -v "$REPO:/repo" -v "$RUN/work:/solution:ro" -v "$RUN/eval:/eval" -e SOLUTION_DIR=/solution \
  -w /repo/benchmark "$IMAGE" sh -c \
  'npx vitest run --config acceptance/vitest.config.ts --reporter=json --outputFile=/eval/acceptance.json >/eval/acceptance.log 2>&1 || true'

node "$HERE/tokens.ts" "$RUN/logs/transcript.jsonl" >"$RUN/eval/tokens.json"
echo "evaluated $(basename "$RUN")"
