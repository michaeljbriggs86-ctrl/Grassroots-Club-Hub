const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const original=fs.readFileSync('cloudflare/web-app/src/registration-document.js','utf8');
// A local optional private PDF exercises the exact approved bytes. CI uses synthetic bytes
// and substitutes their hash only inside this isolated harness, never in production source.
const bytes=process.argv[2]?fs.readFileSync(process.argv[2]):Buffer.from('%PDF-1.4\nSynthetic full document fixture\n%%EOF');
const approvedHash='92cf3f0cde6c6c24690a6a48f75dbbc07b2f06b989f0d5f5e689cd4f8934565e',hash=crypto.createHash('sha256').update(bytes).digest('hex');
assert(original.includes(approvedHash));if(process.argv[2])assert.equal(hash,approvedHash);
const source=original.replaceAll(approvedHash,hash);let response,calls=[],objectBytes=bytes;
const handler=new Function('fetch','crypto',source.replace('export async function','async function')+';return registrationDocument;')(async(url,init)=>{calls.push({url,init});return response;},crypto.webcrypto);
const url='https://test.pitchkind.com/__registration_document?team=synthetic&player=Invented&season=2026%2F27',env={REGISTRATION_SUPABASE_URL:'https://synthetic.supabase.co',REGISTRATION_SUPABASE_PUBLISHABLE_KEY:'synthetic-public-key',PILOT_BADGES:{get:async key=>{assert.equal(key,'registration-documents/shooters-hill/'+hash+'.pdf');return objectBytes?{size:objectBytes.length,arrayBuffer:async()=>objectBytes}:null;}}};
const request=(auth=true,method='GET')=>new Request(url,{method,headers:auth?{Authorization:'Bearer synthetic-authenticated-token'}:{}});
const metadata=()=>new Response(JSON.stringify({ok:true,document:{available:true,sha256:hash}}));
(async()=>{
 assert.equal((await handler(request(false),env)).status,401);assert.equal(calls.length,0);assert.equal((await handler(request(true,'POST'),env)).status,405);
 response=new Response('{}',{status:403});assert.equal((await handler(request(),env)).status,403);
 response=new Response(JSON.stringify({ok:true,document:{available:false,sha256:hash}}));assert.equal((await handler(request(),env)).status,503);
 response=new Response(JSON.stringify({ok:true,document:{available:true,sha256:'forged'}}));assert.equal((await handler(request(),env)).status,503);
 response=metadata();objectBytes=null;assert.equal((await handler(request(),env)).status,503);
 response=metadata();objectBytes=Buffer.from('wrong document');assert.equal((await handler(request(),env)).status,503);
 response=metadata();objectBytes=bytes;const pdf=await handler(request(),env);assert.equal(pdf.status,200);assert.equal(pdf.headers.get('Content-Type'),'application/pdf');assert.match(pdf.headers.get('Cache-Control'),/no-store/);assert.equal(crypto.createHash('sha256').update(new Uint8Array(await pdf.arrayBuffer())).digest('hex'),hash);
 assert.equal(calls.at(-1).init.headers.Authorization,'Bearer synthetic-authenticated-token');assert.deepEqual(JSON.parse(calls.at(-1).init.body),{p_team_id:'synthetic',p_player_name:'Invented',p_season:'2026/27'});
 const config=JSON.parse(fs.readFileSync('cloudflare/web-app/wrangler.jsonc','utf8'));assert(config.assets.run_worker_first.includes('/__registration_document'));assert(config.assets.run_worker_first.includes('/_private_documents/*'));
 assert(!fs.readdirSync('cloudflare/web-app/dist').some(x=>x.endsWith('.pdf')));
 console.log('PASS protected PDF: anonymous/revoked access, registry/R2 absence, content SHA, authenticated whole document and no-store');
})().catch(e=>{console.error(e);process.exitCode=1;});
