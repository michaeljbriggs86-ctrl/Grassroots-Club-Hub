const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8'),marker='// Decorative live-page branding follows the already resolved own-club header badge.';
assert(source.includes(marker));const decoration=source.slice(source.indexOf(marker));
const classes=new Set(),requests=[],events={},observers=[];let headerSrc='shooters-hill-logo.png',imageSrc='';
const image={complete:false,naturalWidth:512,getAttribute:()=>imageSrc,removeAttribute(){imageSrc='';},get src(){return imageSrc;},set src(s){imageSrc=s;requests.push(s);}};
const layer={hidden:true,dataset:{},querySelector:()=>image},header={getAttribute:()=>headerSrc};
const document={readyState:'loading',body:{classList:{add:s=>classes.add(s),remove:s=>classes.delete(s)}},getElementById:id=>id==='club-page-watermark'?layer:null,querySelector:s=>s==='.hero .club-logo'?header:null};
class Observer{constructor(callback){this.callback=callback;observers.push(this);}observe(node,options){this.node=node;this.options=options;}}
const context={document,window:{addEventListener:(name,fn)=>events[name]=fn},MutationObserver:Observer};vm.createContext(context);vm.runInContext(decoration,context);
events.DOMContentLoaded();assert(layer.hidden,'watermark waits for image bytes');assert.equal(requests[0],headerSrc);image.onload();assert(!layer.hidden);assert(classes.has('club-watermark-ready'));assert.equal(layer.dataset.circular,'true');
context.startClubPageWatermark();context.syncClubPageWatermark();assert.equal(requests.length,1,'refreshes preserve an unchanged cached badge');assert.equal(observers.length,1,'only one header source observer');assert.deepEqual(Array.from(observers[0].options.attributeFilter),['src']);
const oldLoad=image.onload;headerSrc='/__pilot_badges/499/'+'a'.repeat(64);observers[0].callback();assert(layer.hidden);oldLoad();assert(layer.hidden,'old source load cannot restore a stale club badge');image.onload();assert(!layer.hidden);assert.equal(layer.dataset.circular,'true');
headerSrc='other-club-approved.png';observers[0].callback();assert(layer.hidden);image.onload();assert(!layer.hidden);assert.equal(layer.dataset.circular,'false','unrelated club artwork is not cropped into a circle');assert.equal(imageSrc,headerSrc,'watermark follows the header, never an opponent badge');
image.onerror();assert(layer.hidden);assert(!classes.has('club-watermark-ready'),'load failure restores solid surfaces');
headerSrc='pitchkind-wt_mark.svg';observers[0].callback();assert.equal(imageSrc,'');assert.equal(image.onload,null);assert(layer.hidden,'a missing club badge has no invented watermark');
headerSrc='shooters-hill-logo.png';observers[0].callback();image.onload();assert(!layer.hidden,'existing header fallback restores a valid watermark');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');assert.match(html,/<div class="club-page-watermark"[^>]+aria-hidden="true" hidden>/);assert.match(html,/<img alt="" decoding="async" draggable="false"/);
const css=fs.readFileSync('app/src/main/assets/app-design-system.css','utf8');assert.match(css,/\.club-page-watermark\{[^}]*pointer-events:none[^}]*z-index:0/);assert.match(css,/\.app-shell>\.hero,\.app-shell>\.content\{[^}]*z-index:1/);assert.match(css,/rotate\(-22deg\)/);
console.log('PASS live watermark: current own-club badge, cached refresh, club switch and stale-load guard, original crop scope, load failure/placeholder fallback, decorative noninteractive layer below content');
