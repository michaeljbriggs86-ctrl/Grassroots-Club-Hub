#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const css=fs.readFileSync('app/src/main/assets/styles.css','utf8');
const start=app.indexOf("let __parentFamilyKey=''");
const end=app.indexOf('async function switchParentFamilyTeam(',start);
assert(start>0&&end>start);
assert(html.includes('id="parent-home-family"')&&html.includes('id="parent-family-linked-list"'));
assert.match(css,/\.club-logo-wrap\{overflow:hidden;isolation:isolate\}/);

const nodes=Object.fromEntries(['parent-home-family','parent-home-family-list','parent-family-linked-list'].map(id=>[id,{innerHTML:'',classList:{toggle(){}}}]));
let team={id:'one',ageGroup:'U9',teamName:'Valiants'};
let resolveOld;
const cloud={
  session:{user:{id:'parent-1'}},currentTeam:()=>team,
  listParentPlayerLinks:async()=>[
    {parent_user_id:'parent-1',team_id:'one',player_name:'Aavi',shirt_number:5},
    {parent_user_id:'other',team_id:'one',player_name:'Other child'},
    {parent_user_id:'parent-1',team_id:'other',player_name:'Wrong team'},
  ],
};
const context={CLOUD_MODE:true,currentRole:'parent',window:{ClubHubCloud:cloud},
  document:{getElementById:id=>nodes[id]||null},matchTeamLabel:x=>x,
  esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
  nextPublishedFixture:()=>({date:'2026-10-04'}),formatDate:()=> '4 Oct 26',Date};
vm.runInNewContext(`${app.slice(start,end)}\nthis.family=refreshParentFamilySummary;this.render=renderParentFamilySummary;`,context);

(async()=>{
  await context.family();
  assert.match(nodes['parent-home-family-list'].innerHTML,/Aavi/);
  assert.match(nodes['parent-home-family-list'].innerHTML,/Match details & availability/);
  assert.match(nodes['parent-family-linked-list'].innerHTML,/Aavi/);
  assert.doesNotMatch(nodes['parent-home-family-list'].innerHTML,/Other child|Wrong team/);

  cloud.listParentPlayerLinks=()=>new Promise(resolve=>{resolveOld=resolve;});
  const stale=context.family(true);
  team={id:'two',ageGroup:'U12',teamName:'Juniors'};
  cloud.listParentPlayerLinks=async()=>[{parent_user_id:'parent-1',team_id:'two',player_name:'Second child'}];
  await context.family();
  resolveOld([{parent_user_id:'parent-1',team_id:'one',player_name:'Aavi'}]);
  await stale;
  assert.match(nodes['parent-home-family-list'].innerHTML,/Second child/);
  assert.doesNotMatch(nodes['parent-home-family-list'].innerHTML,/Aavi/);

  cloud.listParentPlayerLinks=async()=>[];
  await context.family(true);
  assert.match(nodes['parent-home-family-list'].innerHTML,/No child is linked/);
  cloud.listParentPlayerLinks=async()=>{throw Error('offline');};
  await context.family(true);
  assert.match(nodes['parent-home-family-list'].innerHTML,/could not be loaded/);
  console.log('PASS parent home shows only current approved links, handles team switch and empty/error states');
})().catch(err=>{console.error(err);process.exitCode=1;});
