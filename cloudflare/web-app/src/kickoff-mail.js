import { emailMessage } from '../../../supabase/functions/kickoff-dispatch/delivery.mjs';
const headers={'Content-Type':'application/json','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const permanent=new Set(['E_VALIDATION_ERROR','E_FIELD_MISSING','E_TOO_MANY_RECIPIENTS','E_TOO_MANY_ATTACHMENTS','E_SENDER_NOT_VERIFIED','E_RECIPIENT_NOT_ALLOWED','E_RECIPIENT_SUPPRESSED','E_SENDER_DOMAIN_NOT_AVAILABLE','E_CONTENT_TOO_LARGE','E_DELIVERY_FAILED','E_HEADER_NOT_ALLOWED','E_HEADER_USE_API_FIELD','E_HEADER_VALUE_INVALID','E_HEADER_VALUE_TOO_LONG','E_HEADER_NAME_INVALID','E_HEADERS_TOO_LARGE','E_HEADERS_TOO_MANY']);
export async function kickoffMail(request,env){
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 if(Number(request.headers.get('Content-Length')||0)>512)return reply({error:'Invalid delivery lease'},400);
 let body;try{const text=await request.text();if(text.length>512)throw Error();body=JSON.parse(text);}catch{return reply({error:'Invalid delivery lease'},400);}
 if(!uuid.test(body?.id||'')||!uuid.test(body?.claim_token||''))return reply({error:'Invalid delivery lease'},400);
 if(!env.REGISTRATION_EMAIL?.send)return reply({error:'Club email is unavailable',status:'retrying'},503);
 let row;try{
  const response=await fetch(env.REGISTRATION_SUPABASE_URL+'/rest/v1/rpc/redeem_kickoff_email',{method:'POST',headers:{apikey:env.REGISTRATION_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_id:body.id,p_claim_token:body.claim_token}),signal:AbortSignal.timeout(10000)});
  if(!response.ok){
   // PostgREST returns 401 for anon or 403 for an authenticated caller when
   // this RPC explicitly rejects a lease. Other failures are not revocations.
   const error=await response.json().catch(()=>null);
   if([401,403].includes(response.status)&&error?.code==='42501'&&error?.message==='Delivery unavailable')return reply({error:'Delivery unavailable'},403);
   return reply({error:'Delivery unavailable',status:'retrying'},503);
  }
  row=await response.json();
 }catch{return reply({error:'Delivery unavailable',status:'retrying'},503);}
 if(!uuid.test(row?.update_id||'')||typeof row.email!=='string'||!row.email||/[\r\n]/.test(row.email))return reply({error:'Delivery unavailable',status:'retrying'},503);
 const message=emailMessage(row,'https://shootershillafc.app');
 try{
  const result=await env.REGISTRATION_EMAIL.send({from:{email:'Hello@pitchkind.com',name:'Shooters Hill AFC'},to:row.email,replyTo:'secretary@shootershillfc.com',subject:message.subject,text:message.text,html:message.html});
  return typeof result?.messageId==='string'&&result.messageId?reply({status:'sent'}):reply({status:'retrying'},503);
 }catch(error){return reply({status:permanent.has(error?.code)?'failed':'retrying'},503);}
}
