import test from 'node:test';
import assert from 'node:assert/strict';
import { isPilotOrigin } from '../src/pilot-hosts.js';

test('only the two exact HTTPS pilot origins are admitted', () => {
  for (const host of ['test.pitchkind.com', 'shootershillafc.app']) {
    assert.equal(isPilotOrigin(new URL(`https://${host}/__pilot_badges/250/example`)), true);
    for (const url of [`http://${host}/`, `https://${host}:8443/`,
      `https://${host}.evil.test/`]) {
      assert.equal(isPilotOrigin(new URL(url)), false, url);
    }
  }
  for (const url of ['https://pitchkind.com/', 'https://www.shootershillafc.app/',
    'https://test.shootershillafc.app/', 'https://grassroots-club-hub.example.workers.dev/']) {
    assert.equal(isPilotOrigin(new URL(url)), false, url);
  }
});
