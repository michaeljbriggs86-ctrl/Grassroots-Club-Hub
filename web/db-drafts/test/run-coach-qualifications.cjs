// Usage: node run-coach-qualifications.cjs /absolute/path/to/@electric-sql/pglite
// PGlite 0.3.14, throwaway in-memory Postgres. No connection to Supabase.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PGlite}=require(process.argv[2]||'@electric-sql/pglite');
(async()=>{const db=new PGlite();try{
 const draft=fs.readFileSync(path.join(__dirname,'../017_coach_qualifications.sql'),'utf8');
 const test=fs.readFileSync(path.join(__dirname,'017_coach_qualifications_rollback_test.sql'),'utf8');
 assert.equal((test.match(/-- @draft017/g)||[]).length,1);
 await db.exec(test.replace('-- @draft017',()=>draft));
 assert.equal((await db.query("select to_regclass('private.coach_qualification_profiles') as table_name")).rows[0].table_name,null,'test rolled back all objects');
 console.log('PASS 017: local Postgres RPC grants, private RLS, same-club admin writes, own-staff reads, parent-capacity denial, validation, optimistic revisions, removal and audit. All changes rolled back.');
}finally{await db.close();}})().catch(e=>{console.error({message:e.message,code:e.code,position:e.position,where:e.where});process.exitCode=1;});
