#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('app/src/main/assets/app.js', 'utf8');
const start = source.indexOf('function matchdayArrivalTime(');
const end = source.indexOf('async function shareNextMatchImage(', start);
assert.ok(start >= 0 && end > start, 'Matchday text and copy helpers must exist');

async function check(coach, confirmed) {
  const copied = [], notices = [];
  const fixture = {date: '2026-09-27', opponent: 'Junior Reds Sabres', venue: 'A'};
  const context = {
    Date, Intl, canConfirmFixtureDetails: () => coach,
    nextPublishedFixture: () => fixture,
    fixtureDetailsConfirmed: () => confirmed,
    resolvedFixture: () => ({time: '10:30', groundName: 'Crook Log', address: 'Brampton Road'}),
    homeFixtureTeamNames: () => ({home: 'Junior Reds Sabres', away: 'Shooters Hill Valiants'}),
    fixtureOverviewContext: () => ({ownProfile: {home: 'Green and white'}}),
    fixtureKitChoice: () => 'home',
    kitColourDisplayText: x => x,
    mapsShareHref: () => 'https://www.google.com/maps/search/?api=1&query=Crook%20Log',
    navigator: {clipboard: {writeText: text => {copied.push(text);return Promise.resolve();}}},
    toast: message => notices.push(message),
  };
  vm.runInNewContext(source.slice(start, end), context);
  await context.copyNextMatchDetails();
  return {copied, notices};
}

(async () => {
  const ok = await check(true, true);
  assert.match(ok.copied[0], /Kick-off: 10:30\nArrival: 10:00/);
  assert.match(ok.copied[0], /Maps: https:\/\/www\.google\.com\/maps\/search/);
  assert.equal((await check(true, false)).copied.length, 0);
  assert.equal((await check(false, true)).copied.length, 0);
  console.log('PASS confirmed match details copy with arrival and Maps; unconfirmed and read-only views cannot copy');
})().catch(error => {console.error(error);process.exitCode = 1;});
