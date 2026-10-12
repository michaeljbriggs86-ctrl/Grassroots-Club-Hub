const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
const start=source.indexOf('function updateSectionNavigation(nav){');
const end=source.indexOf('function refreshSectionNavigation(){',start);
const context=vm.createContext({preferredScrollBehavior:()=> 'auto'});
vm.runInContext(source.slice(start,end),context);
const classes=new Set(),calls=[];
const nav={scrollWidth:620,clientWidth:300,scrollLeft:0,
 classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},
 getBoundingClientRect:()=>({left:20,right:320}),
 scrollTo:options=>calls.push(options)};
context.updateSectionNavigation(nav);
assert(!classes.has('has-scroll-start'));assert(classes.has('has-scroll-end'));
nav.scrollLeft=320;context.updateSectionNavigation(nav);
assert(classes.has('has-scroll-start'));assert(!classes.has('has-scroll-end'));
nav.scrollLeft=0;
context.revealSectionNavigationControl({closest:()=>nav,getBoundingClientRect:()=>({left:310,right:410})});
assert.equal(calls[0].left,106);assert.equal(calls[0].behavior,'auto');
assert.equal(calls[0].top,undefined,'tab reveal must not change vertical page position');
nav.scrollLeft=160;
context.revealSectionNavigationControl({closest:()=>nav,getBoundingClientRect:()=>({left:0,right:100})});
assert.equal(calls[1].left,124);
context.revealSectionNavigationControl({closest:()=>nav,getBoundingClientRect:()=>({left:60,right:200})});
assert.equal(calls.length,2,'fully visible controls do not scroll');
nav.scrollWidth=300;nav.scrollLeft=0;context.updateSectionNavigation(nav);
assert.equal(classes.size,0,'no fades when all sections fit');
console.log('PASS section navigation overflow cues and focused control visibility without vertical jumps');
