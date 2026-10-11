const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('app/src/main/assets/app.js','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const nodes=new Map();
function node(id){if(!nodes.has(id)){const classes=new Set();nodes.set(id,{textContent:'',classList:{add:x=>classes.add(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)},contains:x=>classes.has(x)}});}return nodes.get(id);}
let admin=true,refreshes=[];
const tabs=['fixtures','results'].map(tab=>({dataset:{clubTab:tab},classList:{toggle(){}},setAttribute(k,v){this[k]=v}}));
const c=vm.createContext({CLOUD_MODE:true,currentRole:'admin',currentView:'club',__clubTab:'overview',__adminOverviewStamp:Date.now(),
 document:{getElementById:node,querySelectorAll:s=>s==='[data-club-tab]'?tabs:[]},
 isAdmin:()=>admin,isClubOverviewMode:()=>admin,isAdminCoachMode:()=>false,roleLabel:()=> 'Coach',
 refreshAdminFixtures:()=>refreshes.push('fixtures'),refreshClubResults:()=>refreshes.push('results'),refreshClubCoaches(){},adminWeekendShareIdentity:()=>'',
 renderTeamIdentity(){},syncNavigationUrl(){},navigate:()=>refreshes.push('home')});
vm.runInContext(src.slice(src.indexOf("let __clubTab='overview';"),src.indexOf('function refreshCoachClubResults(')),c);
// Exercise the real overview refresh visibility path with a fresh cache.
vm.runInContext(src.slice(src.indexOf('async function refreshAdminClubOverview('),src.indexOf('\nasync function ',src.indexOf('async function refreshAdminClubOverview(')+10)),c);
(async()=>{
 c.setClubTab('fixtures');
 assert.deepEqual(refreshes,['fixtures'],'Fixtures does not fetch or reopen Club Home');
 assert.equal(node('admin-club-overview').classList.contains('hidden'),true);
 assert.equal(node('club-fixtures-panel').classList.contains('hidden'),false);
 assert.equal(node('club-results-panel').classList.contains('hidden'),true);
 assert.equal(node('club-matches-switch').classList.contains('hidden'),false);
 assert.equal(tabs[0]['aria-pressed'],'true');
 await c.refreshAdminClubOverview(true);
 assert.equal(node('admin-club-overview').classList.contains('hidden'),true,'background Home refresh must not reveal Home on Fixtures');
 c.setClubTab('results');await c.refreshAdminClubOverview(true);
 assert.equal(node('admin-club-overview').classList.contains('hidden'),true);
 assert.equal(node('club-fixtures-panel').classList.contains('hidden'),true);
 assert.equal(node('club-results-panel').classList.contains('hidden'),false);
 assert.equal(tabs[1]['aria-pressed'],'true');
 c.setClubTab('overview');await c.refreshAdminClubOverview(true);
 assert.equal(node('admin-club-overview').classList.contains('hidden'),false);
 admin=false;c.currentRole='coach';c.setClubTab('fixtures');
 assert.equal(vm.runInContext('__clubTab',c),'results','coach permissions do not gain club-wide Fixtures');
 assert.equal(node('club-fixtures-panel').classList.contains('hidden'),true);
 assert.equal(node('club-matches-switch').classList.contains('hidden'),true);
 c.currentRole='parent';c.setClubTab('results');assert.equal(refreshes.at(-1),'home');
 const fixtures=html.slice(html.indexOf('id="club-fixtures-slot"'),html.indexOf('id="club-results-slot"'));
 assert.equal((fixtures.match(/id="admin-fixture-list"/g)||[]).length,1);
 assert.equal((fixtures.match(/>Share weekend</g)||[]).length,1);
 assert.doesNotMatch(fixtures,/admin-weekend-list|Weekend at a glance/);
 assert.doesNotMatch(src.slice(src.indexOf('function clubResultsTableHTML('),src.indexOf('function renderAdminRecentResults(')),/Status \/ result|<th>H\/A<\/th>/);
 console.log('Club Matches section separation and permissions checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
