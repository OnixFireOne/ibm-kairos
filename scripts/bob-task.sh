#!/usr/bin/env bash
# Run one headless Bob task and keep the evidence.
# Usage: scripts/bob-task.sh <taskNN-name> <prompt-file> [mode] [max-cost] [max-turns]
# Needs BOB_API_KEY in the environment (bob run is headless and does not use the SSO login).
set -euo pipefail
name=$1 prompt=$2 mode=${3:-agent} cost=${4:-1.5} turns=${5:-15}
root=$(cd "$(dirname "$0")/.." && pwd)
ts=$(date -u +%Y%m%dT%H%M%SZ)
out="$root/bob_sessions/cli/$ts-$name.json"
mkdir -p "$root/bob_sessions/prompts" "$root/bob_sessions/cli"
cp "$prompt" "$root/bob_sessions/prompts/$name.txt" 2>/dev/null || true
bob run --trust --mode "$mode" --format json --max-cost "$cost" --max-turns "$turns" < "$prompt" > "$out"
node -e '
const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
console.log(`status=${d.status} task_id=${d.stats.task_id} cost=${d.stats.session_costs} tools=${d.stats.tool_calls}`);
console.log(d.last_message);
' "$out"
echo "saved: ${out#$root/}"
