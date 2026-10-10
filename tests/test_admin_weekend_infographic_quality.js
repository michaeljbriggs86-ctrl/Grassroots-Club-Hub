#!/usr/bin/env node
const fs=require('node:fs'),assert=require('node:assert/strict');
const old=fs.readFileSync('tests/test_admin_weekend_share.js','utf8');
const {c,row,fixture,confirm,feedFor,node}=new Function('require',old.slice(0,old.indexOf('(async()=>{')).replace(/^#![^\n]*\n/,'')+'\nreturn {c,row,fixture,confirm,feedFor,node};')(require);
require('node:vm').runInContext(fs.readFileSync('app/src/main/assets/app.js','utf8').match(/function preferredScrollBehavior\(\)\{[^\n]+/)[0],c);
const g={font:'',measureText(s){return {width:String(s).length*Number(this.font.match(/(\d+)px/)?.[1]||34)*.54};},scale(x,y){this.scaling=[x,y];},fillRect(){},save(){},restore(){},translate(){},rotate(){},arc(){},clip(){},drawImage(){},fillText(){},beginPath(){},roundRect(){},fill(){}};
const cupA=fixture('Cup North','A','Selkent Cup Two - Round 1','2026-10-10'),cupB=fixture('Cup South','H',cupA.competition,cupA.date);
const cup=row('cup','Valiants',9,[cupA,cupB]);confirm(cup,cupB,{time:'09:00',groundName:'Marathon Sports Ground',address:'Shooters Hill'});
const league=row('league','Green',8,[fixture('League Visitors')]);confirm(league,league.state.selkent.fixtures[0],{groundName:'London Marathon Playing Fields'});
const elsewhere=row('else','Archers',12,[fixture('Other Cup','H','Selkent Cup Two')]);confirm(elsewhere,elsewhere.state.selkent.fixtures[0],{groundName:'Woolwich Polytechnic School for Girls'});
const pending=row('pending','Cannons',12,[fixture('Gold Visitors')]),pendingGroup=row('pending-group','Vipers',10,[fixture('North','H',cupA.competition),fixture('South','A',cupA.competition)]);
const rows=[cup,league,elsewhere,pending,pendingGroup],before=JSON.stringify(rows),digest=c.buildAdminWeekendDigest(rows,feedFor(rows));
assert.equal(digest.events.length,3);assert.equal(digest.pending,2);assert.equal(digest.pendingRows.length,2,'one entry for an unconfirmed two-game group');
assert.equal(digest.pendingRows.find(x=>x.teamLabel==='U10 Vipers').opponents.length,2);
assert(digest.events[0].neutral);assert(digest.events[0].matchups.every(x=>x.endsWith('(Neutral)')));
assert(!digest.events.find(x=>x.teamLabel==='U8 Green').neutral);assert(digest.events.find(x=>x.teamLabel==='U8 Green').matchups[0].endsWith('(Home)'),'league games at Marathon retain Home');
assert(!digest.events.find(x=>x.teamLabel==='U12 Archers').neutral,'cup games elsewhere retain provider Home/Away');
const single=row('single','Older Cup',15,[fixture('Older Visitors','A','Selkent Cup One')]);confirm(single,single.state.selkent.fixtures[0],{groundName:'London Marathon Playing Fields'});assert(c.buildAdminWeekendDigest([single],feedFor([single])).events[0].neutral,'neutral applies to a single older cup fixture at Marathon too');
assert.equal(JSON.stringify(rows),before,'neutral labels never rewrite provider identities or confirmations');
digest.events.forEach((e,i)=>e.kits=[`${e.teamLabel}: ${i%2?'away':'home'} shirt — ${i%2?'Blue':'Green'}`]);
const layout=c.adminWeekendGraphicLayout(digest,'Example Juniors FC',g,'Arial'),words=layout.commands.filter(x=>x.kind==='text').map(x=>x.value).join('\n'),copy=c.adminWeekendDigestText(digest,'Example Juniors FC');
assert(!/Kit:|shirt —|Kit for all/i.test(words+copy),'kit decisions omitted from both image and copied text');assert(!/https?:\/\/|Map:/.test(words+copy));
assert(words.includes('NEUTRAL'));assert(words.includes('Cup North'));assert(words.includes('Cup South'));assert(words.includes('KICK-OFFS TO CONFIRM'));
for(const name of ['U12 Cannons','U10 Vipers']){assert(words.includes(name));assert(copy.includes(name));assert(layout.anchors.some(x=>x.teamLabel===name&&x.pending),'unconfirmed teams remain navigable');}
assert(digest.pendingRows.every(x=>!('time' in x)),'no guessed time on unconfirmed fixtures');
const groupAnchor=layout.anchors.find(x=>x.teamLabel==='U9 Valiants'),sunday=layout.anchors.find(x=>x.day&&x.date==='2026-10-11');assert(sunday.top-groupAnchor.top<500,'two-game Saturday section is compact');
assert(layout.badge.size>=220);assert(layout.badge.x+layout.badge.size/2<=layout.width-64);assert(layout.badge.y-layout.badge.size/2>=0);
const heading=layout.commands.filter(x=>x.kind==='text'&&x.size===84);for(const h of heading){g.font=`${h.weight} ${h.size}px Arial`;assert(h.x+g.measureText(h.value).width<layout.badge.x-layout.badge.size/2,'header reserves room for enlarged crest');}
assert(layout.commands.every(x=>x.y<layout.height));assert(layout.commands.filter(x=>x.kind==='text').every(x=>x.size>=30),'compact layout preserves readable type');
// Adding pending names does not call them confirmed or change the confirmed count.
const pOnly=c.buildAdminWeekendDigest([pending],feedFor([pending]));assert.equal(pOnly.events.length,0);assert.equal(pOnly.pendingRows[0].teamLabel,'U12 Cannons');
// Pixel dimensions and navigation coordinates share the same scale.
let canvas;c.document.createElement=()=>canvas={getContext:()=>g,toDataURL:()=> 'data:image/png;base64,AQID'};c.shareCardFontFamily=()=> 'Arial';c.atob=atob;c.File=class{constructor(bytes,name,{type}){this.name=name;this.type=type;}};
(async()=>{
 const image=await c.prepareAdminWeekendGraphic(digest,'Example Juniors FC');assert.equal(canvas.width,2880);assert.equal(canvas.height,layout.height*2);assert.deepEqual(g.scaling,[2,2]);assert.equal(image.width,canvas.width);assert.equal(image.height,canvas.height);
 assert.deepEqual(Array.from(image.anchors,x=>x.top),Array.from(layout.anchors,x=>x.top*2));
 c.window.ClubHubCloud.getClubOverview=async()=>rows;c.window.ClubHubStaticSelkent={loadResults:async()=>feedFor(rows)};await c.openAdminWeekendShare();assert.match(node('admin-weekend-share-team').innerHTML,/U12 Cannons · unconfirmed/);
 let scroll;const scroller={scrollTop:5,getBoundingClientRect:()=>({top:10}),scrollTo:v=>scroll=v};const img=node('admin-weekend-infographic');img.closest=()=>scroller;img.getBoundingClientRect=()=>({top:30});img.clientWidth=720;
 c.jumpAdminWeekendGraphic(image.anchors[0].top);assert.equal(scroll.top,25+layout.anchors[0].top/2,'team navigation still lands correctly in the high-resolution image');
 console.log('PASS infographic quality: enlarged crest, no kit decisions, compact neutral cup group, Marathon league/other venues unchanged, named unconfirmed teams, 2x PNG and scaled navigation');
})().catch(e=>{console.error(e);process.exitCode=1;});
