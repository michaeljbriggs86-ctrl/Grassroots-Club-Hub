// Render actual canvas helpers with synthetic fixtures, no accounts or external calls.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.argv[2]||'playwright');
const assets=path.resolve('app/src/main/assets'),out=path.resolve(process.argv[3]||'matchday-share-review');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(assets,'app.js'),'utf8');
const take=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start,`canvas helper ${a} exists`);return source.slice(start,end);};
const helpers=take('function reviewedBadgeRotation(','function clubIdentityName(')+take('async function loadShareBadgeImage(','function matchdayShareFixture(')+take('function shareCardFontFamily(','let pendingMatchdayWebShare=');
const allowed=new Map([['inter-variable.woff2','font/woff2'],['graphics/anton-regular.ttf','font/ttf'],['graphics/pitch-wide.webp','image/webp'],['shooters-hill-logo.png','image/png'],['club-badge-unavailable.svg','image/svg+xml']]);
const html='<style>@font-face{font-family:Inter;src:url(/inter-variable.woff2);font-weight:100 900}@font-face{font-family:Anton;src:url(/graphics/anton-regular.ttf);font-weight:400}body{margin:0;font-family:Inter}canvas{display:block;width:320px;height:auto}</style>';
let failPitch=false;
const requests=[];
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1));if(!name){res.setHeader('Content-Type','text/html');return res.end(html);}const type=allowed.get(name),ok=!!type&&!(failPitch&&name==='graphics/pitch-wide.webp');requests.push({name,status:ok?200:404});if(!ok){res.writeHead(404).end();return;}res.setHeader('Content-Type',type);res.end(fs.readFileSync(path.join(assets,name)));});
async function renderCase({theme,variant}){
 window.verifiedTeamBadgeUrl=name=>name.startsWith('Shooters Hill')?'shooters-hill-logo.png':'';
 const competition=variant==='cup'?'Example cup · Under 9':variant==='long'?'Example Development League · Under 13 Division Navy':'Example League · U12';
 window.fixtureCompetitionLabel=()=>competition;window.fixtureKitChoice=()=>variant==='long'?'away':'home';
 window.homeFixtureTeamNames=row=>row.names;window.fixtureOverviewContext=()=>({homeKit:'Green',awayKit:'Green'});
 const home=variant==='long'?'Example Community Athletic Under 13 Development':'Shooters Hill AFC Example Greens';
 const away=variant==='long'?'Example Wanderers Football Club Under 13 United':'Example United';
 const fixture={date:'2026-10-25',names:{home,away},score:'PRIVATE_SCORE',players:['PRIVATE_CHILD'],notes:'PRIVATE_NOTE'},group=variant==='cup'?{fixtures:[fixture,{...fixture,names:{home,away:'Opponent TBC'}},{...fixture,names:{home,away:'Example Athletic Blues'}}]}:null;
 const d={time:variant==='single'?'09:30':'12:45',groundName:variant==='long'?'Example Community Sports and Recreation Ground (rear entrance)':'Example Sports Ground',address:variant==='long'?'Example Sports Complex, 123 Example Avenue, Example Town, EX1 2AB':'Example Lane, London, EX1 2AB'},arrival=variant==='single'?'09:00':'12:15';
 const canvas=document.createElement('canvas'),g=canvas.getContext('2d'),text=[],images=[],blocks=[],originalText=g.fillText.bind(g),originalImage=g.drawImage.bind(g),originalBlock=matchdayImageText;
 g.fillText=(value,x,y)=>{const m=g.measureText(value);text.push({value,left:x-m.actualBoundingBoxLeft,right:x+m.actualBoundingBoxRight,top:y-m.actualBoundingBoxAscent,bottom:y+m.actualBoundingBoxDescent,y,font:g.font});originalText(value,x,y);};
 g.drawImage=(image,...args)=>{images.push({src:image.src,width:image.naturalWidth,height:image.naturalHeight,args});originalImage(image,...args);};
 window.matchdayImageText=(...args)=>{const block=originalBlock(...args);blocks.push({source:String(args[1]),font:block.font,lines:[...block.lines]});return block;};
 let geometry;try{geometry=await renderMatchdayShareCanvas(canvas,fixture,fixture,group,d,{ownTeam:'Shooters Hill AFC Example Greens',ownProfile:{home:'Green'}},arrival,theme);}finally{window.matchdayImageText=originalBlock;}
 document.body.replaceChildren(canvas);
 const games=group?group.fixtures:[fixture],expected=[['MATCHDAY','Anton'],['SHOOTERS HILL AFC','Inter'],[shareDateText(fixture.date),'Inter'],[competition,'Inter'],[arrival,'Anton'],[d.time,'Anton'],['Arrival','Inter'],[group?'Group start':'Kick-off','Inter'],['Home','Inter'],['Away','Inter'],['V','Anton'],['VENUE','Inter'],[d.groundName,'Inter'],[d.address,'Inter'],[variant==='long'?'Wear away kit':'Wear home kit','Inter']];
 for(const [i,row] of games.entries()){expected.push([row.names.home,'Anton'],[row.names.away,'Anton']);if(group)expected.push([`Group game ${i+1}`,'Inter']);}
 if(group)expected.push(['Games are back-to-back. Order may change.','Inter']);
 return {...geometry,text,images,blocks,expected,arrival,time:d.time,fonts:{anton:document.fonts.check('400 120px Anton'),inter:document.fonts.check('400 42px Inter')},png:canvas.toDataURL('image/png')};
}
function checkResult(result,{theme,variant,pitch=true}){
 assert.equal(result.width,1080);assert.equal(result.height-result.contentBottom,60,'footer padding retained');assert.equal(result.style,'sunday-matchday-20261023');assert.equal(result.pitchLoaded,pitch,'pitch load state is explicit');assert.equal(result.theme,theme);assert(result.fonts.anton&&result.fonts.inter,'both font faces loaded');
 assert(result.text.every(t=>t.left>=59&&t.right<=1021&&t.top>=0&&t.bottom<=result.height),'all actual glyph bounds stay inside export');
 assert(result.text.every(t=>!t.value.includes('…')),'names and addresses are never truncated');assert(!JSON.stringify(result.text).includes('PRIVATE_'),'private fixture canaries are absent');
 const compact=s=>s.replace(/\s/g,'');
 for(const [value,family] of result.expected){const block=result.blocks.find(b=>b.source===value);assert(block,`complete field is present: ${value}`);assert.equal(compact(block.lines.join('')),compact(value),`full untruncated field: ${value}`);assert(block.font.includes(family),`${value} uses ${family}`);for(const line of block.lines)assert(result.text.some(t=>t.value===line&&t.font.includes(family)),`line is drawn: ${line}`);}
 const lineKey=(value,font)=>`${font.includes('Anton')?'Anton':'Inter'}:${value}`,required=new Map(),drawn=new Map();
 for(const block of result.blocks)for(const line of block.lines){const key=lineKey(line,block.font);required.set(key,(required.get(key)||0)+1);}
 for(const text of result.text){const key=lineKey(text.value,text.font);drawn.set(key,(drawn.get(key)||0)+1);}
 for(const [key,count] of required)assert((drawn.get(key)||0)>=count,`every repeated game field is drawn: ${key}`);
 assert(result.blocks.every(b=>b.font.includes('Inter')),'Inter remains the body/fallback font');assert(result.images.some(i=>i.src.endsWith('/club-badge-unavailable.svg')),'unknown opponent uses neutral unavailable badge');assert(result.images.every(i=>['/graphics/pitch-wide.webp','/shooters-hill-logo.png','/club-badge-unavailable.svg'].some(asset=>i.src.endsWith(asset))),'only approved assets are drawn');
 if(pitch)assert(result.images.some(i=>i.src.endsWith('/graphics/pitch-wide.webp')),'the loaded pitch reaches the canvas');
 if(variant==='cup')assert(Math.max(...result.text.filter(t=>[result.arrival,result.time].includes(t.value)).map(t=>t.y))<result.text.find(t=>t.value==='Group game 1').y,'cup timings precede all games');
 const bytes=Buffer.from(result.png.split(',')[1],'base64');assert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'real PNG bytes');assert(bytes.length<12_000_000,'PNG stays below the Android12,000,000-byte cap');return bytes;
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});try{
 const base=`http://127.0.0.1:${server.address().port}`,evidence=[];
 async function page(){const p=await browser.newPage({viewport:{width:320,height:900}});await p.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());await p.goto(base);await p.addScriptTag({content:helpers});return p;}
 const p=await page();
 for(const theme of ['dark','light'])for(const variant of ['single','long','cup']){const result=await p.evaluate(renderCase,{theme,variant}),bytes=checkResult(result,{theme,variant});fs.writeFileSync(path.join(out,`${variant}-${theme}.png`),bytes);await p.locator('canvas').screenshot({path:path.join(out,`${variant}-${theme}-320.png`)});const {png,...record}=result;evidence.push({variant,...record,pngBytes:bytes.length});}
 for(const name of ['graphics/pitch-wide.webp','graphics/anton-regular.ttf','inter-variable.woff2'])assert(requests.some(r=>r.name===name&&r.status===200),`${name} served successfully`);
 // A missing photograph must retain a complete, readable export and neutral badges.
 failPitch=true;const fallbackPage=await page(),fallback=await fallbackPage.evaluate(renderCase,{theme:'dark',variant:'single'}),bytes=checkResult(fallback,{theme:'dark',variant:'single',pitch:false});assert.equal(fallback.height,evidence[0].height,'photo failure cannot change layout');fs.writeFileSync(path.join(out,'pitch-fallback-dark.png'),bytes);await fallbackPage.locator('canvas').screenshot({path:path.join(out,'pitch-fallback-dark-320.png')});const {png,...record}=fallback;evidence.push({variant:'pitch-fallback',...record,pngBytes:bytes.length});
 fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({cases:evidence,requests},null,2));console.log('PASS six real PNG exports plus pitch404 fallback: both themes, loaded pitch/Anton, full text, glyph bounds,60px footer,Cup order,neutral badges,privacycanaries andPNG<12MB');
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
