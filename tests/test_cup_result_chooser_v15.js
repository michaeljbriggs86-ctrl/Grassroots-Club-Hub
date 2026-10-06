const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const take=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a);assert(a>=0&&b>a);return app.slice(a,b);};
const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const first={date:'2099-10-10',competition:'U9 Selkent Cup Two - Round 1',opponent:'Chislehurst Wanderers Panthers',venue:'A',providerTeamIds:['opponent-one','our-team']};
const second={...first,opponent:'Lewisham Borough Cobras',venue:'H',providerTeamIds:['our-team','opponent-two']};
let team='team-one',serial=0;
const dialog={innerHTML:'',showModal(){this.open=true;},close(){this.open=false;}};
const c={CLOUD_MODE:true,currentRole:'coach',state:{meta:{teamName:'Shooters Hill AFC Valiants'},division:{teamName:'Shooters Hill AFC Valiants'},matches:[],selkent:{fixtures:[first,second,{...first}],results:[],fixtureOverrides:{}}},
 document:{getElementById:()=>dialog},window:{ClubHubCloud:{currentTeam:()=>({id:team})}},
 selkentNorm:norm,normalizeTeamKey:norm,ageGroupNumber:()=>9,matchTeamLabel:x=>x,ownTeamDisplayName:()=> 'Shooters Hill AFC Valiants',
 canConfirmFixtureDetails:()=>c.currentRole==='coach',requireCoach:()=>c.currentRole==='coach',fixtureDetailsConfirmed:()=>false,
 matchStatus:m=>m.status||'scheduled',isPublishedLeagueTeam:()=>false,formatDate:x=>x,esc:x=>String(x||''),
 clubIdentityBadgeHtml:n=>`<img alt="${n}"/>`,uid:()=> 'match-'+(++serial),saveState:()=>{},auditEvent:()=>{},toast:()=>{},openMatchReport:id=>c.opened=id};
vm.createContext(c);
vm.runInContext(take('function fixtureLinkedMatch(', 'function fixtureFingerprint(')+take('function homeFixtureTeamNames(', 'function canConfirmFixtureDetails('),c);
const html=c.cupGroupResultChooserHtml(first),rows=[...html.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/g)].map(x=>x[1]);
assert.equal(rows.length,2,'duplicate provider row does not add a result card');
assert.equal((html.match(/data-cup-result-row=/g)||[]).length,2);
assert.equal((html.match(/<img /g)||[]).length,4);
assert.match(html,/cup-result-shell/);assert.match(html,/cup-result-body/);
assert.match(rows[0],/Chislehurst Wanderers Panthers[\s\S]*canonical-v11-v[\s\S]*Shooters Hill AFC Valiants/);
assert.match(rows[1],/Shooters Hill AFC Valiants[\s\S]*canonical-v11-v[\s\S]*Lewisham Borough Cobras/);
assert(rows.every(row=>(row.match(/canonical-v11-side/g)||[]).length===2),'both team names have the styled side/badge wrappers');
assert.doesNotMatch(html,/canonical-match-team-row|<input|>0[–-]0</);
c.openCupGroupResultChooser(first);assert(dialog.open);assert.equal(dialog.innerHTML,html);
c.openCupGroupResultChooser(first);assert.equal(dialog.innerHTML,html,'reopening replaces rather than appends games');
const click=index=>dialog.onclick({target:{closest:s=>s==='[data-cup-result-row]'?{dataset:{cupResultRow:String(index)}}:null}});
click(0);assert.equal(c.state.matches.length,1);assert.equal(c.state.matches[0].opponent,first.opponent);assert.equal(c.state.matches[0].venue,'A');
assert.deepEqual(Array.from(c.state.matches[0].providerTeamIds),first.providerTeamIds);
c.openCupGroupResultChooser(first);click(1);assert.equal(c.state.matches.length,2);assert.equal(c.state.matches[1].opponent,second.opponent);assert.equal(c.state.matches[1].venue,'H');
assert.notEqual(c.state.matches[0].id,c.state.matches[1].id);assert(c.state.matches.every(m=>m.status==='scheduled'));
c.openCupGroupResultChooser(first);click(0);assert.equal(c.state.matches.length,2,'reopening uses the existing game record');
c.state.matches[0].status='played';const opened=c.opened;c.openCupGroupResultChooser(first);assert.equal((dialog.innerHTML.match(/>Recorded</g)||[]).length,1);click(0);assert.equal(c.opened,opened,'recorded game is not restarted');
c.openCupGroupResultChooser(first);team='team-two';click(1);assert.equal(c.opened,opened,'stale chooser cannot cross team context');
c.currentRole='parent';Object.defineProperty(c.state,'matches',{get(){throw Error('Parent read private match records');}});
assert.equal(c.cupGroupResultChooserHtml(first),'');c.selectCupGroupResult(first,1);
console.log('PASS Cup result chooser has exactly two styled home/away rows, reopens without duplicates, routes independent games and preserves permissions');
