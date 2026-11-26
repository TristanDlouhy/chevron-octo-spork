#!/usr/bin/env bash
# One benchmark run: fresh workspace from the scaffold, agent in a clean container, artefacts saved.
# Usage: harness/run-one.sh <variant> <agentId> <repetition> [outRoot]
set -euo pipefail

VARIANT=$1
AGENT=$2
REP=$3
OUT_ROOT=${4:-${CHEVRON_RUNS:-$HOME/chevron-runs}}
HERE=$(cd "$(dirname "$0")" && pwd)
BENCH=$(cd "$HERE/.." && pwd)
IMAGE=${CHEVRON_IMAGE:-chevron-bench:latest}
TIMEOUT=${CHEVRON_TIMEOUT:-45m}

read -r TOOL MODEL < <(node -e '
  const a = require(process.argv[1])[process.argv[2]];
  if (!a) { console.error("unknown agent " + process.argv[2]); process.exit(2); }
  if (a.model === "SET_ME") { console.error("set the model of " + process.argv[2] + " in harness/agents.json"); process.exit(2); }
  console.log(a.tool + " " + a.model);
' "$HERE/agents.json" "$AGENT")

RUN_ID="${VARIANT}-${AGENT}-r${REP}"
RUN="$OUT_ROOT/$RUN_ID"
if [[ -e "$RUN" ]]; then
  echo "run $RUN_ID exists already; never overwrite a run" >&2
  exit 1
fi
mkdir -p "$RUN/work" "$RUN/logs"

# Workspace: scaffold plus the variant's extra files. Nothing else from the repository.
cp -R "$BENCH/task/scaffold/." "$RUN/work/"
if [[ -d "$BENCH/variants/$VARIANT/extra" ]]; then
  cp -R "$BENCH/variants/$VARIANT/extra/." "$RUN/work/"
fi
cp "$BENCH/variants/$VARIANT/prompt.md" "$RUN/prompt.md"

docker run --rm -v "$RUN/work:/work" "$IMAGE" sh -c '
  npm install --no-audit --no-fund --loglevel=error >/dev/null &&
  git init -q && git add -A &&
  git -c user.name=bench -c user.email=bench@localhost commit -qm scaffold'

case "$TOOL" in
  claude)
    AGENT_CMD='claude -p "$(cat /prompt.md)" --model "$MODEL" --output-format stream-json --verbose \
      --permission-mode bypassPermissions --disallowedTools WebSearch WebFetch \
      --strict-mcp-config --no-session-persistence'
    ;;
  gemini)
    AGENT_CMD='gemini -m "$MODEL" -p "$(cat /prompt.md)" --approval-mode yolo --skip-trust \
      --output-format stream-json'
    ;;
  *)
    echo "unknown tool $TOOL" >&2
    exit 2
    ;;
esac

START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
set +e
docker run --rm --env-file "$HERE/.env" -e MODEL="$MODEL" \
  -v "$RUN/work:/work" -v "$RUN/prompt.md:/prompt.md:ro" \
  "$IMAGE" timeout "$TIMEOUT" sh -c "$AGENT_CMD" \
  >"$RUN/logs/transcript.jsonl" 2>"$RUN/logs/stderr.log"
EXIT=$?
set -e
END=$(date -u +%Y-%m-%dT%H:%M:%SZ)

docker run --rm -v "$RUN/work:/work" "$IMAGE" sh -c '
  git add -A && git -c user.name=bench -c user.email=bench@localhost commit -qm "agent result" --allow-empty'

VERSIONS=$(docker run --rm "$IMAGE" sh -c 'echo "{\"node\":\"$(node --version)\",\"claude\":\"$(claude --version | cut -d" " -f1)\",\"gemini\":\"$(gemini --version)\"}"')
cat >"$RUN/meta.json" <<JSON
{
  "runId": "$RUN_ID",
  "variant": "$VARIANT",
  "agent": "$AGENT",
  "tool": "$TOOL",
  "model": "$MODEL",
  "repetition": $REP,
  "start": "$START",
  "end": "$END",
  "exitCode": $EXIT,
  "timedOut": $([[ $EXIT -eq 124 ]] && echo true || echo false),
  "versions": $VERSIONS
}
JSON
echo "$RUN_ID finished with exit code $EXIT"
