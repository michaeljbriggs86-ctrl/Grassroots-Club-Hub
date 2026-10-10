#!/usr/bin/env node
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const assets='app/src/main/assets/';
const app=fs.readFileSync(assets+'app.js','utf8'),html=fs.readFileSync(assets+'index.html','utf8');
const styles=fs.readFileSync(assets+'styles.css','utf8'),design=fs.readFileSync(assets+'app-design-system.css','utf8');
const take=(source,from,to)=>{
  const a=source.indexOf(from),b=source.indexOf(to,a);
  assert(a>=0&&b>a,`missing source boundary ${from}`);return source.slice(a,b);
};

// A current service-worker cache must install the approved assets, delete the
// previous cache on activation and take control. Its label need not match APK version.
const handlers={},opened=[],deleted=[];let assetsAdded,claimed=false,skipped=false;
const worker={self:{addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:()=>{skipped=true;},clients:{claim:()=>{claimed=true;}}},
  caches:{open:async name=>{opened.push(name);return {addAll:async list=>{assetsAdded=list;}};},keys:async()=>[opened[0],'retired-cache'],delete:async name=>{deleted.push(name);return true;}}};
vm.runInNewContext(fs.readFileSync(assets+'service-worker.js','utf8'),worker);

// Exercise the actual hero assignment with no private or club badge configured.
const hero={getAttribute:()=>'',classList:{toggle(){}},closest:()=>null};
const fallback={window:{},document:{querySelectorAll:()=>[hero]},privatePilotOwnBadgeUrl:()=>'',FAILED_BADGE_URLS:new Set(),clubSettings:()=>({}),clubDisplayName:()=> 'Example'};
vm.runInNewContext(take(app,'window.applyPilotOwnClubBadge=function(){','function verifiedTeamBadgeUrl('),fallback);
fallback.window.applyPilotOwnClubBadge();assert.equal(hero.src,'pitchkind-wt_mark.svg');

// More than eleven future events must remain reachable for both staff and parents.
const fixtureNodes=new Map(['selkent-fixtures-list','selkent-fixtures-count','selkent-fixtures-heading','selkent-fixtures-meta'].map(id=>[id,{}]));
const fixtures=Array.from({length:25},(_,i)=>({id:i}));
const listContext={CLOUD_MODE:true,currentRole:'coach',upcomingFixtures:()=>fixtures,
  furtherFixtureCardHtml:f=>`<staff>${f.id}</staff>`,parentFutureFixtureHtml:f=>`<parent>${f.id}</parent>`,
  document:{getElementById:id=>fixtureNodes.get(id)},setStableHtml:(node,markup)=>{node.innerHTML=markup;}};
vm.runInNewContext(take(app,'function renderSelkentFixtures(){','async function syncSelkent('),listContext);
listContext.renderSelkentFixtures();assert.equal(fixtureNodes.get('selkent-fixtures-count').textContent,'24');
assert.match(fixtureNodes.get('selkent-fixtures-list').innerHTML,/<staff>24<\/staff>/);
listContext.currentRole='parent';listContext.renderSelkentFixtures();assert.equal(fixtureNodes.get('selkent-fixtures-count').textContent,'25');
assert.match(fixtureNodes.get('selkent-fixtures-list').innerHTML,/<parent>24<\/parent>/);

const future=take(app,'function furtherFixtureCardHtml(','function groupedUpcomingFixtures(');
assert.match(future,/matchTeamSideHtml\('Home',ctx.homeTeam,ctx.homeKit\)/);
assert.match(future,/matchTeamSideHtml\('Away',ctx.awayTeam,ctx.awayKit\)/);
assert.match(future,/confirmed&&ctx.mapHref/,'unconfirmed fixtures cannot expose a Maps action');
assert.match(future,/Open in Maps/);
assert.doesNotMatch(take(app,'async function undoMatchPlayed(){','function jerseyHTML('),/notifyMatch(?:Reopened|Report)/,'retired match-report notification calls stay removed');

// Complete shield/wordmark artwork stays contained; only the known bundled
// Shooters Hill fallback has its separate canvas clipping exception.
const heroCSS=take(design,'.club-logo-wrap:not(.platform-club-placeholder) .club-logo{','\n}');
assert.match(heroCSS,/object-fit:contain!important/);assert.match(heroCSS,/clip-path:none!important/);
const verifiedRules=[...styles.matchAll(/\.verified-club-badge\s*\{([^}]*)\}/g)].map(x=>x[1]).join(';');
assert.match(verifiedRules,/object-fit:contain/);assert.doesNotMatch(verifiedRules,/clip-path:\s*circle|border-radius:\s*50%/);
assert.match(design,/\.matches-next-actions\s*\{[^}]*display:flex;[^}]*flex-wrap:wrap/);
assert.match(design,/\.matches-next-actions>button\s*\{[^}]*min-height:48px/);

// Parse nesting instead of searching the rest of the document: both actions
// must be inside the footer, and the footer must be outside the scroll region.
const stack=[],ancestors=new Map();
for(const match of html.matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi)){
  const [tag,name]=match,key=name.toLowerCase();
  if(tag.startsWith('</')){const at=stack.map(x=>x.tag).lastIndexOf(key);if(at>=0)stack.splice(at);continue;}
  const id=tag.match(/\bid="([^"]+)"/)?.[1];if(id)ancestors.set(id,stack.map(x=>x.id).filter(Boolean));
  if(!['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'].includes(key)&&!tag.endsWith('/>'))stack.push({tag:key,id});
}
assert(!ancestors.get('next-fixture-action-bar').includes('next-fixture-scroll'));
for(const id of ['fixture-confirm-details','next-match-share'])assert(ancestors.get(id).includes('next-fixture-action-bar'));

(async()=>{
  let pending;handlers.install({waitUntil:promise=>{pending=promise;}});await pending;
  assert(opened[0]);assert(skipped);assert(assetsAdded.includes('./pitchkind-wt_logo-primary.svg'));
  for(const path of assetsAdded)assert(fs.existsSync(assets+path.replace(/^\.\//,'')),`cache asset exists: ${path}`);
  handlers.activate({waitUntil:promise=>{pending=promise;}});await pending;
  assert.deepEqual(deleted,['retired-cache']);assert(claimed);
  console.log('PASS current UI contract: cache lifecycle, product fallback, untruncated fixtures, artwork, readable actions and persistent footer');
})().catch(error=>{console.error(error);process.exitCode=1;});
