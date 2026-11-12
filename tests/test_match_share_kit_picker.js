const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('app/src/main/assets/match-share-kit-picker.js','utf8');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const build=fs.readFileSync('cloudflare/web-app/build.py','utf8');
const sw=fs.readFileSync('cloudflare/web-app/service-worker.js','utf8');
for(const name of ['match-share-kit-picker.js','match-share-kit-picker.css']){
 assert(html.includes(name),'index includes '+name);assert(build.includes('"'+name+'"'),'build copies '+name);assert(sw.includes("'./"+name+"'"),'worker caches '+name);
}
for(const id of ['match-share-kit-dialog','match-share-kit-home','match-share-kit-away','match-share-kit-image','match-share-kit-copy','match-share-kit-cancel'])assert(html.includes('id="'+id+'"'));
for(const id of ['next-match-share','matches-next-share','next-match-copy','matches-next-copy'])assert(app.includes("getElementById('"+id+"')?.addEventListener('click',()=>openMatchKitSharePicker());"));
assert(app.includes('openMatchKitSharePicker(match);'),'manual fixtures use kit selector');
assert(app.includes('function setFixtureKitChoice(key,choice){'),'existing kit API unchanged');
function mock(){
 const fixture={id:'next',date:'2026-11-15',time:'09:30',groundName:'Ground',address:'London',opponent:'Example United',venue:'H'};
 const manual={id:'manual',date:'2026-11-15',time:'11:00',groundName:'Manual ground',address:'London',opponent:'Example FC',venue:'A'};
 let current=fixture,staff=true,away='Blue and white';
 const writes=[],exports=[],copies=[],texts=[],messages=[],nodes={},events={};
 function node(id){if(!nodes[id])nodes[id]={id,innerHTML:'',textContent:'',checked:false,disabled:false,open:false,value:'',style:{},classList:{toggle(){}},setAttribute(){},focus(){},addEventListener(k,fn){events[id+':'+k]=fn},showModal(){this.open=true},close(){this.open=false;events['match-share-kit-dialog:close']?.()}};return nodes[id]}
 const home=node('match-share-kit-home'),awayRadio=node('match-share-kit-away'),dialog=node('match-share-kit-dialog');
 dialog.querySelectorAll=()=>[{querySelector:()=>home,classList:{toggle(){}},setAttribute(){}},{querySelector:()=>awayRadio,classList:{toggle(){}},setAttribute(){}}];
 const document={getElementById:node,querySelector:()=>awayRadio.checked?awayRadio:home,createElement:()=>({style:{},select(){},remove(){}}),body:{appendChild(){}},execCommand:()=>true};
 const state={matches:[manual],selkent:{fixtureKitSelections:{}}};
 const env={document,state,navigator:{clipboard:{writeText:async s=>texts.push(s)}},toast:s=>messages.push(s),
  canConfirmFixtureDetails:()=>staff,isCoach:()=>staff,isPlayedMatch:()=>false,nextPublishedFixture:()=>current,
  matchdayShareFixture:f=>({fixture:f,group:null,confirmed:true,details:f}),matchdayArrivalTime:()=> '09:00',
  fixtureKitSelectionKey:f=>f.id,homeFixtureTeamNames:f=>({home:'Shooters Hill Valiants',away:f.opponent}),
  fixtureOverviewContext:()=>({ownTeam:'Shooters Hill Valiants',ownProfile:{home:'Green and white',away}}),
  kitColourDisplayText:s=>s,knownKit:s=>!!s&&s!=='TBC',teamKitIconHtml:()=>'<svg></svg>',shareDateText:()=> 'Sunday 15 November 2026',
  fixtureKitChoice:f=>state.selkent.fixtureKitSelections[f.id]||'home',
  setFixtureKitChoice:(key,choice,options)=>{writes.push({key,choice,options});state.selkent.fixtureKitSelections[key]=choice;return true},
  shareNextMatchImage:async f=>exports.push(f),copyNextMatchDetails:async()=>copies.push('next'),
  matchdayShareCaption:f=>'Our kit: '+(state.selkent.fixtureKitSelections[f.id]||'home')
 };
 vm.createContext(env);vm.runInContext(src,env);
 return {env,fixture,manual,dialog,home,awayRadio,events,writes,exports,copies,texts,messages,setStaff:v=>staff=v,setAway:v=>away=v,setCurrent:v=>current=v};
}
(async()=>{
 const t=mock();t.env.openMatchKitSharePicker();
 assert(t.dialog.open);assert(t.home.checked);assert(!t.awayRadio.disabled);
 t.events['match-share-kit-cancel:click']();assert(!t.dialog.open);assert.equal(t.writes.length,0);
 t.env.openMatchKitSharePicker();t.home.checked=false;t.awayRadio.checked=true;
 await t.env.finishMatchKitShare('image');
 assert.equal(t.writes.length,1);assert.equal(t.writes[0].choice,'away');assert.equal(t.writes[0].options.silent,true);
 assert.equal(t.exports.length,1);assert.equal(t.exports[0],null);
 t.env.openMatchKitSharePicker();assert(t.awayRadio.checked);
 t.awayRadio.checked=false;t.home.checked=true;await t.env.finishMatchKitShare('copy');
 assert.equal(t.writes.at(-1).choice,'home');assert.deepEqual(t.copies,['next']);
 t.env.openMatchKitSharePicker(t.manual);t.home.checked=false;t.awayRadio.checked=true;
 await t.env.finishMatchKitShare('copy');
 assert.equal(t.writes.at(-1).key,t.manual.id);assert.equal(t.texts.at(-1),'Our kit: away');
 assert.equal(t.copies.length,1);
 t.setAway('TBC');t.env.openMatchKitSharePicker();assert(t.awayRadio.disabled);
 t.home.checked=false;t.awayRadio.checked=true;
 const before=t.exports.length;await t.env.finishMatchKitShare('image');assert.equal(t.exports.length,before);
 t.dialog.close();t.setStaff(false);t.env.openMatchKitSharePicker();assert(!t.dialog.open);
 t.setStaff(true);t.setAway('Blue and white');t.env.openMatchKitSharePicker();
 t.setCurrent({...t.fixture,id:'changed'});
 const prior=t.writes.length;await t.env.finishMatchKitShare('image');assert.equal(t.writes.length,prior);
 assert(t.messages.some(s=>/changed/i.test(s)));
 console.log('PASS match sharing kit selector: staff, cancel, home/away, next/manual, copy, unavailable kit, stale fixture and browser assets');
})().catch(e=>{console.error(e);process.exitCode=1});
