const assert=require('node:assert/strict');
const C=require('../scripts/cloud-core.js'),clone=C.copy;
const initial={title:'Cloud project',projectInfo:{company:'Test'},cables:[],sheets:[{id:'a',title:'Sheet A',parts:[{id:'p1',x:1,y:2}],wires:[]},{id:'b',title:'Sheet B',parts:[],wires:[]}]};
(async()=>{
 const local=clone(initial),remote=clone(initial);local.sheets[0].parts[0].x=20;remote.sheets[1].title='Remote sheet';let r=C.merge(initial,local,remote);assert.equal(r.conflicts.length,0);assert.equal(r.document.sheets[0].parts[0].x,20);assert.equal(r.document.sheets[1].title,'Remote sheet');assert.deepEqual(initial.sheets[0].parts[0],{id:'p1',x:1,y:2});
 remote.sheets[0].parts[0].y=50;r=C.merge(initial,local,remote);assert.deepEqual(r.conflicts.map(x=>x.key),['sheet:a']);r=C.merge(initial,local,remote,{'sheet:a':'remote'});assert.equal(r.conflicts.length,0);assert.equal(r.document.sheets[0].parts[0].x,1);assert.equal(r.document.sheets[1].title,'Remote sheet');
 const deleted=clone(initial);deleted.sheets.shift();assert.equal(C.merge(initial,deleted,initial).document.sheets.length,1);assert.equal(C.merge(initial,deleted,local).conflicts[0].key,'sheet:a');
 const addition=clone(initial);addition.sheets.push({id:'c',title:'New',parts:[],wires:[]});assert.equal(C.merge(initial,addition,remote).document.sheets.length,3);
 const numbered=clone(initial),numberedRemote=clone(initial);numbered.sheets[0].number=10;numberedRemote.sheets[1].number=10;assert.ok(C.merge(initial,numbered,numberedRemote).conflicts.some(x=>x.key==='document'));assert.deepEqual(C.merge(initial,numbered,numberedRemote,{document:'remote'}).document,numberedRemote);
 const cable=clone(initial);cable.cables=[{id:'cable1'}];assert.ok(C.merge(initial,cable,local).conflicts.some(x=>x.key==='document'));
 assert.throws(()=>C.documentOf({...initial,sheets:[initial.sheets[0],initial.sheets[0]]}),/duplicate/);assert.equal(C.equal({b:1,a:2},{a:2,b:1}),true);
 let doc=clone(initial),server=clone(initial),busy=false,connected=true,changed=true,transactions=0,applies=0,conflict=null,release;
 const api={initial,capture:()=>doc,apply:v=>{doc=clone(v);applies++;},busy:()=>busy,connected:()=>connected,changed:()=>changed,status:()=>{},error:e=>{throw e;},conflict:c=>{conflict=c;},transact:async(base,local)=>{transactions++;const merged=C.merge(base,local,server);if(merged.conflicts.length)return{document:server,conflicts:merged.conflicts};server=merged.document;changed=false;return{document:server};}};
 const s=new C.Session(api);server.sheets[1].title='From PC';busy=true;await s.tick();assert.equal(transactions,0);busy=false;await s.tick();assert.ok(s.pending);assert.equal(applies,0);busy=true;await s.tick();assert.equal(applies,0);busy=false;await s.tick();assert.equal(doc.sheets[1].title,'From PC');assert.equal(s.dirty(),false);
 doc.sheets[0].parts[0].x=30;connected=false;await s.tick();assert.equal(s.dirty(),true);connected=true;await s.tick();await s.tick();assert.equal(server.sheets[0].parts[0].x,30);assert.equal(s.dirty(),false);
 doc.sheets[0].parts[0].x=40;server.sheets[0].parts[0].x=50;changed=true;await s.tick();assert.ok(conflict);assert.equal(doc.sheets[0].parts[0].x,40);s.resolve({'sheet:a':'remote'});assert.equal(doc.sheets[0].parts[0].x,50);assert.equal(s.conflict,null);
 // A request in flight must not replace edits made after it started.
 doc.sheets[0].parts[0].x=60;api.transact=async(base,local)=>{await new Promise(r=>release=r);server=C.merge(base,local,server).document;return{document:server};};const pending=s.tick();doc.sheets[1].title='iPad while syncing';release();await pending;await s.tick();assert.equal(doc.sheets[1].title,'iPad while syncing');assert.equal(doc.sheets[0].parts[0].x,60);assert.equal(s.dirty(),true);
 s.stop();const before=transactions;await s.tick();assert.equal(transactions,before);
 console.log('PASS atomic sheet merge, same-sheet/deletion/cable conflicts, explicit choices, unique IDs/numbers, offline retention, gesture deferral, in-flight edits, session stop');
})().catch(e=>{console.error(e);process.exitCode=1;});
