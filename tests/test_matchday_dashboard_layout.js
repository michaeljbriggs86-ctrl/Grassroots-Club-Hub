const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function createHarness(){
  const source=fs.readFileSync('app/src/main/assets/app.js','utf8'),nodes=new Map();
  const node=id=>{
    if(!nodes.has(id)){const classes=new Set();nodes.set(id,{innerHTML:'',textContent:'',value:'',href:'',className:'',classList:{toggle(k,on){if(on)classes.add(k);else classes.delete(k);},contains:k=>classes.has(k)},removeAttribute(k){this[k]='';}});}
    return nodes.get(id);
  };
  const own='Shooters Hill AFC Valiants';
  const fixtures=[{date:'2026-10-10',time:'09:00',competition:'U9 Selkent Cup Two - Round 1',opponent:'Chislehurst Wanderers Panthers',venue:'A'},{date:'2026-10-10',time:'09:00',competition:'U9 Selkent Cup Two - Round 1',opponent:'Lewisham Borough Cobras',venue:'H'}];
  const c={state:{selkent:{fixtures},tactics:{formation:'2–3–1'},meta:{}},window:{},document:{getElementById:node},__matchdayNoteStamp:'',
    fixtures,confirmed:true,coach:true,preview:false,details:{time:'09:00',groundName:'Marathon Sports Ground',address:'Shooters Hill'},context:{ground:'Wrong opponent ground',address:'Wrong opponent address',mapHref:'wrong-map'},
    isCoach:()=>c.coach,isAdminTeamPreviewMode:()=>c.preview,nextPublishedFixture:()=>c.fixtures[0]||null,
    miniCupGroup:f=>c.fixtures.length===2?{date:f.date,competition:f.competition,fixtures:c.fixtures}:null,
    parentCupGroupDetails:()=>c.details,resolvedFixture:()=>c.details,parentMatchdayReady:()=>c.confirmed,fixtureDetailsConfirmed:()=>c.confirmed,fixtureOverviewContext:()=>c.context,
    ensureTacticsState:()=>{},currentTacticsFixtureKey:()=> 'test',availabilityCounts:()=>({available:8,'no-response':2}),fixtureAckState:()=>({status:'confirmed'}),requiresMatchdaySelection:()=>false,footballFormat:()=>({matchday:10}),activePlayers:()=>Array(10).fill({}),
    kitWarningHtml:()=>'',matchdayFixtureNoteKey:()=>'',formatDate:s=>s.slice(8)+' Oct 26',mapsHref:(...parts)=>'https://maps.example/?q='+encodeURIComponent(parts.join(' ')),
    selkentNorm:s=>String(s||'').toLowerCase(),matchTeamLabel:s=>String(s||'').replace(/_/g,' '),esc:s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'),
    homeFixtureTeamNames:f=>f.venue==='A'?{home:f.opponent,away:own}:{home:own,away:f.opponent},
    clubIdentityBadgeHtml:name=>'<img class="club-identity-badge verified-club-badge" src="shooters-hill-logo.png" alt="'+name+'" />',
    setStableHtml:(el,markup)=>{if(el.innerHTML!==markup)el.innerHTML=markup;}
  };
  vm.createContext(c);
  const slice=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a);vm.runInContext(source.slice(a,b),c);};
  slice('function canonicalCardFixtureRows(f={}){','function canonicalMatchCardData(f={}){');
  slice('async function renderMatchdayDashboard(){','async function saveMatchdayDashboardNote(');
  return {c,node,nodes,own};
}
async function verify(){
  const {c,node}=createHarness();await c.renderMatchdayDashboard();
  const rows=node('matchday-dashboard-opponent').innerHTML;
  assert.equal((rows.match(/class="canonical-match-fixture-row"/g)||[]).length,2,'both group games render once');
  assert(rows.includes('Chislehurst Wanderers Panthers')&&rows.includes('Lewisham Borough Cobras'));
  assert.equal(node('matchday-dashboard-venue').textContent,'Marathon Sports Ground');
  assert.equal(node('matchday-dashboard-address').textContent,'Neutral · Shooters Hill');
  assert.equal(node('matchday-dashboard-kickoff').textContent,'10 Oct 26 · Group starts 09:00');
  assert.equal(node('matchday-dashboard-map').href,c.mapsHref('Marathon Sports Ground','Shooters Hill'),'map follows displayed neutral ground, not opponent venue');
  assert(node('matchday-add-calendar').classList.contains('hidden'));
  c.details={time:'11:00',groundName:'Confirmed alternative ground',address:'Alternative Road, AB1 2CD'};await c.renderMatchdayDashboard();
  assert.equal(node('matchday-dashboard-venue').textContent,'Confirmed alternative ground','explicit cup venue respected');
  assert.equal(node('matchday-dashboard-address').textContent,'Away · Alternative Road, AB1 2CD');
  c.fixtures=[{...c.fixtures[0],competition:'League'}];c.details={time:'10:00',groundName:'Heathside Sports Ground',address:'Horton Road'};await c.renderMatchdayDashboard();
  assert.equal((node('matchday-dashboard-opponent').innerHTML.match(/class="canonical-match-fixture-row"/g)||[]).length,1);
  assert.equal(node('matchday-dashboard-venue').textContent,'Heathside Sports Ground');assert(!node('matchday-add-calendar').classList.contains('hidden'));
  c.details={time:''};c.context={ground:'Ground TBC',address:'Address TBC'};c.confirmed=false;await c.renderMatchdayDashboard();
  assert(node('matchday-dashboard-kickoff').textContent.includes('awaiting confirmation'));assert.equal(node('matchday-dashboard-map').href,'','old map cleared on unconfirmed fixture');assert(node('matchday-dashboard-map').classList.contains('hidden'));
  c.coach=false;c.preview=false;await c.renderMatchdayDashboard();assert(node('matchday-dashboard').classList.contains('hidden'),'parent has no staff matchday preparation panel');
  c.preview=true;await c.renderMatchdayDashboard();assert(!node('matchday-dashboard').classList.contains('hidden'),'admin team preview remains available');
  c.fixtures=[];await c.renderMatchdayDashboard();assert(node('matchday-dashboard').classList.contains('hidden'),'no fixture hides panel');
  c.coach=true;c.preview=false;c.fixtures=[{date:'2026-10-10',competition:'Cup',opponent:'First',venue:'A'},{date:'2026-10-10',competition:'Cup',opponent:'Second',venue:'H'}];c.details={};await c.renderMatchdayDashboard();assert.equal(node('matchday-dashboard-venue').textContent,'Marathon Sports Ground');assert.equal(node('matchday-dashboard-address').textContent,'Neutral · Shooters Hill');
  c.fixtures=[{...c.fixtures[0],competition:'League',venue:'H'}];c.details={groundName:'London Marathon Playing Fields'};await c.renderMatchdayDashboard();assert(node('matchday-dashboard-address').textContent.startsWith('Home'),'league fixture at Marathon retains home designation');
  console.log('PASS Matchday dashboard group rows, confirmed venue/map, fixture switches and staff-only visibility');
}
module.exports={createHarness};
if(require.main===module)verify().catch(e=>{console.error(e);process.exitCode=1;});
