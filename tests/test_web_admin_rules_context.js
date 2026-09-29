const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app.js'),'utf8');
const body=source.slice(source.indexOf('function renderUniversalClubConfiguration(){'),source.indexOf('function applyMiniResultVisibility(){'));
let clubWide=true,coachAge=9;
const hidden=new Map();
const node=id=>({
  classList:{toggle:(name,value)=>{if(name==='hidden')hidden.set(id,value);}},
  innerHTML:'',textContent:''
});
const nodes=Object.fromEntries(['universal-config-rules','rules-procedures-settings','club-rule-age-field','rules-procedures-intro','selkent-mini-playing-time'].map(id=>[id,node(id)]));
const select={value:'',_html:'',set innerHTML(value){this._html=value;this.value='';},get innerHTML(){return this._html;}};
nodes['club-rule-age']=select;
const rules={
  9:{format:'5v5',players_on_pitch:5,max_registered:10,matchday_max:10,rolling_substitutions:true,results_published:false,player_accounts_allowed:false},
  15:{format:'11v11',players_on_pitch:11,max_registered:18,matchday_max:16,rolling_substitutions:false,results_published:true,player_accounts_allowed:true}
};
const context={
  document:{getElementById:id=>nodes[id]},
  window:{ClubHubCloud:{visibleTeamList:()=>[{ageGroup:'U9'},{ageGroup:'U15'}]}},
  isClubOverviewMode:()=>clubWide,providerType:()=> 'selkent',ageGroupNumber:()=>coachAge,
  competitionRuleForAge:age=>rules[age]||null,selkentMinimumPlayers:()=>null,esc:s=>String(s)
};
vm.createContext(context);vm.runInContext(body,context);
context.renderUniversalClubConfiguration();
assert.equal(hidden.get('club-rule-age-field'),false,'Club Admin sees an age selector');
assert.match(select.innerHTML,/Under 9s.*Under 15s/);
assert.match(nodes['universal-config-rules'].innerHTML,/Choose an age group/,'no team age is silently assumed');
select.value='15';context.renderUniversalClubConfiguration();
assert.equal(select.value,'15','chosen age survives a page refresh');
assert.match(nodes['universal-config-rules'].innerHTML,/11v11/);
assert.doesNotMatch(nodes['universal-config-rules'].innerHTML,/5v5/);
assert.equal(hidden.get('selkent-mini-playing-time'),true);
clubWide=false;context.renderUniversalClubConfiguration();
assert.equal(hidden.get('club-rule-age-field'),true,'Coach uses the assigned team age');
assert.match(nodes['universal-config-rules'].innerHTML,/5v5/);
assert.equal(hidden.get('selkent-mini-playing-time'),false);
console.log('Club Admin rules age context checks passed');
