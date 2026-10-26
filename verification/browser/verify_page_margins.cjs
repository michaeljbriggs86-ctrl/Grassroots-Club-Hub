// Shared page rails against the built app. Fictional data; external writes blocked.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.argv[2]||'playwright');
const root=path.resolve('cloudflare/web-app/dist'),out=path.resolve(process.argv[3]||'page-margin-review');
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
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PITCHKIND_CHROMIUM?{executablePath:process.env.PITCHKIND_CHROMIUM}:{}),args:['--no-sandbox']});
 const page=await browser.newPage(),measurements=[],errors=[],writes=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base)return route.continue();if(route.request().method()!=='GET')writes.push(u.origin+u.pathname);return route.fulfill({status:200,contentType:'application/json',body:'[]'});});
 try{
  for(const theme of ['light','dark'])for(const width of [320,374,375,393,700,900,901,1440,2560])for(const mode of ['populated','empty','long-text']){
   await prepare(page,'coach',width,theme);
   if(mode==='empty')await page.evaluate(()=>{state.squad=[];state.selkent.fixtures=[];renderAll();});
   if(mode==='long-text')await page.evaluate(()=>{state.meta.teamName='Example Greens with a longer team name';state.division.name='Under 9 Example division with a longer name';renderAll();document.documentElement.style.fontSize='200%';});
   const rails=[];
   for(const view of ['home','matches','squad','more']){
    await page.evaluate(v=>navigate(v,false),view);await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const m=await page.evaluate(view=>{
     const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height,right:r.right,bottom:r.bottom+scrollY};};
     const content=document.querySelector('.content'),hero=document.querySelector('.app-shell>.hero'),active=document.querySelector('.view.active'),style=getComputedStyle(content),title=active.querySelector(':scope>.section-title-row');
     const anchor=view==='home'?active.querySelector('.home-scene-copy'):title;
     return {view,viewport:innerWidth,clientWidth:document.documentElement.clientWidth,documentWidth:document.documentElement.scrollWidth,content:rect(content),hero:rect(hero),active:rect(active),anchor:rect(anchor),padding:parseFloat(style.paddingLeft),paddingRight:parseFloat(style.paddingRight),badge:rect(document.querySelector('.club-logo')),title:view==='home'?null:{...rect(title),minHeight:getComputedStyle(title).minHeight,marginBottom:getComputedStyle(title).marginBottom},squad:view==='squad'?['.squad-view-tabs','#squad-list-page','.squad-banner','.squad-format-details','#squad-list'].map(s=>({s,...rect(active.querySelector(s))})):[]};
    },view);
    const label=`${view} ${width} ${theme} ${mode}`,gutter=width<=374?16:width>=901?40:20,close=(a,b)=>Math.abs(a-b)<1;
    assert.equal(m.padding,gutter,label+' shared left gutter');assert.equal(m.paddingRight,gutter,label+' shared right gutter');
    assert(close(m.hero.x,m.content.x)&&close(m.hero.width,m.content.width),label+' header and content share maximum width');
    assert(close(m.active.x,m.content.x+gutter),label+' no nested page inset');assert(close(m.active.width,m.content.width-2*gutter),label+' no nested page cap');
    assert(close(m.anchor.x,m.active.x),label+' heading aligns to content');assert(close(m.anchor.y,m.hero.bottom+12),label+' title starts 12px below header');
    if(m.title){assert.equal(m.title.minHeight,'0px',label+' no blank title spacer');assert.equal(m.title.marginBottom,'20px',label+' shared title gap');}
    assert.equal(m.badge.width,width<=374?72:92,label+' unchanged badge size');
    assert(m.documentWidth<=m.clientWidth+1,label+' no document overflow');
    for(const s of m.squad)assert(close(s.x,m.active.x)&&close(s.width,m.active.width),label+' aligned '+s.s);
    rails.push({left:m.hero.x,width:m.hero.width,clientWidth:m.clientWidth});measurements.push({width,theme,mode,...m});
    if(mode==='populated'&&[320,393,1440].includes(width))await page.screenshot({path:path.join(out,`${view}-${width}-${theme}.png`),fullPage:false});
   }
   assert(rails.every(r=>Math.abs(r.left-rails[0].left)<1&&Math.abs(r.width-rails[0].width)<1&&r.clientWidth===rails[0].clientWidth),`${width} ${theme} ${mode}: navigating short/long pages keeps rails stable`);
   // Verify actual primary controls still change routes after the layout pass.
   const nav=page.locator(width<=900?'#mobile-primary-nav':'#top-nav-tabs');
   await nav.getByRole('button',{name:'Squad',exact:true}).click();assert.equal(await page.evaluate(()=>currentView),'squad');
   await page.locator('#squad-tactics-tab').click();assert(await page.locator('#squad-tactics-page').isVisible());
   await page.locator('#squad-list-tab').click();assert(await page.locator('#squad-list-page').isVisible());
  }
  assert.deepEqual(errors,[],'No runtime errors');assert.deepEqual(writes,[],'No external writes');
  fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(measurements,null,2));
  console.log('PASS shared page margins: '+measurements.length+' route/width/theme/content cases; navigation and Squad tabs');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
