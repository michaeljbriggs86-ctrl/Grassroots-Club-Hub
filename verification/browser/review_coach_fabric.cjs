// Actual built coach print, fictional account names, no external writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'coach-print-review');
fs.mkdirSync(out,{recursive:true});let base;
const harness=fs.readFileSync('verification/browser/verify_shared_components.cjs','utf8');
const prepare=eval('('+harness.slice(harness.indexOf('async function prepare('),harness.indexOf('async function seedResults(')).trim()+')');
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/cloud-config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.CLUB_HUB_CLOUD={enabled:true,url:"https://fictional.supabase.co",anonKey:"fictional-only-no-credentials-00000000000000000000000000"};');}
 if(u.pathname.startsWith('/data/')){res.setHeader('Content-Type','application/json');return res.end('{"clubs":[],"age_groups":[],"fixtures":[]}');}
 const file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
 for(const asset of ['graphics/shirt-coach.webp','shooters-hill-logo.png'])assert.equal(sha(path.join(root,asset)),sha(path.join('app/src/main/assets',asset)),'Built original artwork is unchanged: '+asset);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PITCHKIND_CHROMIUM?{executablePath:process.env.PITCHKIND_CHROMIUM}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({deviceScaleFactor:2}),measurements=[],errors=[],writes=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base)return route.continue();if(route.request().method()!=='GET')writes.push(u.origin+u.pathname);return route.fulfill({status:200,contentType:'application/json',body:'[]'});});
 try{
  for(const theme of ['light','dark'])for(const width of [320,393,700,1440])for(const zoom of [1,2])for(const [name,initials]of [['Morgan Blake','MB'],['Taylor','T'],['','']]){
   await prepare(page,'coach',width,theme);
   await page.evaluate(({name,zoom})=>{window.ClubHubCloud.context.profile.full_name=name;document.documentElement.style.fontSize=zoom===2?'200%':'100%';renderGraphicIdentity();},{name,zoom});
   await page.locator('#home-scene-shirt .graphic-shirt-art').evaluate(img=>img.decode());
   await page.locator('#home-scene-shirt .graphic-shirt-badge').evaluate(img=>img.decode());
   await page.evaluate(()=>document.fonts.ready);
   const m=await page.locator('#home-scene-shirt .graphic-shirt.coach').evaluate(el=>{
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2};};
    const text=el.querySelector('.graphic-shirt-initials'),badge=el.querySelector('.graphic-shirt-badge'),art=el.querySelector('.graphic-shirt-art'),s=getComputedStyle(text),b=getComputedStyle(badge);
    return{shirt:rect(el),text:{...rect(text),value:text.textContent,font:s.fontFamily,size:parseFloat(s.fontSize),weight:s.fontWeight,spacing:parseFloat(s.letterSpacing),opacity:s.opacity,shadow:s.textShadow,background:s.backgroundImage,filter:s.filter,fill:s.webkitTextFillColor,transform:s.transform},badge:{...rect(badge),opacity:b.opacity,filter:b.filter,src:badge.getAttribute('src')},art:{...rect(art),loaded:art.complete&&art.naturalWidth>0,naturalWidth:art.naturalWidth,naturalHeight:art.naturalHeight},headerBadgeWidth:document.querySelector('.club-logo-wrap').getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   const label=`${width} ${theme} ${zoom} ${name||'empty'}`;
   assert.equal(m.text.value,initials,label+' dynamic initials');
   assert(Math.abs(m.shirt.w/m.shirt.h-m.art.naturalWidth/m.art.naturalHeight)<.001,label+' print frame matches actual garment');
   assert(Math.abs(m.text.cy-m.badge.cy)<1,label+' chest marks share a centre line');
   assert(Math.abs((m.text.cy-m.shirt.y)/m.shirt.h-.365)<.005,label+' chest print follows garment height');
   assert(Math.abs(m.text.size/m.shirt.w-16/240)<.001,label+' initials follow garment width, including enlarged UI text');
   assert.match(m.text.background,/shirt-coach.webp/,label+' samples actual garment texture');assert.match(m.text.filter,/grayscale/,label+' fabric luminance becomes transfer ink');assert.equal(m.text.fill,'rgba(0, 0, 0, 0)',label+' texture replaces flat text fill');assert.equal(m.text.weight,'600',label+' refined print weight');assert.equal(m.text.shadow,'none',label+' no fake bevel or print shadow');
   assert.equal(m.badge.filter,'none',label+' original crest stays sharp');assert.equal(m.badge.src,'shooters-hill-logo.png',label+' exact original crest');
   assert(Math.abs(m.badge.w/m.shirt.w-31/240)<.001,label+' original relative badge size');
   assert(m.art.loaded,label+' original garment loaded');assert.equal(m.headerBadgeWidth,width<375?72:92,label+' shared header badge unchanged');assert.equal(m.overflow,false,label+' no document overflow');
   measurements.push({width,theme,zoom,name,...m});
   if(name==='Morgan Blake'&&zoom===1){
    await page.screenshot({path:path.join(out,`home-${width}-${theme}.png`)});
    const r=m.shirt;await page.screenshot({path:path.join(out,`print-${width}-${theme}.png`),clip:{x:r.x,y:r.y,width:r.w,height:Math.min(r.h,130)}});
   }
  }
  assert.deepEqual(errors,[],'No runtime errors');assert.deepEqual(writes,[],'No external writes');
  fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(measurements,null,2));
  console.log('PASS fabric print: '+measurements.length+' theme/width/text-size/name cases, natural garment ratio, aligned chest marks, proportional initials, original crest and native header size');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
