const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createHarness}=require('./test_matchday_dashboard_layout');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
async function verify(){
  const {c,node,own}=createHarness();
  const take=(a,b)=>{
    const start=source.indexOf(a),end=source.indexOf(b,start);
    assert(start>=0&&end>start,`Source functions found: ${a} / ${b}`);
    return source.slice(start,end);
  };
  // Exercise the shared canonical timing model and final Home / Matches renderer.
  c.fixtureCompetitionLabel=f=>f.competition;
  c.ownTeamDisplayName=()=>own;
  vm.runInContext(take('function canonicalMatchCardData(', 'function applyCanonicalMatchCard('),c);
  c.canonicalMatchCardFrameworkV11=()=>({rows:''});
  vm.runInContext(take('function canonicalMatchCardFrameworkV13Recovery(', 'function canonicalUpcomingEventKeyV13('),c);
  // canonicalCardRowData is loaded by createHarness. Load the real compact Home
  // renderer too: its header and footer deliberately split the full timestamp.
  vm.runInContext(take('function renderHomeFixturePreview(', 'function applyCanonicalRecoveryV13('),c);
  vm.runInContext(take('function applyCanonicalRecoveryV13(', 'function canonicalRecoveryNextEventV13('),c);
  c.document.querySelectorAll=()=>[];c.document.querySelector=()=>null;
  for(const id of ['next-match-versus','next-match-home-teams','matches-next-versus']){node(id).closest=()=>null;}
  node('next-fixture-dialog').classList.add=()=>{};
  node('matches-next-card').classList.add=()=>{};
  c.removeOpponentKitRowsV13=()=>{};
  const attributes=new Map(),homeDate=node('next-match-home-date');
  homeDate.setAttribute=(name,value)=>attributes.set(name,String(value));
  homeDate.getAttribute=name=>attributes.get(name)??null;
  homeDate.removeAttribute=name=>attributes.delete(name);
  const agreement=expectedFooter=>{
    const f=c.fixtures[0];
    c.applyCanonicalRecoveryV13('next-match',f);c.applyCanonicalRecoveryV13('matches-next',f);
    const full=node('matchday-dashboard-kickoff').textContent;
    const [date,timing]=full.split(' · ');
    assert.equal(homeDate.textContent,'10 Oct','approved Home header shows day/month alone');
    assert.equal(homeDate.getAttribute('datetime'),f.date,'Home retains the full machine-readable date');
    assert.equal(homeDate.getAttribute('aria-label'),date,'Home retains the full accessible date');
    assert.equal(node('home-fixture-meta').textContent,expectedFooter,'Home footer retains accurate venue and timing');
    assert(node('home-fixture-meta').textContent.endsWith(timing),'compact Home timing agrees with the full dashboard timestamp');
    assert.equal(node('next-match-when').textContent,full,'fixture details retain the full timestamp');
    assert.equal(node('matches-next-when').textContent,full,'Matches retains the full timestamp');
  };
  c.fixtures=[{date:'2026-10-10',competition:'League',opponent:'Example',venue:'H'}];
  c.state.selkent.fixtures=c.fixtures;
  c.details={time:'10:00',groundName:'Example ground'};c.confirmed=false;c.ack={status:'awaiting'};
  await c.renderMatchdayDashboard();agreement('Home · Kick-off 10:00');
  assert.equal(node('matchday-dashboard-kickoff').textContent,'10 Oct 26 · Kick-off 10:00');
  assert.equal(node('matchday-dashboard-confirmation').textContent,'Match details awaiting confirmation');
  assert.equal(node('matchday-dashboard-status').textContent,'Fixture acknowledgement pending');
  assert.equal(node('matchday-dashboard-availability').textContent,'2 awaiting a reply');
  assert.equal(node('matchday-dashboard-availability-breakdown').textContent,'8 available · 0 unsure · 0 unavailable · 2 awaiting');
  c.confirmed=true;c.ack={status:'changed',detail:'Time changed to 10:00'};
  await c.renderMatchdayDashboard();agreement('Home · Kick-off 10:00');
  assert.equal(node('matchday-dashboard-status').textContent,'Fixture changed: reconfirm');
  assert(!node('matchday-dashboard-alert').classList.contains('hidden'));
  assert.equal(c.ack.status,'changed','rendering never acknowledges a change');
  c.ack={status:'confirmed'};c.counts={available:5,unsure:1,unavailable:2,'no-response':0};
  await c.renderMatchdayDashboard();agreement('Home · Kick-off 10:00');
  assert.equal(node('matchday-dashboard-confirmation').textContent,'Match details confirmed');
  assert.equal(node('matchday-dashboard-availability').textContent,'5 available');
  c.details={};await c.renderMatchdayDashboard();agreement('Home · Kick-off TBC');
  assert.equal(node('matchday-dashboard-kickoff').textContent,'10 Oct 26 · Kick-off TBC');
  c.fixtures=[{...c.fixtures[0],competition:'Cup',venue:'A'},{...c.fixtures[0],competition:'Cup',opponent:'Second',venue:'H'}];
  c.state.selkent.fixtures=c.fixtures;
  c.details={time:'09:00'};c.confirmed=false;await c.renderMatchdayDashboard();agreement('Group starts 09:00');
  assert.equal((node('next-match-home-teams').innerHTML.match(/class="home-fixture-row"/g)||[]).length,2,'real canonical Cup rows populate the compact Home preview');
  assert.equal(node('matchday-dashboard-kickoff').textContent,'10 Oct 26 · Group starts 09:00');
  assert.equal(node('matchday-dashboard-venue').textContent,'Marathon Sports Ground');
  c.details={};await c.renderMatchdayDashboard();agreement('Group start TBC');
  assert.equal(node('matchday-dashboard-kickoff').textContent,'10 Oct 26 · Group start TBC');
  c.coach=false;await c.renderMatchdayDashboard();assert(node('matchday-dashboard').classList.contains('hidden'));
  console.log('PASS known, missing, confirmed and changed timing; compact Home date/accessibility/footer and full detail/Matches/dashboard agreement; mixed-venue group start; availability and parent visibility');
}
verify().catch(e=>{console.error(e);process.exitCode=1;});
