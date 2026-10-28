#!/usr/bin/env bash
# Replay the existing collector privately, then restore its existing R2 key only
# after completeness and independent parser checks. No public endpoint is added.
set -euo pipefail
repo_root=$(git rev-parse --show-toplevel)
recovery_dir=$(mktemp -d "${RUNNER_TEMP:-/tmp}/selkent-recovery.XXXXXX")
cd "$repo_root/cloudflare/selkent-shadow"
wrangler=(npx --yes wrangler@4.142.0)
"${wrangler[@]}" dev --local --test-scheduled --ip 127.0.0.1 --port 8789 \
  --persist-to "$recovery_dir/state" >"$recovery_dir/runtime.log" 2>&1 &
worker_pid=$!
trap 'kill "$worker_pid" 2>/dev/null || true; rm -rf "$recovery_dir"' EXIT
for attempt in $(seq 1 30); do
  if curl --silent --output /dev/null http://127.0.0.1:8789/; then break; fi
  kill -0 "$worker_pid" || { cat "$recovery_dir/runtime.log"; exit 1; }
  sleep 1
done
# Scheduled handler uses exactly the production collector, with a local bucket.
curl --fail --silent --show-error --max-time 240 \
  'http://127.0.0.1:8789/cdn-cgi/local/scheduled?cron=15+%2A%2F6+%2A+%2A+%2A&format=json' \
  >"$recovery_dir/invocation.json" || { cat "$recovery_dir/runtime.log"; exit 1; }
"${wrangler[@]}" r2 object get pitchkind-selkent-shadow/shadow/latest.json \
  --local --persist-to "$recovery_dir/state" --file "$recovery_dir/snapshot.json"
cd "$repo_root"
node cloudflare/selkent-shadow/verify-snapshot.mjs "$recovery_dir/snapshot.json" data/results.json 420
node cloudflare/selkent-shadow/build-candidate.mjs "$recovery_dir/snapshot.json" data/results.json "$recovery_dir/candidate.json"
python cloudflare/selkent-shadow/compare_snapshot.py "$recovery_dir/snapshot.json" data/results.json "$recovery_dir/candidate.json"
# Never replace a newer scheduled collection with this replay.
"${wrangler[@]}" r2 object get pitchkind-selkent-shadow/shadow/latest.json --remote --file "$recovery_dir/previous.json"
node --input-type=module - "$recovery_dir/snapshot.json" "$recovery_dir/previous.json" <<'JS'
import {readFile} from 'node:fs/promises';
const [next,previous]=await Promise.all(process.argv.slice(2).map(p=>readFile(p,'utf8').then(JSON.parse)));
if(!Number.isFinite(Date.parse(previous.collected_at))||Date.parse(previous.collected_at)>Date.parse(next.collected_at))throw Error('Newer or invalid existing private snapshot; stop recovery');
JS
"${wrangler[@]}" r2 object put pitchkind-selkent-shadow/shadow/latest.json --remote --file "$recovery_dir/snapshot.json" --content-type application/json
"${wrangler[@]}" r2 object get pitchkind-selkent-shadow/shadow/latest.json --remote --file "$recovery_dir/readback.json"
cmp "$recovery_dir/snapshot.json" "$recovery_dir/readback.json"
echo 'Existing private collector snapshot refreshed and byte-verified; public feed unchanged.'
