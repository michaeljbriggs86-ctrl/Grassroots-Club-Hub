#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('app/src/main/assets/app.js', 'utf8');
const start = source.indexOf('function mapQuery(');
const end = source.indexOf('function allDivisionTeams(', start);
assert.ok(start >= 0 && end > start, 'Fixture Maps helpers must exist');

function fixtureLink(window) {
  const context = {window, encodeURIComponent};
  vm.runInNewContext(source.slice(start, end), context);
  return context.mapsHref('Crook Log Leisure Centre', 'Brampton Road, DA7 4HH');
}

const query = 'Crook%20Log%20Leisure%20Centre%2C%20Brampton%20Road%2C%20DA7%204HH';
assert.equal(fixtureLink({}), `https://www.google.com/maps/search/?api=1&query=${query}`);
assert.equal(fixtureLink({ClubHubNative: {}}), `geo:0,0?q=${query}`);
const context = {window: {}, encodeURIComponent};
vm.runInNewContext(source.slice(start, end), context);
assert.equal(context.mapsHref('Ground TBC', 'Address TBC'), '');
console.log('PASS browser fixture Maps links use HTTPS; Android retains geo: and unknown venues have no link');
