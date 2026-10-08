#!/usr/bin/env node
// Exercise production helpers with explicit clocks and independent fixture expectations.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
const take=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start);return source.slice(start,end);};
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const key=f=>`${f.date}|${norm(f.opponent||'tbc')}|${f.venue}|${norm(f.competition||'fixture')}`;
let clock=Date.parse('2026-10-07T18:00:00Z');
class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
const nodes=new Map(),notices=[],shares=[],copies=[],loads=[];
const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',disabled:false,open:false,classList:{add(){},remove(){}},showModal(){this.open=true;},focus(){},select(){}});return nodes.get(id);};
const settings={display_name:'Example Juniors FC',kit_colours:'Green shirts; black shorts'};
const c={Date:Clock,Intl,console,CLOUD_MODE:true,isClubOverviewMode:()=>true,clubSettings:()=>settings,selkentNorm:norm,normalizeTeamKey:norm,fixtureKitSelectionKey:key,matchStatus:m=>m.status,publishedClubTeamData:()=>({results:[]}),verifiedClubResultsFeed:()=>null,isSelkentLeagueDivision:s=>/^under /i.test(s),fixtureFingerprint:f=>[f.date,f.time,f.venue,f.opponent].join('|'),fixtureChangeText:()=> 'Changed fixture',pilotKitDefaults:()=>({}),document:{getElementById:node},navigator:{share:data=>{shares.push(data);return Promise.resolve();},clipboard:{writeText:text=>{copies.push(text);return Promise.resolve();}}},window:{ClubHubCloud:{context:{club:{id:'club-a'},profile:{club_id:'club-a',user_id:'admin-a',role:'admin'}}}},toast:message=>notices.push(message),esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')};
vm.createContext(c);
vm.runInContext(take('function fixtureStableKey(', 'function fixtureDatedGameKey(')+take('function fixtureAckState(', 'function setFixtureAcknowledgement(')+take('function shirtColoursOnly(', 'function ownTeamDisplayName(')+take('function knownKit(', 'function kitsClash(')+take('function fullClubResultTeamName(', 'function internalAdminClubResults(')+take('function mapQuery(', 'function mapsEmbedHref(')+take('function shareDateText(', 'function matchdayShareFixture(')+take('function adminFixtureHasResult(', 'function renderAdminFixtures(')+take('function adminShareWeekendDates(', 'async function refreshAdminClubOverview('),c);
const plain=x=>JSON.parse(JSON.stringify(x));
const fixture=(opponent,venue='H',competition='Division',date='2026-10-11')=>({date,time:'',opponent,venue,competition});
function row(id,name,age,fixtures){return {team:{id,teamName:name,ageGroup:`U${age}`,leagueName:`Example Juniors FC ${name}`,division:`Under ${age}D Navy`},state:{division:{name:`Under ${age}D Navy`},selkent:{fixtures,fixtureOverrides:{},fixtureKitSelections:{},kitProfiles:{}},matches:[]}};}
function confirm(r,f,extra={}){r.state.selkent.fixtureOverrides[key(f)]={time:'10:00',groundName:'Actual School Ground',address:'1 Actual Road, SE1 1AA',confirmedAt:'2026-10-07T12:00:00Z',...extra};}
function feedFor(rows){return {age_groups:[...new Set(rows.map(r=>r.team.ageGroup))].map(age=>({age_group:age,fixtures:rows.filter(r=>r.team.ageGroup===age).flatMap(r=>r.state.selkent.fixtures.map(f=>({date:f.date,division_name:/^(Division|League)$/.test(f.competition)?r.team.division:f.competition,home:f.venue==='H'?r.team.leagueName:f.opponent,away:f.venue==='H'?f.opponent:r.team.leagueName})))}))};}
const digest=rows=>c.buildAdminWeekendDigest(rows,feedFor(rows));
(async()=>{
 for(const [instant,expected] of [
  ['2026-10-07T12:00Z',['2026-10-10','2026-10-11']],
  ['2026-10-09T23:30Z',['2026-10-10','2026-10-11']],
  ['2026-10-11T12:00Z',['2026-10-10','2026-10-11']],
  ['2026-10-11T23:30Z',['2026-10-17','2026-10-18']],
  ['2026-03-29T12:00Z',['2026-03-28','2026-03-29']],
  ['2026-10-25T12:00Z',['2026-10-24','2026-10-25']]])assert.deepEqual(plain(c.adminShareWeekendDates(new Date(instant))),expected,instant);
 const ordinary=fixture('Visiting United','A'),home=fixture('Home Opponent'),cup1=fixture('Cup North','A','Selkent Cup Two - Round 1','2026-10-10'),cup2=fixture('Cup South','H',cup1.competition,cup1.date);
 const a=row('a','Lions',12,[ordinary]),b=row('b','Green',8,[home]),cup=row('c','Valiants',9,[cup1,cup2]);
 confirm(a,ordinary,{time:'12:00',notes:'Gate opens at 09:30\nNo dogs.',refereeStatus:'Waiting to be Assigned',videoingStatus:'Not permitted',satnavPostcode:'SE1 2BB',notesPartiallyObscured:true});
 confirm(b,home,{time:'09:00'});confirm(cup,cup2,{time:'09:30'});
 cup.state.selkent.fixtureKitSelections[key(cup2)]='away';cup.state.selkent.kitProfiles[norm(cup.team.leagueName)]={home:'Green and white',away:'Blue and white'};
 const before=JSON.stringify([a,b,cup]);const d=digest([a,b,cup]);
 assert.equal(d.events.length,3);assert.deepEqual(plain(d.events.map(e=>[e.date,e.time,e.teamLabel])),[['2026-10-10','09:30','U9 Valiants'],['2026-10-11','09:00','U8 Green'],['2026-10-11','12:00','U12 Lions']]);
 assert.equal(d.events[0].matchups.length,2);assert.match(d.events[0].matchups[0],/^Cup North v Example Juniors FC Valiants \(Away\)$/);assert.match(d.events[0].matchups[1],/^Example Juniors FC Valiants v Cup South \(Home\)$/);
 assert.match(d.events[0].kits[0],/away shirt — Blue and white/,'the confirmed group representative supplies the selected shirt');
 assert.equal(d.events[2].group,false);assert.equal(d.events[2].ground,'Actual School Ground','U12 venue never takes mini-soccer defaults');
 assert.match(d.events[2].maps,/SE1%202BB/,'sat nav postcode overrides the street address in map navigation');
 const text=c.adminWeekendDigestText(d,'Example Juniors FC');assert.match(text,/09:30 · U9 Valiants\* · Group start \(order may change\)/);assert.match(text,/Referee: Waiting to be Assigned/);assert.match(text,/Filming: Not permitted/);assert.match(text,/Gate opens at 09:30\nNo dogs/);assert.match(text,/obscured ground notes/);assert.match(text,/Under 12D Navy/);assert.doesNotMatch(text,/black shorts|Arrival:|undefined|\[object Object\]/);
 assert.equal(JSON.stringify([a,b,cup]),before,'export must not mutate team states or private match records');
 const bad=row('bad','Unknown',10,[fixture('TBC Opponent')]);confirm(bad,bad.state.selkent.fixtures[0],{time:'27:60'});
 assert.equal(digest([bad]).events.length,0);assert.equal(digest([bad]).pending,1);
 bad.state.selkent.fixtureOverrides[key(bad.state.selkent.fixtures[0])].time='10:00';delete bad.state.selkent.fixtureOverrides[key(bad.state.selkent.fixtures[0])].confirmedAt;assert.equal(digest([bad]).events.length,0);
 confirm(bad,bad.state.selkent.fixtures[0],{groundName:'',address:''});assert.match(c.adminWeekendDigestText(digest([bad]),'Club'),/Venue to confirm/,'a confirmed time remains visible with an explicit missing-venue warning');
 const changed=plain(a),f=changed.state.selkent.fixtures[0];changed.state.selkent.fixtureTracking={key:c.fixtureStableKey(f),changed:true,changes:[{field:'time'}]};assert.equal(digest([changed]).events.length,0,'unacknowledged provider changes block an override even if acknowledgement points elsewhere');
 const issue=plain(a);issue.state.selkent.fixtureAcknowledgement={key:c.fixtureStableKey(f),status:'issue',fingerprint:c.fixtureFingerprint(f)};assert.equal(digest([issue]).events.length,0);
 const conflict=plain(cup);confirm(conflict,cup1,{time:'10:30'});assert.equal(digest([conflict]).events.length,0,'conflicting confirmed cup starts require reconfirmation');
 const unconfirmedCup=plain(cup);delete unconfirmedCup.state.selkent.fixtureOverrides[key(cup2)].confirmedAt;assert.equal(digest([unconfirmedCup]).events.length,0,'a saved valid group time without a confirmation is excluded');
 const stale=plain(a);stale.state.selkent.fixtures[0].date='2026-10-18';assert.equal(digest([stale]).events.length,0);
 const derbyA=fixture('Example Juniors FC Blues'),derbyB=fixture('Example Juniors FC Greens','A');
 const greens=row('greens','Greens',10,[derbyA]),blues=row('blues','Blues',10,[derbyB]);confirm(greens,derbyA);confirm(blues,derbyB);
 blues.state.selkent.fixtureKitSelections[key(derbyB)]='away';blues.state.selkent.kitProfiles[norm(blues.team.leagueName)]={away:'Purple'};
 const derby=digest([greens,blues]);assert.equal(derby.events.length,1,'a mirrored club derby has one kick-off');assert.equal(derby.events[0].kits.length,2);assert.match(derby.events[0].kits[1],/Blues: away shirt — Purple/);
 delete blues.state.selkent.fixtureOverrides[key(derbyB)];assert.equal(digest([greens,blues]).events.length,0,'a derby awaiting the second team confirmation is not described as fully confirmed');
 const privateRow=plain(a);Object.defineProperty(privateRow.state,'squad',{get(){throw Error('Private squad read');}});Object.defineProperty(privateRow.state,'coachNotes',{get(){throw Error('Private coaching note read');}});assert.equal(digest([privateRow]).events.length,1,'share extraction never accesses squad or coaching notes');
 const htmlRow=plain(a);htmlRow.state.selkent.fixtureOverrides[key(ordinary)].notes='<img src=x onerror=alert(1)>';c.window.ClubHubCloud.getClubOverview=async()=>[htmlRow,b,cup];c.window.ClubHubStaticSelkent={loadResults:async(...args)=>{loads.push(args);return feedFor([htmlRow,b,cup]);}};
 await c.openAdminWeekendShare();assert.deepEqual(loads[0],[true,true]);assert.match(node('admin-weekend-share-preview').innerHTML,/&lt;img/);assert.doesNotMatch(node('admin-weekend-share-preview').innerHTML,/<img/);
 const firstShare=c.shareAdminWeekend();assert.equal(shares.length,1,'share chooser called synchronously in the button gesture');await firstShare;assert.equal(shares[0].text,node('admin-weekend-share-text').value);assert.equal(shares[0].files,undefined);
 await c.copyAdminWeekend();assert.equal(copies[0],shares[0].text);
 c.navigator.share=async()=>{throw {name:'AbortError'};};const noticesBefore=notices.length;await c.shareAdminWeekend();assert.equal(notices.length,noticesBefore,'cancel does not trigger errors or copy');
 c.navigator.share=async()=>{throw {name:'NotAllowedError'};};await c.shareAdminWeekend();assert.match(notices.at(-1),/Copy for WhatsApp/);
 let finish; c.navigator.share=data=>{shares.push(data);return new Promise(resolve=>finish=resolve);};const busy=c.shareAdminWeekend();await c.shareAdminWeekend();assert.equal(shares.length,2,'double tap opens only one chooser');finish();await busy;
 c.window.ClubHubCloud.context.profile.role='parent';assert.equal(c.adminWeekendShareReady(),false);await c.copyAdminWeekend();assert.equal(copies.length,1);c.window.ClubHubCloud.context.profile.role='admin';
 c.window.ClubHubCloud.context.club.id='club-b';assert.equal(c.adminWeekendShareReady(),false);c.window.ClubHubCloud.context.club.id='club-a';
 clock+=300000;assert.equal(c.adminWeekendShareReady(),false,'stale preview must be refreshed');clock-=300000;
 c.window.ClubHubStaticSelkent.loadResults=async()=>{throw new Error('offline');};await c.openAdminWeekendShare();assert.equal(c.adminWeekendShareReady(),false);assert.match(node('admin-weekend-share-status').textContent,/Could not refresh/);assert.equal(node('admin-weekend-share-text').value,'','failed refresh clears stale private share payload');
 c.navigator.share=undefined;c.window.ClubHubStaticSelkent.loadResults=async()=>feedFor([a]);c.window.ClubHubCloud.getClubOverview=async()=>[a];await c.openAdminWeekendShare();await c.shareAdminWeekend();assert.match(notices.at(-1),/Use Copy/);
 c.navigator.clipboard.writeText=async()=>{throw new Error('clipboard denied');};await c.copyAdminWeekend();assert.match(notices.at(-1),/Select and copy/);
 let resolveRows;c.window.ClubHubCloud.getClubOverview=()=>new Promise(resolve=>resolveRows=resolve);const loading=c.openAdminWeekendShare();c.window.ClubHubCloud.context.profile.role='parent';resolveRows([a]);await loading;assert.equal(c.adminWeekendShareReady(),false,'role changes during refresh cannot prepare an export');
 // A strict export refresh rejects cached feed fallback while existing overview readers keep it.
 const overlay=fs.readFileSync('app/src/main/assets/static-feed-overlay.js','utf8');const slice=(a,b)=>overlay.slice(overlay.indexOf(a),overlay.indexOf(b,overlay.indexOf(a)));
 const cache={age_groups:[]};const oc={Date,window:{nativeHttp:async()=>{throw new Error('offline');}},memoryCache:{},DIRECTORY_CACHE_KEY:'directory',readCached:()=>cache,writeCached:()=>{},safeJsonParse:JSON.parse};vm.createContext(oc);vm.runInContext(slice('  async function fetchStaticFeed(', '  function attachDirectoryBadges('),oc);
 assert.equal(await oc.fetchStaticFeed('/results','results',x=>x,true),cache);await assert.rejects(oc.fetchStaticFeed('/results','results',x=>x,true,true),/offline/);
 console.log('PASS weekend share: London/DST dates, confirmed-only source identities, cup group start, venue/sat nav/notes/selected shirt, privacy/escaping, fresh-only feed, chooser gesture/cancel/busy, Copy/manual fallback, role/club/staleness guards');
})().catch(e=>{console.error(e);process.exitCode=1;});
