const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app.js'),'utf8');
const targets=source.slice(source.indexOf('function populateAnnouncementTargets(){'),source.indexOf('function renderAnnouncements(){'));
const publish=source.slice(source.indexOf('async function publishAnnouncement(){'),source.indexOf('async function markAnnouncementRead(',source.indexOf('async function publishAnnouncement(){')));
assert.ok(targets.startsWith('function populateAnnouncementTargets(){')&&publish.startsWith('async function publishAnnouncement(){'));

const select=()=>({value:'',_html:'',set innerHTML(markup){this._html=markup;this.value='';},get innerHTML(){return this._html;}});
const nodes={
  'announcement-age':select(),'announcement-team':select(),
  'announcement-audience':{value:'team'},'announcement-title':{value:'Training update'},'announcement-body':{value:'Meet at 6pm'},
  'announcement-age-wrap':{classList:{toggle(){}}},'announcement-team-wrap':{classList:{toggle(){}}},
  'announcement-pinned':{checked:false},'announcement-important':{checked:false},
  'announcement-send':{disabled:false,textContent:'Publish notice'}
};
let teams=[{id:'team-a',ageGroup:'U9',teamName:'Valiants'},{id:'team-b',ageGroup:'U10',teamName:'Vikings'}];
let calls=[],messages=[],errors=[];
const cloud={visibleTeamList:()=>teams,createAnnouncement:async payload=>{calls.push(payload);}};
const context={document:{getElementById:id=>nodes[id]},window:{ClubHubCloud:cloud},isAdmin:()=>true,
  esc:s=>String(s),matchTeamLabel:s=>String(s),toast:s=>messages.push(s),alert:s=>errors.push(s),refreshAnnouncements:async()=>{}};
vm.createContext(context);vm.runInContext(targets+publish,context);

(async()=>{
  context.populateAnnouncementTargets();
  assert.match(nodes['announcement-team'].innerHTML,/Choose team/);
  assert.equal(nodes['announcement-team'].value,'','a team must be explicitly selected');
  await context.publishAnnouncement();
  assert.equal(calls.length,0,'no notice goes to the first team by accident');
  assert.match(messages.at(-1),/Choose a team/);

  nodes['announcement-team'].value='team-b';
  nodes['announcement-age'].value='10';
  teams=[...teams].reverse();context.populateAnnouncementTargets();
  assert.equal(nodes['announcement-team'].value,'team-b','refresh preserves the chosen team');
  assert.equal(nodes['announcement-age'].value,'10','refresh preserves the chosen age');
  cloud.createAnnouncement=async()=>{throw Error('Network unavailable');};
  await context.publishAnnouncement();
  assert.match(errors.at(-1),/Could not publish club notice: Network unavailable/);
  assert.equal(nodes['announcement-body'].value,'Meet at 6pm','failed write preserves the draft');
  assert.equal(nodes['announcement-team'].value,'team-b','failed write preserves the target');
  assert.equal(nodes['announcement-send'].disabled,false);

  cloud.createAnnouncement=async payload=>{calls.push(payload);};
  await context.publishAnnouncement();
  assert.equal(calls.at(-1).teamId,'team-b');
  assert.equal(nodes['announcement-body'].value,'');
  assert.equal(nodes['announcement-send'].textContent,'Publish notice');

  nodes['announcement-audience'].value='age_group';nodes['announcement-title'].value='Age update';nodes['announcement-body'].value='Age message';
  teams=teams.filter(t=>t.id==='team-a');context.populateAnnouncementTargets();
  assert.equal(nodes['announcement-age'].value,'','a removed age cannot remain selected');
  await context.publishAnnouncement();
  assert.match(messages.at(-1),/Choose an age group/);
  assert.equal(calls.length,1);
  console.log('Club Admin notice audience and failure checks passed');
})().catch(err=>{console.error(err);process.exitCode=1;});
