import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import crypto from 'node:crypto';
import {dispatchBatch,emailMessage,validPushEndpoint,failureOutcome} from '../supabase/functions/kickoff-dispatch/delivery.mjs';
const require=createRequire(import.meta.url);
test('email uses approved club identity, escaped public details and an authenticated review link',()=>{
 const m=emailMessage({update_id:'fictional-update',title:'Kick-off added\nInjected header',body:'U12 Green\nProvisional\n<script>bad</script>'});
 assert.match(m.subject,/Shooters Hill AFC/);assert.doesNotMatch(m.subject,/[\r\n]/);assert.match(m.html,/&lt;script&gt;/);assert.doesNotMatch(m.html,/<script>/);assert.match(m.html,/shooters-hill-logo.png/);assert.match(m.text,/kickoff_update=fictional-update/);assert.match(m.text,/does not acknowledge the update/);assert.match(m.text,/child’s availability/);assert.doesNotMatch(m.text,/tick|checkbox/);assert.match(m.html,/Review and respond/);
});
test('push endpoint allowlist rejects arbitrary HTTPS and credentials/ports',()=>{
 for(const u of ['https://fcm.googleapis.com/device','https://web.push.apple.com/device','https://updates.push.services.mozilla.com/device','https://wns.notify.windows.com/device'])assert(validPushEndpoint(u));
 for(const u of ['http://fcm.googleapis.com/device','https://fcm.googleapis.com:9000/device','https://user@fcm.googleapis.com/device','https://fcm.googleapis.com.attacker.example/device','https://localhost/device'])assert(!validPushEndpoint(u));
});
test('dispatcher rechecks lease and audience, sends generic push, and records service acceptance separately',async()=>{
 const rows=['push','email','email','push'].map((channel,i)=>({id:String(i),channel,claim_token:'lease'+i,update_id:'fixture-event',email:'fictional@example.invalid',body:'Provisional',subscription:{endpoint:'https://fcm.googleapis.com/fictional',keys:{}}}));
 const finishes=[],sent=[];
 const rpc=async(name,args)=>name==='claim_kickoff_deliveries'?rows:name==='validate_kickoff_delivery'?args.p_id!=='2':finishes.push(args);
 const result=await dispatchBatch({rpc,origin:'https://shootershillafc.app',sendPush:async(sub,payload)=>{sent.push(JSON.parse(payload));if(sent.length>1)throw {statusCode:410};},sendEmail:async message=>{sent.push(message);return {status:'sent'};}});
 assert.deepEqual(finishes.map(x=>x.p_outcome),['sent','sent','cancelled','expired']);assert.deepEqual(sent[0],{update_id:'fixture-event'});assert(!JSON.stringify(sent[0]).includes('Provisional'));assert.equal(result.sent,2);assert.equal(result.cancelled,1);
});
test('transient email and push errors retry; permanent rejection and expired devices are distinct',()=>{
 assert.equal(failureOutcome({statusCode:429},'push'),'retrying');assert.equal(failureOutcome({responseCode:450},'email'),'retrying');assert.equal(failureOutcome({responseCode:550},'email'),'failed');assert.equal(failureOutcome({statusCode:410},'push'),'expired');assert.equal(failureOutcome({statusCode:400},'push'),'failed');
});
test('missing native email receipt never becomes Sent',async()=>{
 const finishes=[];await dispatchBatch({origin:'https://shootershillafc.app',rpc:async(name,a)=>name==='claim_kickoff_deliveries'?[{id:'1',claim_token:'lease',channel:'email',update_id:'event',email:'fictional@example.invalid'}]:name==='validate_kickoff_delivery'?true:finishes.push(a),sendEmail:async()=>({}),sendPush:async()=>{throw Error('unexpected');}});assert.equal(finishes[0].p_outcome,'retrying');
});
test('pinned Web Push library constructs an encrypted, authenticated request without sending',()=>{
 const webpush=require(process.env.KICKOFF_NODE_MODULES?process.env.KICKOFF_NODE_MODULES+'/web-push':'web-push');
 const key=crypto.createECDH('prime256v1');key.generateKeys();const vapid=webpush.generateVAPIDKeys();
 const req=webpush.generateRequestDetails({endpoint:'https://fcm.googleapis.com/fictional',keys:{p256dh:key.getPublicKey().toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')}},JSON.stringify({update_id:'fixture-event'}),{vapidDetails:{subject:'mailto:fictional@example.invalid',publicKey:vapid.publicKey,privateKey:vapid.privateKey}});
 assert.equal(req.headers['Content-Encoding'],'aes128gcm');assert.match(req.headers.Authorization,/vapid/);assert(req.body.length>0);assert(!req.body.toString().includes('fixture-event'));
});
