// Caller-authenticated entry point. The service credential never leaves this runtime.
const allowed=new Set(['https://shootershillafc.app','https://test.pitchkind.com']);
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowed.has(origin)?origin:'https://shootershillafc.app','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return reply({ok:true});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 if(origin&&!allowed.has(origin))return reply({error:'Origin not allowed'},403);
 const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const auth=req.headers.get('Authorization')||'';
 if(!/^Bearer [A-Za-z0-9._-]{16,4096}$/.test(auth))return reply({error:'Sign in first'},401);
 const rpc=async(name:string,body:unknown,serviceOnly=false)=>{
  const r=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:serviceOnly?service:key,Authorization:serviceOnly?'Bearer '+service:auth,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const data=await r.json();if(!r.ok)throw Error(data?.message||'Registration unavailable');return data;
 };
 try{
  const user=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:auth},signal:AbortSignal.timeout(10000)});
  if(!user.ok)return reply({error:'Sign in again'},401);
  const raw=await req.text();if(raw.length>2000)return reply({error:'Invalid request'},400);
  const body=JSON.parse(raw),action=body.action;
  if(!['invite','resend'].includes(action))return reply({error:'Invalid invitation action'},400);
  const result=await rpc('registration_api',{p_action:action,p_id:body.id||null,p_revision:body.revision??null,p_data:body.data||{}});
  const lease=await rpc('registration_delivery',{p_action:'lease',p_id:result.id,p_data:{}},true);
  if(lease.skipped)return reply({...result,delivery:'unchanged'});
  try{
   const mail=await fetch('https://shootershillafc.app/__registration_mail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:lease.ticket}),signal:AbortSignal.timeout(25000)});
   const delivery=await mail.json();return reply({...result,delivery:delivery.status||'uncertain'});
  }catch{return reply({...result,delivery:'uncertain'});}
 }catch(error){return reply({error:error instanceof Error?error.message:'Registration unavailable'},400);}
});
