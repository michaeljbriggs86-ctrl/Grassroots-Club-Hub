#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const start=app.indexOf('const TRAINING_WEEKDAYS='),end=app.indexOf('function renderParentHomeMatchInfo(){',start);
assert(start>0&&end>start);
for(const id of ['training-weekly-form','training-weekly-day','training-weekly-start','training-weekly-end','training-skipped-list'])assert(html.includes(`id="${id}"`));
const match=html.indexOf('id="matches-next-fixture"'),training=html.indexOf('id="parent-matches-training"');
assert(match<training,'confirmed matchday precedes training on Schedule');

const fields={
  'training-weekly-day':{value:'1'},'training-weekly-time':{value:'18:00'},
  'training-weekly-venue':{value:'Community pitch'},'training-weekly-note':{value:'Bring water'},
  'training-weekly-start':{value:'2026-09-30'},'training-weekly-end':{value:'2026-10-19'},
};
const state={trainingSessions:[{id:'dated-1',date:'2026-10-08',time:'17:00',venue:'Indoor hall',note:''}],trainingSchedule:{weekly:[],cancelled:[]}};
let saves=0,resets=0;
const context={state,Date,document:{getElementById:id=>fields[id]||null},
  requireCoach:()=>true,uid:()=> 'tw-1',saveState:()=>{saves++;},toast:()=>{},
  formatDate:x=>x,esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;')};
vm.runInNewContext(`${app.slice(start,end)}\nthis.addWeekly=addWeeklyTraining;this.upcoming=upcomingTrainingSessions;this.parentRows=parentTrainingRowsHtml;`,context);
context.addWeekly({preventDefault(){},target:{reset(){resets++;}}});
assert.equal(saves,1);
assert.equal(resets,1);
assert.equal(state.trainingSchedule.weekly.length,1);
const now=new Date('2026-09-30T10:00:00');
assert.deepEqual(Array.from(context.upcoming(12,now),s=>s.date),['2026-10-05','2026-10-08','2026-10-12','2026-10-19']);
assert.equal(state.trainingSessions.length,1,'generated sessions are never stored as one-off sessions');
state.trainingSchedule.cancelled.push('tw-1:2026-10-12');
assert.deepEqual(Array.from(context.upcoming(12,now),s=>s.date),['2026-10-05','2026-10-08','2026-10-19']);
assert.equal(context.upcoming(12,new Date('2026-10-19T19:00:00')).length,0,'past sessions disappear');
assert.match(context.parentRows(),/Community pitch|Indoor hall/);
console.log('PASS weekly training, one-off dates and skipped occurrences');
