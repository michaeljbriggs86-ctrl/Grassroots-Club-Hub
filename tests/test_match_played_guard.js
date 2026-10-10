#!/usr/bin/env node
// "Match played" / "Record group result" only appears from the fixture's own date.
process.env.TZ='Europe/London';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const take=(from,to)=>{const a=app.indexOf(from),b=app.indexOf(to,a);assert(a>=0&&b>a,from);return app.slice(a,b);};
let now='2026-10-10T08:00:00Z';
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return new Date(now).getTime();}}
const classes=()=>{const set=new Set(['hidden']);return {add:k=>set.add(k),remove:k=>set.delete(k),contains:k=>set.has(k),toggle(k,on){on?set.add(k):set.delete(k);}};};
const button={classList:classes(),textContent:''};
let next=null,further=[],opened=0;
const ctx={Date:Clock,document:{getElementById:id=>id==='matches-next-played'?button:null},
  canConfirmFixtureDetails:()=>true,miniCupGroup:()=>null,
  nextPublishedFixture:()=>next,groupedUpcomingFixtures:()=>[next,...further],
  openFixtureMatchReport:()=>opened++,openCupGroupResultChooser:()=>opened++};
vm.createContext(ctx);
vm.runInContext(take('function syncMatchPlayedActionV141(','function renderMatchPageNextFixture(')+take('function openNextFixtureMatchReport(','function fixtureStableKey(')+';',ctx);
const shown=f=>{ctx.syncMatchPlayedActionV141(f);return !button.classList.contains('hidden');};

const future={date:'2026-10-17',competition:'League',opponent:'Bromley Youth Lions'};
const today={date:'2026-10-10',competition:'League',opponent:'Eltham Town Hawks'};
const past={date:'2026-10-03',competition:'League',opponent:'Lewisham Borough Cobras'};

assert.equal(shown(future),false,'hidden for a fixture a week away');
assert.equal(shown(today),true,'shown on the fixture date');
assert.equal(shown(past),true,'shown for an unreported past fixture');
assert.equal(shown({competition:'League'}),true,'undated rows stay recordable');
// Local calendar day, not UTC: 23:30 BST on 16 Oct is still before match day.
now='2026-10-16T22:30:00Z';assert.equal(shown(future),false);
now='2026-10-16T23:30:00Z';assert.equal(shown(future),true,'00:30 BST on 17 Oct is match day');

// A stale button cannot record a future result.
now='2026-10-10T08:00:00Z';next=future;further=[future];opened=0;
ctx.openNextFixtureMatchReport();ctx.openFurtherFixtureMatchReport(0);assert.equal(opened,0,'handlers refuse future fixtures');
next=today;further=[today];ctx.openNextFixtureMatchReport();ctx.openFurtherFixtureMatchReport(0);assert.equal(opened,2);

// Every render path uses the guard.
assert.match(app,/canConfirmFixtureDetails\(\)&&matchDayReached\(f\)\?`<button type="button" data-further-match-played=/);
assert.match(app,/const playedAction=isCoach\(\)&&status==='scheduled'&&matchDayReached\(m\)\?/);

console.log('PASS Match played appears only from the fixture date; handlers refuse early recording');
