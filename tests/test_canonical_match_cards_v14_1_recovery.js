#!/usr/bin/env node
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const css=fs.readFileSync('app/src/main/assets/styles.css','utf8');
let failures=0;
function check(name,fn){try{fn();console.log('PASS '+name)}catch(e){failures++;console.error('FAIL '+name+': '+e.message)}}
function take(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i,`slice ${a} -> ${b}`);return s.slice(i,j)}
function classes(initial=[]){const s=new Set(initial);return{add:n=>s.add(n),remove:n=>s.delete(n),contains:n=>s.has(n),toggle(n,f){if(f===undefined){s.has(n)?s.delete(n):s.add(n);return s.has(n)}f?s.add(n):s.delete(n);return!!f}}}
function box(){return{classList:classes(),querySelectorAll:()=>[]}}

check('T1 - finalizer updates every real next-match target',()=>{
  for(const id of ['next-match-home-teams','next-match-versus','matches-next-versus','match-detail-versus','next-match-home-date','next-match-when','matches-next-when'])
    assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,`${id} exactly once`);
  const src=take(app,'function applyCanonicalRecoveryV13','function canonicalRecoveryNextEventV13');
  assert.doesNotMatch(src,/match-detail-when/,"dead Match Details time target must be removed");
  assert.doesNotMatch(src,/\.find\(Boolean\)/);
  const dc=box(),dlg=box(),dh={innerHTML:'',classList:classes(),closest:()=>dc},vh={innerHTML:'',classList:classes(),closest:()=>dlg},dd={textContent:''},vd={textContent:''};
  const nodes={'next-match-home-teams':dh,'next-match-versus':vh,'next-match-home-date':dd,'next-match-when':vd};
  let mapCalls=0;
  const ctx={document:{getElementById:id=>nodes[id]||null,querySelectorAll:()=>[]},canonicalMatchCardFrameworkV13Recovery:()=>({group:false,rows:'<b>row</b>',date:'4 Oct 26',time:'09:00',ground:'Ground',address:'Address'}),setStableHtml:(e,m)=>e.innerHTML=m,removeOpponentKitRowsV13:()=>{},setMapPreview:()=>mapCalls++};
  vm.createContext(ctx);vm.runInContext(src,ctx);ctx.applyCanonicalRecoveryV13('next-match',{});
  assert.equal(dh.innerHTML,vh.innerHTML);assert.equal(dd.textContent,'4 Oct 26 · Kick-off 09:00');assert.equal(vd.textContent,'4 Oct 26 · Kick-off 09:00');assert.equal(dh.classList.contains('canonical-v14-dashboard-host'),true);assert.equal(mapCalls,0);
  ctx.applyCanonicalRecoveryV13('next-match',null);assert.equal(dh.classList.contains('canonical-v14-dashboard-host'),false);
});

