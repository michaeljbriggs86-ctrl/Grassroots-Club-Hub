const fs=require('fs'),assert=require('assert');
const app=fs.readFileSync(__dirname+'/../app/src/main/assets/app.js','utf8');
const sql=fs.readFileSync(__dirname+'/../web/db-drafts/009_admin_job_titles_owner_guard.sql','utf8');
const fn=new Function(app.match(/function adminTitleLabel\(title\)\{[^\n]*\}/)[0]+';return adminTitleLabel;')();
assert.strictEqual(fn('Director'),'Director · Admin');
assert.strictEqual(fn('Club Secretary'),'Club Secretary · Admin');
assert.strictEqual(fn(''),'Club Admin');assert.strictEqual(fn(undefined),'Club Admin');
assert.ok(/guard_last_owner/.test(sql)&&/Owner access required/.test(sql));
console.log('admin job titles OK');
