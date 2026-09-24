#!/usr/bin/env node
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
const start=source.indexOf("function decodeSelkentText(value='')");
const end=source.indexOf('async function fetchClubDirectoryDetails(teamName)',start);
assert(start>=0&&end>start,'ground parser source not found');
const box={};vm.createContext(box);vm.runInContext(source.slice(start,end)+';this.parseSelkentClubGroundOptions=parseSelkentClubGroundOptions;',box);
const html=`<div>Home Ground</div><div>Charlton Park RFC</div><div>60A Broad Walk, Kidbrooke, SE3 8NB</div><div>Other Grounds</div><div>Coldharbour Leisure Centre</div><div>Chapel Farm Road, SE9 3LX</div><div>Crook Log Leisure Centre (rear of car park)</div><div>Brampton Road, Bexleyheath, DA7 4HH</div><div>Danson Youth Centre</div><div>Brampton Road, Bexleyheath, Kent, DA7 4EZ</div><div>Club Colours</div><div>Red Shirts; Red Shorts; Red Socks</div>`;
const rows=box.parseSelkentClubGroundOptions(html);assert.equal(rows.length,4);assert.deepEqual(JSON.parse(JSON.stringify(rows[2])),{name:'Crook Log Leisure Centre (rear of car park)',address:'Brampton Road, Bexleyheath, DA7 4HH'});console.log('PASS Selkent multiple-ground parser and Crook Log option');
