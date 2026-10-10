const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app.js'),'utf8');
class Element{
 constructor(tagName='INPUT'){this.tagName=tagName;this.options=[];this.value='';this.textContent='';this.hidden=false;this.listeners={};this.classList={toggle:(_,hidden)=>{this.hidden=hidden;}};}
 set innerHTML(html){this.html=html;this.options=[...html.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map(m=>({value:m[1],text:m[2]}));this.value=this.options[0]?.value||'';}
 add(option){this.options.push(option);}
 addEventListener(type,fn){this.listeners[type]=fn;}
}
const nodes={};
for(const id of ['match-opponent','match-opponent-age','match-competition'])nodes[id]=new Element('SELECT');
for(const id of ['match-opponent-age-wrap','match-opponent-input-wrap','match-opponent-directory-help'])nodes[id]=new Element();
nodes['match-competition'].value='Friendly';
const context=vm.createContext({document:{getElementById:id=>nodes[id]||null},window:{ClubHubCloud:{}},
 state:{division:{teamName:'Shooters Hill AFC Valiants'},meta:{clubName:'Shooters Hill AFC',teamName:'Valiants'},matches:[],goals:[],awards:[]},
 CLOUD_MODE:true,providerType:()=> 'selkent',ageGroupNumber:()=>9,clubSettings:()=>({display_name:'Shooters Hill AFC'}),
 selkentNorm:s=>String(s).toLowerCase(),esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
 isFriendlyMatch:m=>m.competition==='Friendly',Option:function(text,value){this.text=text;this.value=value;}});
vm.runInContext(src.slice(src.indexOf('let __selkentAgeTeams='),src.indexOf('let __availabilityRows=')),context);
vm.runInContext(src.split('\n').find(line=>line.startsWith("document.getElementById('match-opponent-age')?.addEventListener")),context);
const team=(age,name='Shooters Hill AFC Cannons')=>({id:`cannons-${age}`,club_name:'Shooters Hill AFC',display_name:name,team_label:`Under ${age} Cannons`,age_variant:`U${age}`});
async function main(){
 context.configureOpponentAgeGroup();
 assert.equal(nodes['match-opponent-age'].value,'9','friendlies default to the active team age');
 assert.equal(nodes['match-opponent-age-wrap'].hidden,false);
 context.window.ClubHubCloud.listSelkentTeamDirectory=async age=>[team(age)];
 await context.refreshSelkentOpponentDirectory();
 nodes['match-opponent'].value='Shooters Hill AFC Cannons';
 nodes['match-opponent-age'].value='8';
 await nodes['match-opponent-age'].listeners.change();
 assert.equal(nodes['match-opponent'].value,'','changing age clears the old selection');
 assert.match(nodes['match-opponent'].html,/\(U8\)/);
 nodes['match-opponent'].value='Shooters Hill AFC Cannons';
 assert.equal(context.matchOpponentDirectorySelection('Friendly',nodes['match-opponent'].value).opponentProviderTeamId,'cannons-8');
 assert.equal(context.matchOpponentDirectorySelection('Friendly',nodes['match-opponent'].value).opponentAgeGroup,8);

 // Different ages can finish out of order; only the latest selection wins.
 const pending={};context.window.ClubHubCloud.listSelkentTeamDirectory=age=>new Promise(resolve=>{pending[age]=resolve;});
 nodes['match-opponent-age'].value='10';const slow=context.refreshSelkentOpponentDirectory();
 nodes['match-opponent-age'].value='8';const latest=context.refreshSelkentOpponentDirectory();
 pending[8]([team(8)]);await latest;
 pending[10]([team(10,'Wrong older team')]);await slow;
 assert.match(nodes['match-opponent'].html,/\(U8\)/);assert.doesNotMatch(nodes['match-opponent'].html,/Wrong older/);

 nodes['match-competition'].value='League';context.configureOpponentAgeGroup();
 assert.equal(nodes['match-opponent-age-wrap'].hidden,true);
 assert.equal(nodes['match-opponent-age'].disabled,true);
 assert.equal(context.selectedOpponentAgeGroup(),9);
 assert.equal(context.matchOpponentDirectorySelection('League','Shooters Hill AFC Cannons').opponentAgeGroup,null);
 nodes['match-competition'].value='Friendly';context.resetOpponentAgeGroup(8);
 assert.equal(context.selectedOpponentAgeGroup(),8,'an edited friendly can restore its saved U8 choice');

 // Save the real form through submitMatch: preserve the scores and canonical
 // badge name while recording the chosen opponent age and directory row ID.
 for(const [id,value] of Object.entries({'match-id':'friendly-1','match-date':'2026-09-14','match-opponent':'Shooters Hill AFC Cannons','match-venue':'H','match-status':'played','match-gf':'11','match-ga':'6','match-stage':'','match-notes':'Retained note'})){
   nodes[id]??=new Element();nodes[id].value=value;
 }
 context.state.matches=[{id:'friendly-1',competition:'Friendly',source:'manual',opponent:'Shooters Hill Cannons',date:'2026-09-14',venue:'H',gf:11,ga:6}];
 context.state.goals=[{matchId:'other-match',player:'Other',goals:1}];
 context.document.querySelectorAll=()=>[{value:'11',dataset:{player:'Scorer'}}];
 Object.assign(context,{CLOUD_MODE:false,__divisionEntryMode:false,requireCoach:()=>true,uid:()=> 'new-id',isDivisionMatch:()=>false,
  featureEnabled:()=>false,saveState:()=>{},auditEvent:()=>{},resetMatchForm:()=>{},navigate:()=>{},toast:()=>{}});
 vm.runInContext(src.slice(src.indexOf('let __matchSubmissionInFlight='),src.indexOf('function isProviderOwnedMatch(')),context);
 await context.submitMatch({preventDefault(){}});
 const saved=context.state.matches[0];
 assert.equal(saved.opponentAgeGroup,8);assert.equal(saved.opponentProviderTeamId,'cannons-8');
 assert.equal(saved.opponent,'Shooters Hill AFC Cannons');assert.equal(saved.gf,11);assert.equal(saved.ga,6);
 assert.equal(saved.notes,'Retained note');assert.equal(context.state.goals[0].matchId,'other-match');

 context.CLOUD_MODE=true;nodes['match-opponent-age'].value='7';
 context.window.ClubHubCloud.listSelkentTeamDirectory=async()=>{throw Error('Unavailable');};
 await context.refreshSelkentOpponentDirectory();
 assert.doesNotMatch(nodes['match-opponent'].html,/Cannons/,'a failed new age cannot offer stale teams');
 assert.match(nodes['match-opponent-directory-help'].textContent,/U7.*temporarily unavailable/);
 console.log('Friendly opponent ages: U8 selection, same-name identity, save, edit age, league scope, stale-request and failure checks passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
