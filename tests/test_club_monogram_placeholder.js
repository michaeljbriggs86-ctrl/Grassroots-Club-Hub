const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app.js'),'utf8');
let allowed=true,real='';
const norm=x=>x.toLowerCase();
const window={},state={selkent:{directoryDetails:{'welling sport':{clubId:372,clubName:'Welling Sport'}}}};
const context=vm.createContext({window,state,selkentNorm:norm,pilotVerifiedBadgeScopeAllowed:()=>allowed,
 clubIdentityName:n=>n,esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
 verifiedTeamBadgeUrl:()=>real});
vm.runInContext(src.slice(src.indexOf('function clubPlaceholderBadgeData('),src.indexOf('function teamIdentityVisualHtml(')),context);
const first=context.clubPlaceholderBadgeData('Welling Sport');
assert.equal(first.status,'placeholder_monogram');
assert.equal(first.src,context.clubPlaceholderBadgeData('Welling Sport').src);
assert.match(decodeURIComponent(first.src),/stroke-dasharray/);
assert.match(first.alt,/monogram placeholder/);
assert.equal(context.clubPlaceholderBadgeData('unknown').src,'pitchkind-wt_mark.svg');
allowed=false;assert.equal(context.clubPlaceholderBadgeData('Welling Sport').status,'missing');
allowed=true;window.ClubHubNative={};assert.equal(context.clubPlaceholderBadgeData('Welling Sport').status,'missing');
delete window.ClubHubNative;
real='/__pilot_badges/372/'+ 'a'.repeat(64);
assert.match(context.clubIdentityBadgeHtml('Welling Sport'),/verified-club-badge/);
assert.doesNotMatch(context.clubIdentityBadgeHtml('Welling Sport'),/placeholder_monogram/);
real='';assert.match(context.clubIdentityBadgeHtml('Welling Sport'),/placeholder_monogram/);
let onError;
context.document={addEventListener:(type,fn)=>{onError=fn;}};
context.FAILED_BADGE_URLS=new Set();
vm.runInContext(src.slice(src.indexOf("document.addEventListener('error',event=>{"),src.indexOf('function matchTeamSideHtml(')),context);
const classes=new Set(['verified-club-badge']);
const image={dataset:{clubTeam:'Welling Sport'},getAttribute:()=>'/bad-image',
 classList:{contains:c=>classes.has(c),remove:c=>classes.delete(c),add:c=>classes.add(c)}};
onError({target:image});
assert.equal(image.dataset.logoStatus,'placeholder_monogram');
assert.equal(image.src,first.src);assert(context.FAILED_BADGE_URLS.has('/bad-image'));
const directory=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/directory.json'),'utf8'));
const targetIds=[292,254,322,403,239,511,256,275,269,303,325,514,261,286,544,307,566,432,290,283,540,320,411,238,294,302,308,316,345,372,383,397,445,474,484,493,497];
const seen=new Set();
for(const id of targetIds){
 const name=directory.clubs.find(c=>Number(c.club_id)===id).club_name;state.selkent.directoryDetails[norm(name)]={clubId:Number(id),clubName:name};
 const initials=context.clubPlaceholderBadgeData(name).initials;
 assert(!seen.has(initials),`collision: ${name}: ${initials}`);seen.add(initials);
}
console.log('Protected-pilot monograms: scope, unknown identity, precedence and 37 initials passed');

// Resolve missing badges through the real static overlay, starting without cached details.
const overlaySrc=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/static-feed-overlay.js'),'utf8');
context.norm=norm;state.selkent.directoryDetails={};
vm.runInContext(overlaySrc.slice(overlaySrc.indexOf('  function attachDirectoryBadges('),overlaySrc.indexOf('  function loadDirectory(')),context);
context.attachDirectoryBadges(directory);
for(const name of ['Shooters Hill Cannons','Shooters Hill cannons U8']){
 assert.equal(state.selkent.directoryDetails[norm(name)].clubId,499);
 assert.equal(state.selkent.directoryDetails[norm(name)].logoStatus,'pilot_verified');
 assert.equal(state.selkent.directoryDetails[norm(name)].pilotLogoSha256,directory.clubs.find(c=>c.club_id===499).logo_sha256);
}
for(const [name,initials,id] of [['Lewisham Borough Cobras','LB',286],['Junior Reds Knights','JR',292],['Junior Reds Athletic','JR',292],['Russellers Yellows','RU',322]]){
 assert.equal(state.selkent.directoryDetails[norm(name)].clubId,id);
 assert.equal(context.clubPlaceholderBadgeData(name).initials,initials);
 assert.equal(context.clubPlaceholderBadgeData(name).status,'placeholder_monogram');
 assert.notEqual(state.selkent.directoryDetails[norm(name)].logoStatus,'pilot_verified');
}
const ambiguous=structuredClone(directory);
ambiguous.team_club_links.push({team_name:'Junior Reds Knights',club_id:286});
context.attachDirectoryBadges(ambiguous);
assert.equal(context.clubPlaceholderBadgeData('Junior Reds Knights').status,'missing','a stale cached identity cannot supply a monogram for an ambiguous team');
console.log('Screenshot fixture teams: fresh directory identity and ambiguous-name fallback passed');

const conflictingCannons=structuredClone(directory);
conflictingCannons.team_club_links.push({team_name:'Shooters Hill Cannons',club_id:286},{team_name:'Shooters Hill Cannons',club_id:499});
context.attachDirectoryBadges(conflictingCannons);
assert.equal(state.selkent.directoryDetails[norm('Shooters Hill Cannons')].clubId,null);
assert.equal(context.clubPlaceholderBadgeData('Shooters Hill Cannons').status,'missing');
console.log('Friendly Cannons aliases use the canonical badge and fail closed on a conflicting mapping');
