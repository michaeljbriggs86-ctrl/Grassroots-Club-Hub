#!/usr/bin/env node
// Exercise the shipped Home with actual fixture/digest helpers, fallible reads and changing admin context.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8'),html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const take=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start,`${a} exists`);return source.slice(start,end);};
const plain=x=>JSON.parse(JSON.stringify(x));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const key=f=>`${f.date}|${norm(f.opponent||'tbc')}|${f.venue}|${norm(f.competition||'fixture')}`;
let clock=Date.parse('2026-10-11T10:00:00Z'),overview=true,identity='club-a|admin-a';
class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
const nodes=new Map(),routes=[],shares=[],tabs=[];
const node=id=>{if(!nodes.has(id)){const classes=new Set();nodes.set(id,{innerHTML:'',textContent:'',value:'',disabled:false,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)}});}return nodes.get(id);};
const escape=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const c={Date:Clock,Intl,console,CLOUD_MODE:true,isAdmin:()=>overview,isClubOverviewMode:()=>overview,
 clubSettings:()=>({display_name:'Example Juniors FC'}),selkentNorm:norm,normalizeTeamKey:norm,fixtureKitSelectionKey:key,matchStatus:m=>m.status,
 publishedClubTeamData:()=>({results:[]}),verifiedClubResultsFeed:()=>null,isSelkentLeagueDivision:s=>/^under /i.test(s),
 fixtureFingerprint:f=>[f.date,f.time,f.venue,f.opponent].join('|'),fixtureChangeText:()=> 'Changed fixture',pilotKitDefaults:()=>({}),
 document:{getElementById:node},window:{ClubHubCloud:{session:{user:{id:'admin-a'}}}},esc:escape,setStableHtml:(el,value)=>el.innerHTML=value,
 clubListingHtml:escape,formatDate:s=>s,navigate:s=>routes.push(s),setCommunicationsTab:s=>tabs.push(s),populateAssignCoachControls(){},
 __adminOverviewStamp:0,__adminOverviewRows:[],__adminCoachRows:[],__adminPublishedFeed:null,__clubTab:'overview',__adminFixtureWeekend:''};
