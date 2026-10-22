#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');

const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const take=(from,to)=>{const a=app.indexOf(from),b=app.indexOf(to,a);assert(a>=0&&b>a,`Missing source section: ${from}`);return app.slice(a,b);};
const nodes=Object.fromEntries(['home-scene-shirt','home-scene-label','home-scene-title','home-scene-team','home-scene-role','graphic-account-initials'].map(id=>[id,{innerHTML:'',textContent:'',hidden:false}]));
let teamId='team-one',userId='parent-one',confirmed=true,clubOverview=false,preview=false;
const linkedChild={name:'Alex Example',number:1,role:'goalkeeper'};
const otherChild={name:'Other Example',number:8,role:'outfield'};
const cloud={
  context:{profile:{full_name:'Jamie Example'}},
  session:{user:{get id(){return userId;}}},
  currentTeam:()=>({id:teamId}),
};
const context={
  CLOUD_MODE:true,currentRole:'parent',window:{ClubHubCloud:cloud},
  document:{getElementById:id=>nodes[id]||null},
  state:{meta:{ageGroup:'U9',teamName:'Example Greens',season:'2026/27'},squad:[linkedChild,otherChild]},
  __parentFamilyStatus:'ready',__parentFamilyKey:'parent-one:team-one',
  __parentFamilyLinks:[{parent_user_id:'parent-one',team_id:'team-one',player_name:'Alex Example'}],
  selkentNorm:s=>String(s||'').trim().toLowerCase(),matchTeamLabel:s=>s,
  esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  nextPublishedFixture:()=>({id:'fixture-one',confirmed}),parentMatchdayReady:f=>!!f?.confirmed,
  roleLabel:()=>context.currentRole==='parent'?'Parent':'Coach',
  isClubOverviewMode:()=>clubOverview,isAdminTeamPreviewMode:()=>preview,
  isCoach:()=>['coach','assistant_coach'].includes(context.currentRole),
};
vm.createContext(context);
vm.runInContext(`${take('function graphicShirtHTML(', 'function miniJerseyHTML(')}\n${take('function setStableHtml(', '// Club lists share')}`,context);
const shirt=()=>nodes['home-scene-shirt'];
const render=()=>context.renderGraphicIdentity();
const assertNoShirt=reason=>{render();assert.equal(shirt().innerHTML,'',reason);assert.equal(shirt().hidden,true,reason);};

render();
assert.match(shirt().innerHTML,/src="graphics\/shirt-goalkeeper.webp"/,'approved linked goalkeeper uses the purple garment');
assert.match(shirt().innerHTML,/class="graphic-shirt-number">1<\/span>/,'number remains live text above the blank garment');
assert.doesNotMatch(shirt().innerHTML,/Other Example|>8<|shirt-outfield/,'another squad member never supplies the parent scene');
assert.equal(nodes['home-scene-title'].textContent,'Your matchday');
assert.equal(nodes['home-scene-team'].textContent,'U9 Example Greens');
assert.equal(nodes['graphic-account-initials'].textContent,'JE');

linkedChild.number=12;linkedChild.role='outfield';render();
assert.match(shirt().innerHTML,/shirt-outfield.webp/,'current linked player role changes the garment');
assert.match(shirt().innerHTML,/graphic-shirt-number">12</,'current linked player number is refreshed');
assert.doesNotMatch(shirt().innerHTML,/shirt-goalkeeper|graphic-shirt-number">1</);
assert.equal(context.state.squad[1],otherChild,'rendering does not mutate squad data');

for(const status of ['loading','error']){
  context.__parentFamilyStatus=status;
  assertNoShirt(`${status} approved-link reads clear the previously rendered garment`);
}
context.__parentFamilyStatus='ready';
context.__parentFamilyKey='parent-one:old-team';
assertNoShirt('stale link identity cannot reuse the previous child');
context.__parentFamilyKey='parent-one:team-one';teamId='team-two';
assertNoShirt('switching team clears the previous child before links reload');
teamId='team-one';userId='parent-two';
assertNoShirt('switching account clears the previous child before links reload');
userId='parent-one';
context.__parentFamilyLinks=[{parent_user_id:'someone-else',team_id:'team-one',player_name:'Alex Example'}];
assertNoShirt('a matching player name does not establish parent ownership');
context.__parentFamilyLinks=[{parent_user_id:'parent-one',team_id:'team-two',player_name:'Alex Example'}];
assertNoShirt('a link for another team cannot use the current roster');
context.__parentFamilyLinks=[{parent_user_id:'parent-one',team_id:'team-one',player_name:'Unknown child'}];
assertNoShirt('unknown linked identity has no default or borrowed garment');
context.__parentFamilyLinks=[{parent_user_id:'parent-one',team_id:'team-one',player_name:'Alex Example'}];
context.state.squad.push({...linkedChild,number:20});
assertNoShirt('ambiguous roster names do not pick a shirt arbitrarily');
context.state.squad.pop();

confirmed=false;render();
assert.equal(nodes['home-scene-title'].textContent,'Training this week','unconfirmed fixtures never become the parent matchday headline');
context.nextPublishedFixture=()=>null;render();
assert.equal(nodes['home-scene-title'].textContent,'Training this week');
context.__parentFamilyLinks=[];assertNoShirt('a verified empty family has no garment');

context.currentRole='coach';render();
assert.match(shirt().innerHTML,/src="graphics\/shirt-coach.webp"/,'coach identity uses the black garment');
assert.match(shirt().innerHTML,/class="graphic-shirt-initials">JE<\/span>/);
assert.match(shirt().innerHTML,/class="graphic-shirt-badge" src="shooters-hill-logo.png"/,'coach badge uses the approved original asset');
assert.doesNotMatch(shirt().innerHTML,/<svg|graphic-shirt-number/,'coach decoration uses the original crest and initials');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('app/src/main/assets/shooters-hill-logo.png')).digest('hex'),'c99b2d689b5da2ca35cbb4f65ddc2051a503e94e6eeecf2d2a547e88d08226c0','the supplied club badge remains unchanged');
cloud.context.profile.full_name='Sam Other';render();
assert.match(shirt().innerHTML,/graphic-shirt-initials">SO</,'profile identity refresh replaces previous coach initials');
cloud.context.profile.full_name='';render();
assert.doesNotMatch(shirt().innerHTML,/>JE<|>SO<|>JT</,'missing profile name never invents initials');
clubOverview=true;assertNoShirt('club overview has no coach garment');clubOverview=false;
preview=true;assertNoShirt('read-only team preview has no coach identity');preview=false;
context.currentRole='player';assertNoShirt('player role cannot inherit a previous coach garment');

console.log('PASS graphic identity: current role/number, original badge, coach refresh, own linked child and stale/loading/account/team guards');
