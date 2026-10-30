const assert=require('node:assert/strict'),{users}=require('../scripts/project-presence.js');
const now=1000000,members={owner:'owner',reader:'viewer'},data={
 owner:{pc:{name:'Designer',sheet:'/0010 Power',seenAt:now},ipad:{name:'Designer',sheet:'/0020 Controls',seenAt:now-30000}},
 reader:{phone:{name:'Reader <literal>',sheet:'/0030 Panel',seenAt:now-89999},expired:{name:'Old',sheet:'0001',seenAt:now-90000},future:{name:'Wrong clock',sheet:'0001',seenAt:now+60000},invalid:{name:'Invalid',sheet:'0001',seenAt:'today'}},
 removed:{one:{name:'Former member',sheet:'0001',seenAt:now}}
};
const before=JSON.stringify(data),active=users(data,members,now);
assert.equal(active.length,2);assert.equal(active.find(p=>p.uid==='owner').sessions.length,2);assert.deepEqual(active.find(p=>p.uid==='reader').sessions.map(s=>s.id),['phone']);assert.equal(active.find(p=>p.uid==='reader').name,'Reader <literal>');assert.equal(active.find(p=>p.uid==='reader').role,'viewer');
assert.equal(users(data,{owner:'owner'},now).length,1);assert.deepEqual(users(data,members,now+180000),[]);assert.deepEqual(users(null,members,now),[]);assert.equal(JSON.stringify(data),before);
console.log('PASS presence groups PC/iPad sessions by user, retains literal names/roles/pages, filters revoked membership, stale/invalid/future timestamps, expires sessions and leaves source data unchanged');
