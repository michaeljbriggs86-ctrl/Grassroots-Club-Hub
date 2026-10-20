#!/usr/bin/env node
// club_messages.subject is NOT NULL and send_club_message turns '' into NULL (live 2026-10-10:
// "null value in column subject ... violates not-null constraint"). The app must never send a blank subject.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const take=(from,to)=>{const a=app.indexOf(from),b=app.indexOf(to,a);assert(a>=0&&b>a,from);return app.slice(a,b);};
const fields={};for(const id of ['inbox-message-body','inbox-subject','send-inbox-message','inbox-contact-select','inbox-thread','inbox-compose-hint'])fields[id]={value:'',innerHTML:'',textContent:'',disabled:false};
const sent=[];
const ctx={CLOUD_MODE:true,currentRole:'coach',personProfileContextKey:()=>'me|club|team|coach',isAdmin:()=>false,isClubOverviewMode:()=>false,isAdminCoachMode:()=>false,esc:String,
  document:{getElementById:id=>fields[id]||null},
  toast:()=>{},alert:m=>{throw new Error('alert: '+m);},
  window:{ClubHubCloud:{session:{user:{id:'me'}},listMessageContacts:async()=>[{user_id:'admin',role:'club_admin'}],listClubMessages:async()=>ctx.history||[],sendClubMessage:async a=>{sent.push(a);},markClubMessagesRead:async()=>{}}}};
vm.createContext(ctx);
vm.runInContext(take('let __inboxStamp=','let __clubResultsStamp='),ctx);
(async()=>{
  await ctx.refreshInbox(false);
  // New conversation, blank subject: falls back to "Message".
  fields['inbox-message-body'].value='Test';await ctx.sendInboxMessage();
  assert.equal(sent.at(-1).subject,'Message');
  // Existing conversation: a blank reply reuses its latest subject.
  ctx.history=[{sender_user_id:'admin',recipient_user_id:'me',subject:'Pitch booking',thread_id:'t1',read_at:'2026-10-20'}];await ctx.refreshInbox(false);
  fields['inbox-message-body'].value='Thanks';await ctx.sendInboxMessage();
  assert.equal(sent.at(-1).subject,'Pitch booking');assert.equal(sent.at(-1).threadId,'t1');
  // A typed subject is kept.
  fields['inbox-message-body'].value='New topic';fields['inbox-subject'].value='Kit';await ctx.sendInboxMessage();
  assert.equal(sent.at(-1).subject,'Kit');
  assert(sent.every(a=>String(a.subject||'').trim()),'no blank subject ever reaches send_club_message');
  // The thread shows a subject only when it changes.
  assert.match(app,/showSubject=!!subj&&subj!==lastSubject/);
  console.log('PASS inbox never sends a blank subject; replies reuse the conversation subject');
})().catch(e=>{console.error(e);process.exitCode=1;});
