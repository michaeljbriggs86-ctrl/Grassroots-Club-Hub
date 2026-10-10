#!/usr/bin/env node
// Every results list on the Matches page uses the Cups table layout, and coaches keep their row actions.
process.env.TZ='Europe/London';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const take=(from,to)=>{const a=app.indexOf(from),b=app.indexOf(to,a);assert(a>=0&&b>a,from);return app.slice(a,b);};
let now='2026-10-10T10:00:00Z',coach=true;
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return new Date(now).getTime();}}
const list={innerHTML:''},count={textContent:''};
const ctx={Date:Clock,state:{goals:[{matchId:'f1',goals:2}],assists:[{matchId:'f1',assists:1}],awards:[{matchId:'f1'}],bookings:[{matchId:'f1',yellow:1}]},
  document:{getElementById:id=>id==='list'?list:id==='count'?count:null},setStableHtml:(el,html)=>{el.innerHTML=html;},
  esc:s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'),formatDate:s=>s,clubListingHtml:s=>s,
  resultOf:m=>m.status==='scheduled'?'SCH':m.gf>m.ga?'W':m.gf<m.ga?'L':'D',matchStatus:m=>m.status||'played',isPlayedMatch:m=>(m.status||'played')==='played',
  statusLabel:()=>'Scheduled',miniResultsRestrictedView:()=>false,resultClass:r=>'result-'+r,
  isCupMatch:m=>/cup/i.test(m.competition),isVaseMatch:()=>false,isShieldMatch:()=>false,isLeagueMatch:m=>m.competition==='League',isDivisionMatch:()=>false,
  cupNameAndRound:m=>({name:'Selkent Cup Two',round:'Round 1'}),featureEnabled:()=>true,isCoach:()=>coach,isProviderOwnedMatch:m=>m.competition==='League',
  matchDayReached:m=>m.date<='2026-10-10'};
vm.createContext(ctx);
vm.runInContext(take('function matchResultRowHTML(','function renderMatches('),ctx);
const friendly={id:'f1',date:'2026-09-26',opponent:'Lewisham Borough Cobras',competition:'Friendly',venue:'H',gf:2,ga:3};
const today={id:'s1',date:'2026-10-10',opponent:'Eltham Town Hawks',competition:'Friendly',venue:'A',status:'scheduled'};
const league={id:'l1',date:'2026-09-12',opponent:'Bromley Youth Lions',competition:'League',venue:'H',gf:4,ga:2};
const cup={id:'c1',date:'2026-10-10',opponent:'Chislehurst Wanderers Panthers',competition:'U9 Selkent Cup Two - Round 1',venue:'A',gf:3,ga:0};

ctx.renderMatchGroup('list','count',[friendly,today,league,cup],'None');
const h=list.innerHTML;
assert.equal(count.textContent,4);
assert.match(h,/<table class="competition-games-table"><thead><tr><th>Date<\/th><th>Opponent<\/th><th>H\/A<\/th><th>Status \/ result<\/th>/,'grouped lists omit the repeated competition column');
assert.doesNotMatch(h,/<th>Competition<\/th>|<b>Friendly<\/b>|<b>League<\/b>/);
assert.equal((h.match(/<tr class="result-/g)||[]).length,4,'one result row per match');
assert.match(h,/<span class="competition-result-pill L">L 2–3<\/span>/);
assert.match(h,/<span class="competition-result-pill W">W 4–2<\/span>/);
assert.match(h,/<small class="cup-round">Round 1<\/small>/,'match stage remains available without a competition column');
assert.match(h,/data-details-match="f1">Lewisham Borough Cobras<\/button>/,'opponent still opens details');
assert.doesNotMatch(h,/match-detail-badges|⚽|★|⭐|▣/,'stat icons are absent even when the match has goals, awards and bookings');
assert.equal(ctx.state.goals[0].goals,2,'rendering leaves recorded statistics intact');
assert.equal(ctx.state.awards.length,1);
assert.match(h,/<td colspan="4"><div class="match-actions">/,'actions span the revised table');
// Actual cup tables still identify their distinct cup and round.
vm.runInContext(take('function cupNameAndRound(','/** Coach marker:'),ctx);
assert.match(ctx.competitionGameRow(cup),/<b>Selkent Cup Two<\/b><small class="cup-round">Round 1<\/small>/);
// Coach actions survive the layout change.
assert.match(h,/data-edit-match="f1">Edit result</);assert.match(h,/data-delete-match="f1">Remove</);
assert.match(h,/data-edit-match="s1">Edit fixture</);assert.match(h,/data-match-played="s1">Match played</,'match-day guard still decides Match played');
assert.doesNotMatch(h,/data-edit-match="l1"|data-delete-match="l1"/,'provider-owned league result stays read-only');
// Non-coaches get no action lines.
coach=false;ctx.renderMatchGroup('list','count',[friendly,today],'None');assert.doesNotMatch(list.innerHTML,/match-result-actions|data-edit-match|data-delete-match|data-match-played/);
// Empty lists keep the short empty state.
ctx.renderMatchGroup('list','count',[],'No friendlies recorded');assert.equal(list.innerHTML,'<div class="empty-state"><strong>No friendlies recorded</strong></div>');
// Tournament games use the same table.
assert.match(app,/\(games\.length\?matchResultsTableHTML\(games\):'<div class="empty-state compact-empty">No games added yet\.<\/div>'\)/);
console.log('PASS every Matches results list uses the Cups table; coach actions preserved');
