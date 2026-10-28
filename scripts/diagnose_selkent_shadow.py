"""Read-only collector diagnostics. Never emit raw events, HTML or credentials."""
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

WORKER = 'pitchkind-selkent-shadow'
BASE = 'https://api.cloudflare.com/client/v4/accounts/' + os.environ['CLOUDFLARE_ACCOUNT_ID']
TOKEN = os.environ['CLOUDFLARE_API_TOKEN']


def request(path, body=None):
    req = urllib.request.Request(BASE + path,
        data=None if body is None else json.dumps(body).encode(),
        headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.load(response)
        if not data.get('success', True) or data.get('errors'):
            print(json.dumps({'event': 'collector-diagnostic-api-error',
                              'codes': [x.get('code') for x in data.get('errors', [])]}))
            return None
        return data.get('result')
    except urllib.error.HTTPError as exc:
        print(json.dumps({'event': 'collector-diagnostic-http', 'status': exc.code}))
        return None


schedules = request('/workers/scripts/' + WORKER + '/schedules')
if schedules is not None:
    print(json.dumps({'event': 'collector-schedules', 'crons': [s.get('cron') for s in schedules.get('schedules', [])]}))
now = int(time.time() * 1000)
result = request('/workers/observability/telemetry/query', {
    'queryId': 'selkent-collector-diagnostic', 'dry': True, 'view': 'events', 'limit': 100,
    'timeframe': {'from': now - 24 * 60 * 60 * 1000, 'to': now},
    'parameters': {'filters': [{'key': '$metadata.service', 'operation': 'eq',
                               'type': 'string', 'value': WORKER}]},
})
# Only literal error strings present in our collector source may leave the runner.
known = set()
for file in Path('cloudflare/selkent-shadow/src').glob('*.mjs'):
    known.update(re.findall(r"throw new Error\('([^']+)'\)", file.read_text()))
if result is not None:
    events = result.get('events', {}).get('events', [])
    print(json.dumps({'event': 'collector-log-count', 'count': len(events)}))
    for event in events:
        metadata = event.get('$metadata', {})
        if metadata.get('service') != WORKER:
            continue
        serialized = json.dumps(event)
        errors = sorted(error for error in known if error in serialized)
        statuses = re.findall(r'HTTP (\d{3})', serialized)
        worker = event.get('$workers', {})
        print(json.dumps({'event': 'collector-invocation', 'timestamp': event.get('timestamp'),
                          'outcome': worker.get('outcome'), 'known_errors': errors,
                          'provider_http_statuses': sorted(set(statuses)),
                          'error_present': bool(metadata.get('error')),
                          'collection_succeeded': 'selkent-shadow-collected' in serialized}))
