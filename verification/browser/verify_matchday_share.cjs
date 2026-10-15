// Render actual canvas helpers with synthetic fixtures, no accounts or external calls.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.argv[2]||'playwright');
const assets=path.resolve('app/src/main/assets'),out=path.resolve(process.argv[3]||'matchday-share-review');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(assets,'app.js'),'utf8');
const take=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const helpers=take('function reviewedBadgeRotation(','function clubIdentityName(')+take('async function loadShareBadgeImage(','function matchdayShareFixture(')+take('function shareCardFontFamily(','let pendingMatchdayWebShare=');
const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.slice(1));if(!['inter-variable.woff2','shooters-hill-logo.png','club-badge-unavailable.svg'].includes(name)){res.writeHead(404).end();return;}res.end(fs.readFileSync(path.join(assets,name)));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});try{
const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.setContent('<style>@font-face{font-family:Inter;src:url(/inter-variable.woff2);font-weight:100 900}body{margin:0;font-family:Inter}</style>');await page.addScriptTag({content:helpers});
const evidence=[];
for(const theme of ['dark','light'])for(const variant of ['single','long','cup']){
 const result=await page.evaluate(async({theme,variant})=>{
  await document.fonts.load('700 54px Inter');await document.fonts.load('600 42px Inter');await document.fonts.ready;
  window.verifiedTeamBadgeUrl=name=>name.startsWith('Shooters Hill')?'shooters-hill-logo.png':'';
  window.fixtureCompetitionLabel=()=>variant==='cup'?'Example cup · Under 9':'Under 9D Navy';window.fixtureKitChoice=()=>variant==='long'?'away':'home';
  window.homeFixtureTeamNames=row=>row.names;window.fixtureOverviewContext=()=>({homeKit:'Green',awayKit:'Green'});
  const home=variant==='long'?'Example Community Athletic Under 13 Development':'Shooters Hill AFC Valiants';
  const away=variant==='long'?'Example Wanderers Football Club Under 13 United':'Shooters Hill AFC Gunners';
  const fixture={date:'2026-10-18',names:{home,away}},group=variant==='cup'?{fixtures:[fixture,{...fixture,names:{home,away:'Opponent TBC'}},{...fixture,names:{home,away:'Example Athletic Blues'}}]}:null;
  const d={time:'12:45',groundName:variant==='long'?'Example Community Sports and Recreation Ground (rear entrance)':'London Marathon Playing Fields',address:variant==='long'?'Example Sports Complex, 123 Example Avenue, Example Town, EX1 2AB':'304 Shooters Hill Road, SE18 4LT'};
  const canvas=document.createElement('canvas'),g=canvas.getContext('2d'),text=[],original=g.fillText.bind(g);
  g.fillText=(value,x,y)=>{const m=g.measureText(value),left=g.textAlign==='center'?x-m.width/2:g.textAlign==='right'?x-m.width:x;text.push({value,left,right:left+m.width,y,bottom:y+(m.fontBoundingBoxAscent||108)+(m.fontBoundingBoxDescent||30),font:g.font});original(value,x,y);};
  const geometry=await renderMatchdayShareCanvas(canvas,fixture,fixture,group,d,{ownTeam:'Shooters Hill AFC Valiants',ownProfile:{home:'Green'}},'12:15',theme);
  document.body.replaceChildren(canvas);canvas.style.width='320px';canvas.style.height='auto';
  return {...geometry,text,png:canvas.toDataURL('image/png')};
 },{theme,variant});
 assert.equal(result.width,1080);assert.equal(result.height-result.contentBottom,60,'footer padding retained');
 assert(result.text.every(t=>t.left>=59&&t.right<=1021&&t.y>=0&&t.bottom<=result.height),'all glyphs stay inside export');
 assert(result.text.every(t=>!t.value.includes('…')),'names and addresses are never truncated');
 assert(result.text.every(t=>t.font.includes('Inter')),'product font retained');
 if(variant==='cup')assert(result.text.find(t=>t.value==='12:15').y<result.text.find(t=>t.value==='Group game 1').y,'cup timings precede game list');
 const png=path.join(out,`${variant}-${theme}.png`);fs.writeFileSync(png,Buffer.from(result.png.split(',')[1],'base64'));
 await page.screenshot({path:path.join(out,`${variant}-${theme}-320.png`)});
 evidence.push({theme,variant,width:result.width,height:result.height,contentBottom:result.contentBottom,text:result.text});
}
fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log('PASS six real PNG exports: both themes, long names/venue, three cup games/TBC opponent, Inter, complete text, glyph bounds, footer and top cup timings');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