vm.createContext(c);
vm.runInContext(take('function fixtureStableKey(', 'function fixtureDatedGameKey(')+take('function fixtureAckState(', 'function setFixtureAcknowledgement(')+take('function shirtColoursOnly(', 'function ownTeamDisplayName(')+take('function knownKit(', 'function kitsClash(')+take('function fullClubResultTeamName(', 'function internalAdminClubResults(')+take('function mapQuery(', 'function mapsEmbedHref(')+take('function directoryClubDivision(', 'function publishedClubResults(')+take('function adminFixtureHasResult(', 'function renderAdminFixtures(')+take('function adminShareWeekendDates(', 'async function refreshAdminClubOverview(')+take('async function refreshAdminClubOverview(', '\nlet __teamMembersStamp'),c);
// Identity and sharing are independently exercised by their existing suites; spy on Home's calls.
c.adminWeekendShareIdentity=()=>identity;c.openAdminWeekendShare=weekend=>shares.push(weekend);
const f=(opponent,date='2026-10-11')=>({date,time:'',opponent,venue:'H',competition:'Division'});
const fixture=f('Visitors'),pending=f('Town'),weekday=f('Midweek','2026-10-14');
const row=(id,name,age,fixtures)=>({team:{id,teamName:name,ageGroup:age,leagueName:`Example Juniors FC ${name}`,division:`Under ${age.slice(1)}D Navy`},state:{division:{name:`Under ${age.slice(1)}D Navy`},selkent:{fixtures,fixtureOverrides:{},fixtureKitSelections:{},kitProfiles:{}},matches:[],squad:[{name:'Active'},{name:'Former',status:'left'},{name:'Current',status:'active'}]}});
const a=row('a','Lions','U12',[fixture,weekday]),b=row('b','Green <script>','U9',[pending]);
a.state.selkent.fixtureOverrides[key(fixture)]={time:'10:00',groundName:'Actual School Ground',address:'1 Actual Road',confirmedAt:'2026-10-10T12:00:00Z'};
const rows=[a,b],coaches=[{team_id:'a',full_name:'Coach Alice'}];
const feed={age_groups:rows.map(r=>({age_group:r.team.ageGroup,fixtures:r.state.selkent.fixtures.map(x=>({date:x.date,division_name:r.team.division,home:r.team.leagueName,away:x.opponent}))}))};
const messages=[{recipient_user_id:'admin-a'},{recipient_user_id:'admin-a',read_at:'yesterday'},{recipient_user_id:'another-admin'},{sender_user_id:'admin-a',recipient_user_id:'coach'}];
const notices=[{},{expires_at:'2026-10-12T00:00:00Z'},{expires_at:'2026-10-11T10:00:00Z'},{expires_at:'2026-10-10T00:00:00Z'}];
const snapshot=()=>c.buildAdminHomeSnapshot(rows,coaches,[{id:'request'}],messages,notices,feed,null);
const commit=snap=>{snap.identity=identity;snap.feedWarning=snap.feedWarning||false;c.snap=snap;vm.runInContext('__adminHomeSnapshot=snap',c);c.renderAdminHome(snap);};
const cloud=(overrides={})=>({session:{user:{id:'admin-a'}},getClubOverview:async()=>rows,listClubCoaches:async()=>coaches,listPendingCoachRequests:async()=>[{id:'request'}],listClubMessages:async()=>messages,listAnnouncements:async()=>notices,visibleTeamList:()=>rows.map(r=>r.team),...overrides});
const snapshotValue=()=>vm.runInContext('__adminHomeSnapshot',c);
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
(async()=>{
 const snap=snapshot();assert.deepEqual(plain(snap.dates),['2026-10-10','2026-10-11']);
 assert.equal(snap.fixtures.length,2,'midweek fixtures are excluded');assert.equal(snap.digest.events.length,1);assert.equal(snap.digest.pending,1);
 assert.equal(snap.unread,1,'unread is personal and received, not sent or another admin\'s messages');assert.equal(snap.notices,2,'expired and exact-expiry notices are excluded');
 assert.equal(snap.requests,1);assert.deepEqual(plain(snap.uncovered.map(r=>r.team.id)),['b']);
 const unknown=c.buildAdminHomeSnapshot(rows,null,null,null,null,feed,null);for(const k of ['requests','unread','notices','uncovered'])assert.equal(unknown[k],null);
 commit(snap);assert.equal(node('admin-home-share').disabled,false);assert.equal(node('admin-home-fixture-count').textContent,'2');
 assert.match(node('admin-home-weekend-list').innerHTML,/10:00/);assert.match(node('admin-home-weekend-list').innerHTML,/Finish the weekend details/);
 assert.match(node('admin-team-grid').innerHTML,/2 in squad/);assert.doesNotMatch(node('admin-team-grid').innerHTML,/<script>/);assert.match(node('admin-team-grid').innerHTML,/&lt;script&gt;/);
 assert.match(node('admin-team-grid').innerHTML,/<button type="button"[^>]*data-admin-open-team=/,'team navigation uses keyboard-operable buttons');
 node('admin-home-team-search').value='alice';c.renderAdminHomeTeams();assert.match(node('admin-team-grid').innerHTML,/Lions/);assert.doesNotMatch(node('admin-team-grid').innerHTML,/Green/);
 node('admin-home-age-select').value='U9';c.renderAdminHomeTeams();assert.match(node('admin-team-grid').innerHTML,/No teams match/);
 node('admin-home-team-search').value='';c.renderAdminHomeTeams();assert.match(node('admin-team-grid').innerHTML,/Green/);assert.doesNotMatch(node('admin-team-grid').innerHTML,/Lions/);
 c.renderAdminHome(snap);assert.equal(node('admin-home-age-select').value,'U9','refresh preserves a valid filter');
 node('admin-home-age-select').value='';b.team.division='Under 8D Navy';b.state.division.name=b.team.division;c.renderAdminHomeTeams();assert.match(node('admin-team-grid').innerHTML,/Division TBC/);b.team.division='Under 9D Navy';b.state.division.name=b.team.division;
 commit({...snap,feedWarning:true});assert.equal(node('admin-home-share').disabled,true);assert.equal(node('admin-home-ready-count').textContent,'—');assert.match(node('admin-home-weekend-list').innerHTML,/Latest league fixtures unavailable/);c.openAdminHomeAction('share');assert.equal(shares.length,0);
 commit(unknown);assert.match(node('admin-home-request-status').textContent,/unavailable/);assert.match(node('admin-home-coverage-status').textContent,/unavailable/);
 commit(snap);c.openAdminHomeAction('fixtures');assert.equal(c.__adminFixtureWeekend,'2026-10-10');c.openAdminHomeAction('share');assert.deepEqual(shares,['2026-10-10']);
 c.window.ClubHubCloud=cloud();c.openAdminHomeAction('staff','b');assert.equal(node('assign-coach-team').value,'b');c.openAdminHomeAction('staff','foreign');assert.equal(node('assign-coach-team').value,'b');
 c.openAdminHomeAction('requests');c.openAdminHomeAction('messages');c.openAdminHomeAction('notice');c.openAdminHomeAction('settings');assert.deepEqual(routes,['club-fixtures','club-coaches','club-coaches','club-coaches','inbox','inbox','more']);assert.deepEqual(tabs,['inbox','notices']);
 identity='club-other|admin-a';c.openAdminHomeAction('share');assert.equal(shares.length,1,'stale snapshot cannot be shared');identity='club-a|admin-a';overview=false;
 for(const action of ['fixtures','share','staff','requests','messages','notice','settings'])c.openAdminHomeAction(action,'b');assert.equal(routes.length,7,'parent/coach/admin-coach modes cannot route Club Home actions');overview=true;
 c.window.ClubHubStaticSelkent={loadResults:async(force,fresh)=>{assert.equal(force,true,'Home bypasses the static overlay memory cache');assert.equal(fresh,true,'Home cannot silently treat an offline cache fallback as the latest feed');return feed;},loadDirectory:async()=>null};
 c.window.ClubHubCloud=cloud({listClubCoaches:async()=>{throw Error('staff outage');},listClubMessages:async()=>{throw Error('messages outage');}});
 await c.refreshAdminClubOverview(false);assert.equal(snapshotValue().uncovered,null);assert.equal(snapshotValue().unread,null);assert.equal(snapshotValue().requests,1);assert.equal(node('admin-home-refresh').disabled,false);
 c.window.ClubHubStaticSelkent.loadResults=async()=>{throw Error('feed outage');};c.window.ClubHubCloud=cloud();await c.refreshAdminClubOverview(false);assert.equal(node('admin-home-fixture-count').textContent,'—');assert.equal(node('admin-home-share').disabled,true);assert.equal(snapshotValue().requests,1);
 c.window.ClubHubStaticSelkent.loadResults=async()=>feed;c.window.ClubHubCloud=cloud({getClubOverview:async()=>{throw Error('club outage');}});await c.refreshAdminClubOverview(false);
 assert.equal(snapshotValue(),null);assert.equal(node('admin-home-share').disabled,true);assert.equal(node('admin-home-fixture-count').textContent,'—');assert.match(node('admin-overview-meta').textContent,/unavailable/);assert.match(node('admin-team-grid').innerHTML,/Teams unavailable/);
 c.window.ClubHubCloud=cloud();await c.refreshAdminClubOverview(false);assert.equal(snapshotValue().fixtures.length,2,'retry restores the dashboard');
 const slow=defer();c.window.ClubHubCloud=cloud({getClubOverview:()=>slow.promise});const oldLoad=c.refreshAdminClubOverview(false);
 const newCloud=cloud({getClubOverview:async()=>[a]});c.window.ClubHubCloud=newCloud;await c.refreshAdminClubOverview(false);slow.resolve(rows);await oldLoad;assert.equal(snapshotValue().rows.length,1,'older session load cannot overwrite the newest response');
 const switched=defer();c.window.ClubHubCloud=cloud({getClubOverview:()=>switched.promise});const switchedLoad=c.refreshAdminClubOverview(false);identity='club-b|admin-a';switched.resolve(rows);await switchedLoad;assert.equal(snapshotValue().identity,'club-a|admin-a','context change blocks late commits');
 node('admin-home-team-search').value='old-club';node('admin-home-age-select').value='U12';const next=defer();c.window.ClubHubCloud=cloud({getClubOverview:()=>next.promise});const nextLoad=c.refreshAdminClubOverview(false);
 assert.equal(snapshotValue(),null);assert.equal(node('admin-home-team-search').value,'');assert.equal(node('admin-home-age-select').value,'');assert.equal(node('admin-home-share').disabled,true,'new identity clears previous club immediately');next.resolve([]);await nextLoad;assert.equal(node('admin-home-coverage-status').textContent,'No club teams yet');
 const role=defer();c.window.ClubHubCloud=cloud({getClubOverview:()=>role.promise});const roleLoad=c.refreshAdminClubOverview(false);overview=false;role.resolve(rows);await roleLoad;assert.equal(snapshotValue().rows.length,0,'losing the club admin mode blocks late results');await c.refreshAdminClubOverview(false);assert.equal(node('admin-club-overview').classList.contains('hidden'),true);
 const home=html.slice(html.indexOf('<section class="admin-club-overview'),html.indexOf('id="club-coaches-panel"'));assert.doesNotMatch(home,/Needs attention|Squad near full|Squad full|admin-alert-count/);assert.match(home,/type="search"/);assert.match(home,/role="status"/);
 console.log('Club Admin Home integration: weekend readiness, personal communications, team search, role gates, partial outages, retry and stale reads passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
