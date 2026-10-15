// Supplemental tests for the disposable PGlite response-actions harness only.
// No network access, production connection, or real member data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function appResponseKeys(state,fixture){
 const app=fs.readFileSync(path.resolve(__dirname,'../../../app/src/main/assets/app.js'),'utf8');
 const take=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a);assert(a>=0&&b>a);return app.slice(a,b);};
 const normLine=app.slice(app.indexOf('function selkentNorm(')).split('\n')[0];
 const context={state,matchTeamLabel:value=>value};
 vm.createContext(context);
 vm.runInContext(normLine+'\n'+take('function ageGroupNumber(){','function currentAgeCode(){')+take('function miniCupGroup(f={}){','function cupFixtureDefaults(f={}){')+take('function fixtureStableKey(f={}){','function latestFixtureRowsV15('),context);
 return [...new Set([context.fixtureResponseKey(fixture),...context.legacyResponseKeyForFixture(fixture)])];
}

module.exports=async function extraKickoffResponseActions({db,query,sql,rpc,id}){
 const date=(await query("select (current_date+14)::text d"))[0].d;
 const ordinary={date,opponent:'Example & United',venue:'H',competition:'League',time:'10:00',groundName:'Fictional Fields',address:'Example Road'};
 const cup=[{...ordinary,competition:'Example Cup',opponent:'Opponent & United',providerTeamIds:['2','10']},{...ordinary,competition:'Example Cup',opponent:'Second United',venue:'A',time:'10:30',providerTeamIds:['3','10']}];
 const stateFor=(age,fixtures,division='')=>({meta:{ageGroup:age},division:{name:division},squad:[],selkent:{fixtures,fixtureOverrides:{}}});
 const dated=f=>[f.date,String(f.opponent||'tbc').toLowerCase().replace(/&amp;/g,'and').replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim(),String(f.venue||'').toUpperCase(),String(f.competition||'fixture').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim()].join('|');
 const cases=[];
 for(const age of ['U7','U8','U9','U10','U11','U12','U15','U10X','Under 10'])cases.push([`age ${age}`,stateFor(age,cup),cup[0]]);
 cases.push(['division age fallback',stateFor('U10X',cup,'Under 10 Navy'),cup[0]]);
 cases.push(['ordinary league',stateFor('U10',[ordinary]),ordinary]);
 cases.push(['one cup opponent',stateFor('U10',[cup[0]]),cup[0]]);
 cases.push(['three cup opponents',stateFor('U10',[...cup,{...cup[1],opponent:'Third United'}]),cup[0]]);
 cases.push(['duplicate opponent remains one',stateFor('U10',[cup[0],{...cup[0],opponent:' opponent and united ',venue:'A'}]),cup[0]]);
 cases.push(['duplicate row preserves two',stateFor('U10',[cup[0],{...cup[0],venue:'A',providerTeamIds:['1','10']},cup[1]]),cup[0]]);
 cases.push(['neutral venue remains group',stateFor('U10',cup.map(f=>({...f,venue:'N'}))),{...cup[0],venue:'N'}]);
 cases.push(['different dates remain games',stateFor('U10',[cup[0],{...cup[1],date:'2099-01-01'}]),cup[0]]);
 for(const competition of ['Example Vase','Example CUP','Example Shield','Cupcake League','Cup_2026']){
  const fixtures=cup.map(f=>({...f,competition}));cases.push([`competition ${competition}`,stateFor('U10',fixtures),fixtures[0]]);
 }
 const opted=stateFor('U10',cup);opted.selkent.legacyResponseFixtureKey=dated(cup[0]);cases.push(['group dated legacy opt-in',opted,cup[0]]);
 const groupMarker=stateFor('U10',cup);groupMarker.selkent.legacyResponseFixtureKey=`${date}|cup-group|example cup`;cases.push(['group primary is not an undated legacy opt-in',groupMarker,cup[0]]);
 const normalLegacy=stateFor('U10',[ordinary]);normalLegacy.selkent.legacyResponseFixtureKey=dated(ordinary);cases.push(['ordinary dated legacy opt-in',normalLegacy,ordinary]);
 const foreignLegacy=stateFor('U10',[ordinary]);foreignLegacy.selkent.legacyResponseFixtureKey=`2099-01-01|${dated(ordinary).slice(11)}`;cases.push(['other-date legacy is not inherited',foreignLegacy,ordinary]);
 for(const [label,state,fixture] of cases){
  const actual=(await query('select private.kickoff_response_keys($1::jsonb,$2) keys',[JSON.stringify(state),dated(fixture)]))[0].keys;
  assert.deepEqual(actual,appResponseKeys(state,fixture),`SQL/app fixture response parity: ${label}`);
 }

 // Reserved 300-series identities isolate these cases from the main harness.
 const team=id(320),otherTeam=id(321);
 await query('insert into public.teams(id,club_id,name,active,age_group) values($1,$3,$4,true,10),($2,$3,$5,true,10)',[team,otherTeam,id(10),'U10 Example Cup','U10 Other Example']);
 for(const [user,role] of [[300,'parent'],[301,'parent'],[302,'coach'],[303,'coach']]){
  await query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id(user),`fictional-extra-${user}@example.invalid`]);
  await query('insert into public.profiles(user_id,club_id,role,team_id,full_name) values($1,$2,$3,$4,$5)',[id(user),id(10),role,team,`Fictional Adult ${user}`]);
 }
 for(const [link,user,linkTeam,name] of [[330,300,team,'Alex Example'],[331,300,team,'Casey Example'],[332,302,team,'Riley Example'],[333,301,team,'Other Example'],[334,300,otherTeam,'Different Team Example']]){
  await query('insert into public.parent_player_links(id,club_id,team_id,parent_user_id,player_name) values($1,$2,$3,$4,$5)',[id(link),id(10),linkTeam,id(user),name]);
 }
 const state=stateFor('U10',cup);
 state.squad=['Alex Example','Casey Example','Riley Example','Other Example'].map(name=>({name,status:'active'}));
 const save=()=>query('insert into public.team_state(team_id,state) values($1,$2::jsonb) on conflict(team_id) do update set state=excluded.state,revision=public.team_state.revision+1',[team,JSON.stringify(state)]);
 await save();
 const getEvent=async key=>(await query('select * from private.kickoff_updates where team_id=$1 and fixture_key=$2 order by revision desc limit 1',[team,key]))[0];
 const first=await getEvent(dated(cup[0])),second=await getEvent(dated(cup[1]));assert(first&&second);
 const list=async(user,event)=>(await rpc(user,'list_kickoff_updates_for_me')).find(row=>row.update_id===event.id);
 const child=(card,link)=>card.children.find(row=>row.parent_link_id===id(link));
 const groupKey=`${date}|cup-group|example cup`;
 const seed=async(key,status,stamp)=>{
  // Controlled old snapshots need deterministic timestamps. This is fixture
  // setup in the throwaway database, and the real triggers are always restored.
  await sql('alter table public.match_availability disable trigger user');
  try{
   return (await query('insert into public.match_availability(team_id,fixture_key,parent_user_id,player_name,status,response_source,updated_at) values($1,$2,$3,$4,$5,$6,$7) on conflict(team_id,fixture_key,player_name) do update set status=excluded.status,updated_at=excluded.updated_at returning *',[team,key,id(300),'Alex Example',status,'parent',stamp]))[0];
  }finally{await sql('alter table public.match_availability enable trigger user');}
 };
 await seed(groupKey,'available','2000-01-02T00:00:00Z');
 await seed(dated(cup[0]),'unavailable','2000-01-02T00:00:00Z');
 assert.equal(child(await list(300,first),330).status,'available','equal timestamps prefer canonical group record');
 const legacy=await seed(dated(cup[0]),'unavailable','2000-01-03T00:00:00Z');
 let card=await list(300,first);
 assert.equal(card.children.length,2,'only this parent’s two current-team children are returned');
 assert.equal(child(card,330).status,'unavailable','newer dated legacy availability remains authoritative');
 assert.equal(child(card,330).response_current,false,'preexisting availability is not an exact-update confirmation');
 assert.equal(child(card,330).response_state,'none');
 await assert.rejects(rpc(300,'respond_kickoff_parent_availability',[first.id,id(333),'available']),/not linked/,'another family link denied');
 await assert.rejects(rpc(300,'respond_kickoff_parent_availability',[first.id,id(334),'available']),/not linked/,'own child on another team denied');
 await assert.rejects(rpc(300,'respond_kickoff_parent_availability',[first.id,id(330),'unsure']),/Attending or Unavailable/);
 card=await rpc(300,'respond_kickoff_parent_availability',[first.id,id(330),'available']);
 assert.equal(child(card,330).response_current,true);assert.equal(card.parent_response_state,'partial');
 const legacyAfter=(await query('select * from public.match_availability where id=$1',[legacy.id]))[0];
 assert.deepEqual(legacyAfter,legacy,'parent group response preserves historical per-game row unchanged');
 const canonical=(await query('select * from public.match_availability where team_id=$1 and fixture_key=$2 and player_name=$3',[team,groupKey,'Alex Example']))[0];
 assert.equal(canonical.status,'available');assert.equal(canonical.response_source,'parent');
 const evidenceBefore=(await query('select * from private.kickoff_parent_response_links where update_id=$1 and parent_link_id=$2',[first.id,id(330)]))[0];
 await rpc(300,'respond_kickoff_parent_availability',[first.id,id(330),'available']);
 const evidenceAfter=(await query('select * from private.kickoff_parent_response_links where update_id=$1 and parent_link_id=$2',[first.id,id(330)]))[0];
 assert.deepEqual(evidenceAfter,evidenceBefore,'repeated same response retains its exact row and evidence version');
 card=await rpc(300,'respond_kickoff_parent_availability',[first.id,id(331),'unavailable']);
 assert.equal(card.parent_response_state,'complete');assert.equal(child(card,331).status,'unavailable');
 await rpc(300,'respond_kickoff_parent_availability',[second.id,id(330),'unavailable']);
 card=await list(300,first);
 assert.equal(child(card,330).status,'unavailable');assert.equal(child(card,330).response_current,false);assert.equal(child(card,330).response_state,'changed','later shared group change invalidates older exact-update evidence');
 assert.equal(child(await list(300,second),330).response_current,true);
 await rpc(300,'respond_kickoff_parent_availability',[first.id,id(330),'unavailable']);
 assert.equal(child(await list(300,first),330).response_current,true);
 assert.equal(child(await list(300,second),330).response_current,true,'same-status reconfirmation does not create a cycle between cup games');

 // The same adult’s staff acknowledgement and own-child answer remain distinct.
 card=await list(302,first);assert.equal(card.can_acknowledge_as_coach,true);assert.equal(card.can_respond_as_parent,false);assert.equal(card.children.length,0);
 await assert.rejects(rpc(302,'respond_kickoff_parent_availability',[first.id,id(332),'available']),/Parent capacity/);
 const staff=await rpc(302,'acknowledge_kickoff_as_coach',[first.id]);assert(staff.coach_acknowledged_at);
 assert.equal((await query('select seen_at from private.kickoff_receipts where update_id=$1 and user_id=$2',[first.id,id(302)]))[0].seen_at,null,'staff acknowledgement does not manufacture parent response');
 await query('update public.profiles set acting_as_parent=true where user_id=$1',[id(302)]);
 card=await list(302,first);assert.equal(card.can_acknowledge_as_coach,false);assert.equal(card.can_respond_as_parent,true);assert.deepEqual(card.children.map(row=>row.player_name),['Riley Example']);
 await assert.rejects(rpc(302,'acknowledge_kickoff_as_coach',[first.id]),/Coaching capacity/);
 card=await rpc(302,'respond_kickoff_parent_availability',[first.id,id(332),'available']);
 assert.equal(child(card,332).response_source,'parent','dual-account parent answer retains parent provenance');
 const receipt=(await query('select * from private.kickoff_receipts where update_id=$1 and user_id=$2',[first.id,id(302)]))[0];
 assert.equal(new Date(receipt.coach_acknowledged_at).getTime(),new Date(staff.coach_acknowledged_at).getTime(),'own-child response does not overwrite staff acknowledgement');
 await query('update public.profiles set acting_as_parent=false where user_id=$1',[id(302)]);
 assert.equal(new Date((await list(302,first)).coach_acknowledged_at).getTime(),new Date(staff.coach_acknowledged_at).getTime());
 state.selkent.fixtures[0].time='11:45';await save();const revised=await getEvent(dated(cup[0]));assert(revised.revision>first.revision);
 await assert.rejects(rpc(300,'respond_kickoff_parent_availability',[first.id,id(330),'available']),/KICKOFF_DETAILS_CHANGED/);
 await assert.rejects(rpc(302,'acknowledge_kickoff_as_coach',[first.id]),/KICKOFF_DETAILS_CHANGED/);
 card=await list(300,revised);assert.equal(child(card,330).status,'unavailable','new release preserves visible availability');assert.equal(child(card,330).response_current,false,'new release has no inherited confirmation');
 assert.equal((await list(302,revised)).coach_acknowledged_at,null,'new release has no inherited staff acknowledgement');
 await rpc(300,'respond_kickoff_parent_availability',[revised.id,id(330),'available']);
 assert.equal((await query('select coach_acknowledged_at from private.kickoff_receipts where update_id=$1 and user_id=$2',[revised.id,id(302)]))[0].coach_acknowledged_at,null,'parent attendance cannot acknowledge a staff member');
 console.log(`PASS supplemental response actions: ${cases.length} SQL/app key parity cases, cup legacy/freshness, own-child isolation and independent dual capacities`);
};
