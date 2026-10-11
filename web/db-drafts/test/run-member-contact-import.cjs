// Throwaway in-memory PostgreSQL. No connection to Supabase.
// Usage: node run-member-contact-import.cjs /path/to/@electric-sql/pglite
const fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.argv[2]||'@electric-sql/pglite');
(async()=>{const db=new PGlite();try{
 for(const name of ['test/019_contacts_stub.sql','019_member_contact_details.sql','019_member_contact_import.sql','test/019_contacts_rollback_test.sql','test/019_contact_import_rollback_test.sql']){
  await db.exec(fs.readFileSync(path.join(__dirname,'..',name),'utf8'));
 }
 console.log('PASS local PostgreSQL: contacts access regressions, atomic bulk import, blank preservation, clear, malformed batches, cross-club/revoked/non-admin denial, private schema/grants. All synthetic rows rolled back.');
}finally{await db.close();}})().catch(e=>{console.error({message:e.message,code:e.code,position:e.position,where:e.where});process.exitCode=1;});
