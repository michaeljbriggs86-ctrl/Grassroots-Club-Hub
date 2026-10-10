#!/usr/bin/env node
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
const mapStart=source.indexOf("function mapsShareHref(...parts)");
const mapEnd=source.indexOf('function allDivisionTeams()',mapStart);
const start=source.indexOf("function matchdayArrivalTime(time='')");
const end=source.indexOf('async function shareNextMatchImage()',start);
assert(mapStart>=0&&mapEnd>mapStart&&start>=0&&end>start,'matchday share helper source not found');
const box={mapQuery:(...parts)=>parts.map(x=>String(x||'').trim()).filter(Boolean).join(', ')};
vm.createContext(box);
vm.runInContext(source.slice(mapStart,mapEnd)+source.slice(start,end)+';this.matchdayArrivalTime=matchdayArrivalTime;this.mapsShareHref=mapsShareHref;this.shareDateText=shareDateText;',box);
assert.equal(box.matchdayArrivalTime('12:00'),'11:30');
assert.equal(box.matchdayArrivalTime('09:15'),'08:45');
assert.equal(box.matchdayArrivalTime('00:15'),'23:45');
assert.equal(box.matchdayArrivalTime('bad'),'');
const maps=box.mapsShareHref('Crook Log Leisure Centre (rear of car park)','Brampton Road, Bexleyheath, DA7 4HH');
assert(maps.startsWith('https://www.google.com/maps/search/?api=1&query='));
assert(maps.includes('Crook%20Log%20Leisure%20Centre'));
assert.equal(box.shareDateText('2026-09-27'),'Sunday, 27 September 2026');
console.log('PASS matchday arrival calculation and WhatsApp Maps link helpers');

// Exercise the actual image loader and canvas draw path. Protected badges use
// root-relative URLs; the old loader rejected both before any request was made.
const badgeStart=source.indexOf('async function loadShareBadgeImage(');
const badgeEnd=source.indexOf('function matchdayArrivalTime(',badgeStart);
assert(badgeStart>=0&&badgeEnd>badgeStart,'share badge helpers not found');
async function checkShareBadges(){
  const requests=[],draws=[],nativeAssets=[];
  const own='/__pilot_badges/499/'+ 'a'.repeat(64);
  const opponent='/__pilot_badges/318/'+ 'b'.repeat(64);
  const context={
    window:{},clearTimeout:()=>{},
    setTimeout:callback=>{context.timeout=callback;return 1;},
    verifiedTeamBadgeUrl:name=>name==='Own club'?own:name==='Opponent'?opponent:'',
    Image:class{
      constructor(){this.naturalWidth=320;this.naturalHeight=200;}
      set src(value){
        this.url=value;requests.push({url:value,cors:this.crossOrigin});
        if(value==='slow.png')return;
        queueMicrotask(()=>value==='missing.png'?this.onerror():this.onload());
      }
    }
  };
  vm.createContext(context);
  const rotationStart=source.indexOf('function reviewedBadgeRotation(');
  const rotationEnd=source.indexOf('function clubIdentityName(',rotationStart);
  vm.runInContext(source.slice(rotationStart,rotationEnd)+source.slice(badgeStart,badgeEnd),context);
  const rotations=[];
  const canvas={save:()=>{},restore:()=>{},translate:()=>{},rotate:angle=>rotations.push(angle),drawImage:(image,...args)=>draws.push({url:image.url,args})};
  await Promise.all([
    context.drawShareClubIdentity(canvas,270,260,'Own club'),
    context.drawShareClubIdentity(canvas,810,260,'Opponent')
  ]);
  assert.deepEqual(draws.map(x=>x.url),[own,opponent],'both club badges reach the shared canvas');
  assert(requests.every(x=>!x.cors),'same-origin badges retain the browser session');
  assert(draws.every(x=>x.args[2]===188&&x.args[3]===117.5),'badge aspect ratio is preserved');
  assert(rotations.every(angle=>angle===0),'other approved artwork is not rotated');
  const junior='/__pilot_badges/292/3aa25e5eff778740a2133b8d0e780b5240bf8b5ca61632061238f3257d1a52d0';
  context.verifiedTeamBadgeUrl=()=>junior;
  await context.drawShareClubIdentity(canvas,270,260,'Junior Reds Sabres');
  assert.equal(rotations.at(-1),16*Math.PI/180,'the exact supplied Junior Reds artwork is rotated clockwise in shares');
  assert.equal(draws.at(-1).url,junior,'rotation uses the same approved bytes');
  assert.equal(context.reviewedBadgeRotation('/__pilot_badges/292/'+ 'c'.repeat(64)),0,'a future Junior Reds replacement gets no inherited correction');
  context.verifiedTeamBadgeUrl=name=>name==='Own club'?own:name==='Opponent'?opponent:'';
  for(const invalid of ['//foreign.example/crest.png','../crest.png','/../crest.png','/bad\\path.png','javascript:alert(1)']){
    const before=requests.length;
    assert.equal(await context.loadShareBadgeImage(invalid),null);
    assert.equal(requests.length,before,'invalid URLs are never requested');
  }
  await context.loadShareBadgeImage('https://example.test/crest.png');
  assert.equal(requests.at(-1).cors,'anonymous','external images still require canvas-safe CORS');
  assert.equal(await context.loadShareBadgeImage('missing.png'),null,'failed image resolves to fallback');
  const slow=context.loadShareBadgeImage('slow.png');context.timeout();
  assert.equal(await slow,null,'an image that never loads cannot block sharing');
  await context.drawShareClubIdentity(canvas,270,260,'No approved badge');
  assert.equal(draws.at(-1).url,'pitchkind-wt_mark.svg','missing approved badge uses the product placeholder');
  context.verifiedTeamBadgeUrl=()=> 'missing.png';
  await context.drawShareClubIdentity(canvas,270,260,'Failed badge');
  assert.equal(draws.at(-1).url,'pitchkind-wt_mark.svg','failed approved badge uses the product placeholder');
  context.window.ClubHubNative={assetDataUrl:path=>{nativeAssets.push(path);return 'data:image/png;base64,AA==';}};
  assert.equal(await context.loadShareBadgeImage(own),null,'private website paths are never passed to the native asset bridge');
  await context.loadShareBadgeImage('shooters-hill-logo.png');
  assert.deepEqual(nativeAssets,['shooters-hill-logo.png'],'Android bundled asset loading is retained');
  assert.equal(requests.at(-1).url,'data:image/png;base64,AA==');
  console.log('PASS shared canvas loads both protected club badges; fallback, CORS, timeout and native assets retained');
}
checkShareBadges().catch(error=>{console.error(error);process.exitCode=1;});
