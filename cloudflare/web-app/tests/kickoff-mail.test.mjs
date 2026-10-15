import test from 'node:test';
import assert from 'node:assert/strict';
import {kickoffMail} from '../src/kickoff-mail.js';
const id='00000000-0000-0000-0000-000000000001',lease='00000000-0000-0000-0000-000000000002';
const row={id,update_id:id,email:'fictional@example.invalid',title:'Kick-off details changed',body:'Example team\nKick-off 10:30\nProvisional\n<script>escape</script>'};
const request=(body={id,claim_token:lease})=>new Request('https://shootershillafc.app/__kickoff_mail',{method:'POST',body:JSON.stringify(body)});
async function mock(run,send=async()=>({messageId:'fictional-receipt'}),redeem=()=>Response.json(row)){
 const original=globalThis.fetch,calls=[],sent=[];
 globalThis.fetch=async(url,init)=>{calls.push({url,init});return redeem();};
 const env={REGISTRATION_SUPABASE_URL:'https://project.example.invalid',REGISTRATION_SUPABASE_PUBLISHABLE_KEY:'fictional-publishable',REGISTRATION_EMAIL:{send:async message=>{sent.push(message);return send();}}};
 try{await run(env,calls,sent);}finally{globalThis.fetch=original;}
}
test('method and malformed lease fail before database or email access',async()=>mock(async(env,calls,sent)=>{
 assert.equal((await kickoffMail(new Request('https://shootershillafc.app/__kickoff_mail'),env)).status,405);
 assert.equal((await kickoffMail(request({id:'invalid',claim_token:lease}),env)).status,400);
 assert.equal(calls.length,0);assert.equal(sent.length,0);
}));
test('email recipient, body, link and sender come only from the redeemed server job',async()=>mock(async(env,calls,sent)=>{
 const response=await kickoffMail(request({id,claim_token:lease,email:'attacker@example.invalid',body:'caller content',url:'https://attacker.invalid'}),env);
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'sent'});
 assert.deepEqual(JSON.parse(calls[0].init.body),{p_id:id,p_claim_token:lease});assert.equal(calls[0].init.headers.Authorization,undefined);
 assert.equal(sent[0].to,row.email);assert.equal(sent[0].from.email,'Hello@pitchkind.com');assert.match(sent[0].html,/&lt;script&gt;/);assert.match(sent[0].text,/https:\/\/shootershillafc.app\/\?kickoff_update=/);assert(!sent[0].text.includes('caller content'));assert(!JSON.stringify(sent[0]).includes('attacker'));
 assert.match(response.headers.get('Cache-Control'),/no-store/);
}));
test('an expired, replayed or revoked server lease cannot send',async()=>mock(async(env,calls,sent)=>{
 assert.equal((await kickoffMail(request(),env)).status,403);assert.equal(sent.length,0);
},undefined,()=>Response.json({error:'unavailable'},{status:403})));
test('missing native provider receipt never claims sent',async()=>mock(async env=>{
 const response=await kickoffMail(request(),env);assert.equal(response.status,503);assert.equal((await response.json()).status,'retrying');
},async()=>({})));
test('rate limits and transient provider failures retry; permanent rejection does not',async()=>{
 for(const [code,status] of [['E_RATE_LIMIT_EXCEEDED','retrying'],['E_DAILY_LIMIT_EXCEEDED','retrying'],['E_INTERNAL_SERVER_ERROR','retrying'],['E_RECIPIENT_SUPPRESSED','failed'],['E_SENDER_NOT_VERIFIED','failed']])await mock(async env=>{assert.equal((await (await kickoffMail(request(),env)).json()).status,status);},async()=>{throw {code};});
});
test('missing binding cannot consume a lease or claim delivery',async()=>mock(async(env,calls,sent)=>{
 delete env.REGISTRATION_EMAIL;assert.equal((await kickoffMail(request(),env)).status,503);assert.equal(calls.length,0);assert.equal(sent.length,0);
}));