check('T1b - wrapper order restores confirmed dialog time',()=>{
  const dc=box(),dlg=box(),dh={innerHTML:'',classList:classes(),closest:()=>dc},vh={innerHTML:'',classList:classes(),closest:()=>dlg},dd={textContent:'Date TBC'},vd={textContent:'TBC'},nodes={'next-match-home-teams':dh,'next-match-versus':vh,'next-match-home-date':dd,'next-match-when':vd,'next-match-opponent':{textContent:''},'next-match-ground':{textContent:''},'next-match-address':{textContent:''},'next-fixture-dialog':dlg};
  const f={date:'2026-10-04',time:'',opponent:'Phoenix Sports Panthers',venue:'H',competition:'League'};const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const ctx={state:{selkent:{fixtures:[f]}},document:{getElementById:id=>nodes[id]||null,querySelectorAll:()=>[]},renderFixtureOverview:(p)=>{if(p==='next-match')vd.textContent='4 Oct 26 · Kick-off awaiting confirmation'},renderMatchOverview:()=>{},openNextFixtureDetails:()=>{},renderNextMatch:()=>{},renderMatchPageNextFixture:()=>{},nextPublishedFixture:()=>f,upcomingFixtures:()=>[f],miniCupGroup:()=>null,parentCupGroupDetails:()=>null,resolvedFixture:x=>({...x,time:'09:00',groundName:'Ground',address:'Address'}),fixtureCompetitionLabel:()=>'Under 9D Navy',homeFixtureTeamNames:()=>({home:'Shooters Hill AFC Valiants',away:'Phoenix Sports Panthers'}),clubIdentityBadgeHtml:n=>`<img alt="${n}">`,formatDate:()=>'4 Oct 26',matchTeamLabel:s=>String(s||''),selkentNorm:norm,esc:s=>String(s||''),setStableHtml:(e,m)=>{if(e)e.innerHTML=m},mapsHref:()=>'',mapsEmbedHref:()=>'',console};
  vm.createContext(ctx);const start=app.indexOf('/* Canonical match cards v10');assert.ok(start>=0);vm.runInContext(app.slice(start),ctx);ctx.renderFixtureOverview('next-match',f);
  assert.equal(vd.textContent,'4 Oct 26 · Kick-off 09:00');assert.equal(dd.textContent,'4 Oct 26 · Kick-off 09:00');assert.match(vh.innerHTML,/canonical-v13-rows/);assert.match(dh.innerHTML,/canonical-v13-rows/);assert.equal(dlg.classList.contains('canonical-match-card-active'),true);
});

check('T2 - Dashboard host neutralises legacy grid',()=>{
  assert.match(css,/#next-match-home-teams\.canonical-v14-dashboard-host\s*\{[\s\S]*?display:block;[\s\S]*?width:100%;[\s\S]*?min-width:0;/);
  assert.match(css,/\.canonical-match-card-active \.next-fixture-versus,\.canonical-match-card-active \.match-versus\{display:block\}/);
  const i=css.indexOf('/* V14.1');assert.ok(i>=0);assert.doesNotMatch(css.slice(i),/badge[^{}]*\{[^}]*(width|height|font-size)\s*:/i);
});

check('T3 - Match played helper enforces role and Cup boundary',()=>{
  const a=app.indexOf('function syncMatchPlayedActionV141'),b=app.indexOf('\nfunction renderMatchPageNextFixture',a);assert.ok(a>=0&&b>a);
  const button={classList:classes(['hidden'])};let coach=false,group=false;const ctx={document:{getElementById:id=>id==='matches-next-played'?button:null},isCoach:()=>coach,canConfirmFixtureDetails:()=>coach,miniCupGroup:()=>group?{}:null};vm.createContext(ctx);vm.runInContext(app.slice(a,b),ctx);
  ctx.syncMatchPlayedActionV141(null);assert.equal(button.classList.contains('hidden'),true);coach=true;ctx.syncMatchPlayedActionV141({competition:'League'});assert.equal(button.classList.contains('hidden'),false);coach=false;ctx.syncMatchPlayedActionV141({competition:'League'});assert.equal(button.classList.contains('hidden'),true);coach=true;group=true;ctx.syncMatchPlayedActionV141({competition:'Cup'});assert.equal(button.classList.contains('hidden'),false);assert.equal(button.textContent,'Record group result');coach=false;ctx.syncMatchPlayedActionV141({competition:'Cup'});assert.equal(button.classList.contains('hidden'),true);
  assert.match(css,/body\.admin-preview-mode \[data-requires-edit\]\{display:none!important\}/);
});

check('T4 - existing Match played click route remains single',()=>{
  const line="document.getElementById('matches-next-played')?.addEventListener('click',openNextFixtureMatchReport);";assert.equal(app.split(line).length-1,1);let h=null,n=0;const ctx={document:{getElementById:()=>({addEventListener:(e,f)=>{assert.equal(e,'click');h=f}})},openNextFixtureMatchReport:()=>n++};vm.runInNewContext(line,ctx);h();assert.equal(n,1);
});

if(failures){console.error(`V14.1 RECOVERY TESTS FAILED: ${failures}`);process.exit(1)}
console.log('PASS V14.1 dashboard/dialog/Match played recovery suite');
