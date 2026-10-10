#!/usr/bin/env node
// Match details: goalscorers / assists / awards open on match day (Mike, 2026-10-10), same rule as "Match played".
process.env.TZ='Europe/London';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const take=(from,to)=>{const a=app.indexOf(from),b=app.indexOf(to,a);assert(a>=0&&b>a,from);return app.slice(a,b);};
let now='2026-10-10T10:00:00Z';
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return new Date(now).getTime();}}
const node=()=>{const set=new Set();return {value:'',textContent:'',innerHTML:'',dataset:{},classList:{toggle(k,on){on?set.add(k):set.delete(k);},contains:k=>set.has(k),add:k=>set.add(k),remove:k=>set.delete(k)},showModal(){}};};
const nodes={};const get=id=>nodes[id]||(nodes[id]=node());
const sections=['goals','assists','awards'].map(f=>Object.assign(node(),{dataset:{detailFeature:f}}));
const ctx={Date:Clock,state:{matches:[{id:'future',date:'2026-10-24',competition:'Friendly',status:'scheduled'},{id:'played',date:'2026-10-03',competition:'League',gf:5,ga:0}]},
  document:{getElementById:get,querySelectorAll:sel=>sel==='[data-detail-feature]'?sections:[]},
  resetMatchReportMode(){},formatDate:s=>s,esc:s=>s,matchScoreText:()=>'',matchStatus:m=>m.status||'played',statusLabel:()=>'Scheduled',
  renderMatchOverview(){},detailPlayerInputs(){},detailBookingInputs(){},renderAwardFields(){},featureEnabled:()=>true,isCoach:()=>true,
  isPlayedMatch:m=>(m.status||'played')==='played',isProviderOwnedMatch:()=>false,refreshMatchOverviewDirectory(){},loadCoachMatchNote(){},loadMatchAttendance(){}};
vm.createContext(ctx);
vm.runInContext(take('function openMatchDetails(','function openMatchReportReview(')+take('function matchDayReached(','\n}\n')+'\n}',ctx);
const hiddenAll=()=>sections.every(s=>s.classList.contains('hidden'));

ctx.openMatchDetails('future');
assert.equal(hiddenAll(),true,'scoring hidden before match day');
assert.equal(get('detail-before-match-note').classList.contains('hidden'),false);
assert.match(get('detail-before-match-note').textContent,/open on match day \(2026-10-24\)/);
assert.equal(get('empty-detail-options').classList.contains('hidden'),true,'"options switched off" message not shown instead');

ctx.openMatchDetails('played');
assert.equal(sections.some(s=>s.classList.contains('hidden')),false,'scoring shown for a played match');
assert.equal(get('detail-before-match-note').classList.contains('hidden'),true);

now='2026-10-24T08:00:00Z';ctx.openMatchDetails('future');
assert.equal(hiddenAll(),false,'scoring opens on the fixture date');
console.log('PASS match details scoring opens on match day');
