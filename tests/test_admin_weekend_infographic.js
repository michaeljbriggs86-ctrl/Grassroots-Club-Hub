#!/usr/bin/env node
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const old=fs.readFileSync('tests/test_admin_weekend_share.js','utf8');
const {c,row,fixture,confirm,feedFor,node,shares,copies,notices}=new Function('require',old.slice(0,old.indexOf('(async()=>{')).replace(/^#![^\n]*\n/,'')+'\nreturn {c,row,fixture,confirm,feedFor,node,shares,copies,notices};')(require);
const g={font:'',measureText(text){const size=Number(this.font.match(/(\d+)px/)?.[1]||42);return {width:String(text).length*size*.54};},fillRect(){},scale(){},translate(){},rotate(){},moveTo(){},lineTo(){},closePath(){},beginPath(){},roundRect(){},fill(){},fillText(){},save(){},restore(){},arc(){},clip(){},drawImage(){}};
let canvas;const downloads=[];
c.document.createElement=tag=>tag==='canvas'?(canvas={getContext:()=>g,toDataURL:()=> 'data:image/png;base64,AQID'}):{click(){downloads.push(this.download);}};
c.shareCardFontFamily=()=> 'Arial';c.atob=atob;c.File=class{constructor(bytes,name,{type}){this.name=name;this.type=type;this.bytes=bytes;}};
c.navigator.canShare=({files})=>files.length===1;
const a=row('a','Cannons',8,[fixture('Visitors')]),b=row('b','Lions',12,[fixture('Second Visitors')]);confirm(a,a.state.selkent.fixtures[0],{time:'11:30'});confirm(b,b.state.selkent.fixtures[0],{time:'10:00',notes:'First note\nFinal complete note.',satnavPostcode:'DA4 9AX',refereeStatus:'Waiting to be Assigned',videoingStatus:'Not permitted'});
c.window.ClubHubCloud.getClubOverview=async()=>[b,a];c.window.ClubHubStaticSelkent={loadResults:async()=>feedFor([b,a])};
(async()=>{
 await c.openAdminWeekendShare();assert.equal(c.adminWeekendShareReady(),true);
 const digest=c.buildAdminWeekendDigest([b,a],feedFor([b,a])),layout=c.adminWeekendGraphicLayout(digest,'Example Club',g,'Arial');
 assert.deepEqual(Array.from(layout.anchors.filter(x=>!x.day),x=>x.teamLabel),['U8 Cannons','U12 Lions'],'team order is easy to scan independently of kick-off order');
 const text=layout.commands.filter(x=>x.kind==='text').map(x=>x.value).join('\n');
 for(const value of ['11:30','10:00','U8 Cannons','U12 Lions','Final complete note.','Sat nav: DA4 9AX','Filming: Not permitted'])assert(text.includes(value),value);
 assert(!/https?:\/\/|Map:/.test(text));assert(!/https?:\/\/|Map:/.test(c.adminWeekendDigestText(digest,'Club')),'no map links in shared image or optional copied text');
 assert(layout.commands.filter(x=>x.kind==='text'&&x.size>=30).length>10);assert(layout.height>1000);assert(layout.commands.every(x=>x.y<layout.height));
 const extended=JSON.parse(JSON.stringify(digest));extended.events[0].notes=Array.from({length:40},(_,i)=>`Complete coach note ${i}`).join('\n');const long=c.adminWeekendGraphicLayout(extended,'Club',g,'Arial');assert(long.height>layout.height);assert(long.commands.some(x=>x.value==='Complete coach note 39'),'elongation preserves every note; no ellipsis or clipping');
 // No checklist/footer; team-specific instructions stay on the cards.
 const grid=JSON.parse(JSON.stringify(digest));grid.events.push({...grid.events[0],teamLabel:'U10 Royals',time:'12:45'});
 grid.events.forEach(e=>{e.referee='Waiting to be Assigned';e.video='Not currently allowed';e.partialNotes=true;e.kits=[`${e.teamLabel}: home shirt — Green and White`];});grid.events[1].video='Not permitted';
 const compact=c.adminWeekendGraphicLayout(grid,'Club',g,'Arial');
 assert.equal(compact.width,1440);assert.equal(compact.anchors.filter(a=>!a.day)[0].top,compact.anchors.filter(a=>!a.day)[1].top,'paired cards share a row');
 const words=compact.commands.filter(x=>x.kind==='text').map(x=>x.value).join(' ');
 assert(!/CHECKLIST|Kit for all listed|unless the team card|Ground notes are partly obscured/i.test(words),'unnecessary checklist removed completely');assert(words.includes('Filming: Not permitted'));assert(words.includes('Final complete note.'));assert(compact.watermark.size>compact.width&&compact.watermark.angle!==0&&compact.watermark.opacity<.1,'zoomed angled subtle crest watermark');assert(compact.commands.filter(x=>x.kind==='rect').every(x=>x.h<=2),'editorial dividers, no separate box shapes');
 const layers=[],stack=[],paint={...g,globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},rotate(angle){layers.push({rotate:angle});},drawImage(){layers.push({image:true,alpha:this.globalAlpha});},fillText(value){layers.push({text:value,alpha:this.globalAlpha});}};c.drawAdminWeekendGraphic({getContext:()=>paint},compact,{naturalWidth:200,naturalHeight:200},true);assert(layers.find(x=>x.image).alpha<.1);assert(layers.filter(x=>x.text).every(x=>x.alpha===1),'watermark opacity cannot fade the fixture text');assert(layers.findIndex(x=>x.image)<layers.findIndex(x=>x.text),'watermark draws below text');assert(layers.at(-1).image&&layers.at(-1).alpha===1,'foreground club crest remains full opacity');
 const exceptions=JSON.parse(JSON.stringify(grid));exceptions.events[0].referee='Named Referee';exceptions.events[0].kits=['U8 Cannons: away shirt — Blue and White'];const changed=c.adminWeekendGraphicLayout(exceptions,'Club',g,'Arial').commands.filter(x=>x.kind==='text').map(x=>x.value).join(' ');assert(changed.includes('Referee: Named Referee'));assert(!changed.includes('away shirt — Blue and White'),'kit decisions are omitted even when selected kits differ');
 assert(compact.commands.filter(x=>x.kind==='text').every(x=>x.size>=30),'fixed readable type; no shrinking to fit');
 assert.match(node('admin-weekend-share-preview').innerHTML,/admin-weekend-infographic/);assert.match(node('admin-weekend-share-team').innerHTML,/U8 Cannons/);assert.equal(node('admin-weekend-share-send').textContent,'Share infographic');
 const pending=c.shareAdminWeekend();assert.equal(shares.length,1,'PNG chooser is invoked synchronously in the click gesture');await pending;assert.equal(shares[0].files.length,1);assert.equal(shares[0].files[0].type,'image/png');assert.equal(shares[0].text,undefined,'all fixture text lives in the image');
 c.saveAdminWeekendGraphic();assert.equal(downloads.length,1);assert.match(downloads[0],/\.png$/);
 await c.copyAdminWeekend();assert(!/https?:\/\/|Map:/.test(copies[0]));
 c.navigator.canShare=()=>false;await c.shareAdminWeekend();assert.equal(shares.length,1);assert.match(notices.at(-1),/Save the infographic/);
 c.navigator.canShare=()=>{throw new Error('unsupported');};await c.shareAdminWeekend();assert.equal(shares.length,1);
 // Closing or changing identity while drawing cannot publish a stale image.
 let finish;c.document.fonts={ready:new Promise(resolve=>finish=resolve)};const refreshing=c.openAdminWeekendShare();await Promise.resolve();await Promise.resolve();c.window.ClubHubCloud.context.profile.user_id='different-admin';finish();await refreshing;assert.equal(c.adminWeekendShareReady(),false);
 console.log('PASS watermark infographic: readable fixed-size complete text, numeric team order, no map links, image preview/team picker, gesture-safe single PNG sharing, save/copy fallback, draw-time identity guard');
})().catch(error=>{console.error(error);process.exitCode=1;});
