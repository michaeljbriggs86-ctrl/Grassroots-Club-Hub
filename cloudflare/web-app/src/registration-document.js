const HASH='92cf3f0cde6c6c24690a6a48f75dbbc07b2f06b989f0d5f5e689cd4f8934565e';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer'};
export async function registrationDocument(request,env){
 const url=new URL(request.url),deny=(message,status)=>new Response(message,{status,headers});
 if(request.method!=='GET')return deny('Method not allowed',405);
 const auth=request.headers.get('Authorization')||'';
 if(!/^Bearer [A-Za-z0-9._-]{16,4096}$/.test(auth))return deny('Sign in to read this document.',401);
 const args={p_team_id:url.searchParams.get('team'),p_player_name:url.searchParams.get('player'),p_season:url.searchParams.get('season')};
 if(!args.p_team_id||!args.p_player_name||args.p_player_name.length>80||!args.p_season||args.p_season.length>20)return deny('Registration unavailable.',400);
 if(!env.REGISTRATION_SUPABASE_URL||!env.REGISTRATION_SUPABASE_PUBLISHABLE_KEY)return deny('Code of conduct temporarily unavailable.',503);
 try{
  const response=await fetch(env.REGISTRATION_SUPABASE_URL+'/rest/v1/rpc/get_registration_contact_conduct',{
   method:'POST',headers:{Authorization:auth,apikey:env.REGISTRATION_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});
  if(!response.ok)return deny('Registration document unavailable for this account.',response.status===401||response.status===403?403:503);
  const result=await response.json();
  if(result?.ok!==true||result?.document?.available!==true||result.document.sha256!==HASH)return deny('Code of conduct temporarily unavailable.',503);
  const object=await env.PILOT_BADGES?.get('registration-documents/shooters-hill/'+HASH+'.pdf');
  if(!object||object.size>1000000)return deny('Code of conduct temporarily unavailable.',503);
  const bytes=await object.arrayBuffer();
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==HASH)return deny('Code of conduct temporarily unavailable.',503);
  return new Response(bytes,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="Registration-information.pdf"'}});
 }catch{return deny('Code of conduct temporarily unavailable. Please retry.',503);}
}
