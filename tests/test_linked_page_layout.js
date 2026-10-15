// Verify the shipped HTML has one destination per list, with no hidden duplicate lists on landing pages.
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const stack=[],ancestors=new Map(),ids=new Set();
const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
for(const match of html.matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi)){
 const [tag,name]=match,key=name.toLowerCase();
 if(tag.startsWith('</')){const at=stack.map(x=>x.tag).lastIndexOf(key);if(at>=0)stack.splice(at);continue;}
 const id=tag.match(/\bid="([^"]+)"/)?.[1];
 if(id){assert(!ids.has(id),`duplicate ID ${id}`);ids.add(id);ancestors.set(id,stack.map(x=>x.id).filter(Boolean));}
 if(!voids.has(key)&&!tag.endsWith('/>'))stack.push({tag:key,id});
}
const lists={'team-stats':['home-player-stats','season-player-stats','top-scorers','award-leaders'],contacts:['member-contacts-panel','member-contacts-list','contact-import-panel'],
 'club-teams':['admin-home-teams','admin-team-grid'], 'coach-documents':['coach-document-matrix','coach-document-table'],
 'app-access':['app-access-panel','admin-access-list'], 'staff-requests':['coach-requests','coach-requests-list'],
 'team-access':['team-access-settings','team-members-list'],rules:['rules-procedures-settings'],
 'season-history':['season-history-settings','season-history-summary'],'audit-history':['audit-history-settings','audit-history-list'],
 'raise-concern':['raise-concern-panel','concern-body']};
for(const [view,children] of Object.entries(lists)){
 for(const id of children)assert(ancestors.get(id)?.includes('view-'+view),`${id} belongs to ${view}`);
 const start=html.indexOf(`id="view-${view}"`),next=html.indexOf('<section id="view-',start+1);
 const body=html.slice(start,next<0?html.length:next);
 assert.match(body,/class="page-back secondary-button"[^>]*href="\?view=/,`${view} has a real Back link`);
 assert(html.includes(`data-page-route="${view}"`),`${view} has an entry link`);
 assert.match(html,new RegExp(`id="${view}-title" tabindex="-1"`),`${view} announces its focused title`);
}
assert(ancestors.get('coach-documents-summary-status').includes('club-coaches-panel'),'Staff keeps renewal warnings');
assert(!ancestors.get('coach-documents-summary-status').includes('admin-club-overview'),'Home no longer owns coach documents');
assert(ancestors.get('admin-team-count').includes('admin-club-overview'),'Home keeps the team count');
assert(!ids.has('admin-home-coverage-list'),'Home no longer repeats a staff assignment list');
console.log('PASS eleven dedicated pages: unique IDs, correct list placement, entry and Back links, focused titles and Staff document warnings');
