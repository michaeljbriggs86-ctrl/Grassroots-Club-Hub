#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('app/src/main/assets/app.js', 'utf8');
const start = source.indexOf('function canConfirmFixtureDetails()');
const end = source.indexOf('function groundOptionsForFixture(', start);
assert.ok(start >= 0 && end > start, 'Fixture confirmation guard must exist');

function allowed({coach, edit, cloud = true}) {
  const context = {
    CLOUD_MODE: cloud,
    isCoach: () => coach,
    window: {ClubHubCloud: {canEdit: () => edit}}
  };
  vm.runInNewContext(source.slice(start, end), context);
  return context.canConfirmFixtureDetails();
}

assert.equal(allowed({coach: false, edit: false}), false, 'Club Admin preview cannot confirm');
assert.equal(allowed({coach: true, edit: false}), false, 'No save permission means no confirmation');
assert.equal(allowed({coach: true, edit: true}), true, 'Assigned coach can confirm');
assert.equal(allowed({coach: true, edit: false, cloud: false}), true, 'Bundled offline coach path remains available');
console.log('PASS fixture confirmation is limited to a coach with cloud save permission');
