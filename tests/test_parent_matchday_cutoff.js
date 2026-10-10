#!/usr/bin/env node
// Parents stop being asked to Respond to a matchday 3 hours after kick-off / group start.
process.env.TZ='UTC';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const take=(from,to)=>{const a=app.indexOf(from),b=app.indexOf(to,a);assert(a>=0&&b>a,from);return app.slice(a,b);};
let now='2026-10-10T08:00:00Z';
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return new Date(now).getTime();}}

const league={date:'2026-10-10',time:'10:00',competition:'League',opponent:'Bromley Youth Lions',venue:'A'};
const untimed={date:'2026-10-10',competition:'League',opponent:'Eltham Town Hawks',venue:'H'};
const nextWeek={date:'2026-10-17',time:'10:00',competition:'League',opponent:'Lewisham Borough Cobras',venue:'H'};
const groupA={date:'2026-10-10',competition:'U9 Selkent Cup Two - Round 1',opponent:'Chislehurst Wanderers Panthers',venue:'A'};
const groupB={...groupA,opponent:'Lewisham Borough Cobras',venue:'H'};
const group={key:'g',fixtures:[groupA,groupB]};

const ctx={Date:Clock,CLOUD_MODE:true,currentRole:'parent',
  state:{division:{teamName:'Shooters Hill AFC Valiants'},meta:{},selkent:{fixtures:[],results:[]},matches:[]},
  miniCupGroup:f=>f===groupA||f===groupB?group:null,
  parentCupGroupDetails:()=>({time:'09:00'}),
  resolvedFixture:f=>({...f}),
  fixtureLinkedMatch:()=>null,matchStatus:m=>m.status||'played',normalizeTeamKey:s=>String(s||'').toLowerCase()};
vm.createContext(ctx);
vm.runInContext(take('function fixtureIsReported(','function nextPublishedFixture(')+'function nextPublishedFixture(){return upcomingFixtures()[0]||null;}',ctx);
const at=(iso,fixtures)=>{now=iso;ctx.state.selkent.fixtures=fixtures;return JSON.parse(JSON.stringify(ctx.upcomingFixtures().map(f=>f.opponent)));};

// Single league game, kick-off 10:00.
assert.deepEqual(at('2026-10-10T12:59:00Z',[league,nextWeek]),[league.opponent,nextWeek.opponent],'still shown before the 3h window ends');
assert.deepEqual(at('2026-10-10T13:00:00Z',[league,nextWeek]),[nextWeek.opponent],'hidden 3h after kick-off; next fixture takes over');

// Cup group starting 09:00 (the live 10 Oct 2026 case): gone by 12:00, so no Respond at 14:27.
assert.deepEqual(at('2026-10-10T11:59:00Z',[groupA,groupB,nextWeek]),[groupA.opponent,nextWeek.opponent]);
assert.deepEqual(at('2026-10-10T14:27:00Z',[groupA,groupB,nextWeek]),[nextWeek.opponent],'group matchday ended 3h after group start');

// Without a known time the existing end-of-day behaviour is kept.
assert.deepEqual(at('2026-10-10T20:00:00Z',[untimed]),[untimed.opponent]);

// Coaches keep the fixture so they can record the result.
ctx.currentRole='coach';
assert.deepEqual(at('2026-10-10T14:27:00Z',[league,nextWeek]),[league.opponent,nextWeek.opponent],'coach view unchanged');

console.log('PASS parent matchday ends 3 hours after kick-off or group start; coach view unchanged');
