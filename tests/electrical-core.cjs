const assert=require('node:assert/strict'),C=require('../scripts/electrical-core.js'),Cloud=require('../scripts/cloud-core.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`),copy=x=>JSON.parse(JSON.stringify(x));
const circuit=(system,voltage,extra={})=>({id:'s1',name:'Supply',system,voltage,reservePct:20,...extra});
const device=(id,value,extra={})=>({p:{id,type:'lamp',deviceCode:id,loadCalculation:{circuitId:'s1',input:'power',value,demandFactor:1,phase:'single',...extra}}});
const dc=circuit('dc',24,{ratingA:3,fault:{mode:'impedance',sourceR:25,lineR:75}});
let r=C.calculate(dc,[device('A',2,{input:'current'}),device('B',12,{demandFactor:.5})]);
close(r.powerW,60);close(r.demandW,54);close(r.currentA,2.25);close(r.requiredA,2.7);close(r.marginA,.3);assert.equal(r.complete,true);assert.equal(r.overloaded,false);close(r.fault.amps,240);
const ac1=circuit('ac1',230,{reservePct:25,ratingA:3,fault:{mode:'impedance',sourceR:100,sourceX:0,lineR:300,lineX:0,factor:1}});
r=C.calculate(ac1,[device('M',460,{powerFactor:.8,reactive:'lagging'})]);close(r.installedVA,575);close(r.demandVar,345);close(r.currentA,2.5);close(r.requiredA,3.125);assert.equal(r.overloaded,true);close(r.fault.amps,575);
const ac3=circuit('ac3',400,{reservePct:0,fault:{mode:'impedance',sourceR:6,sourceX:8,lineR:0,lineX:0,factor:1}}),motor=device('Motor',12000,{phase:'balanced',powerFactor:.8,reactive:'lagging'}),single=device('Socket',1000,{phase:'L1',powerFactor:1,reactive:'lagging'});
r=C.calculate(ac3,[motor,single]);close(r.phases[0].p,5000);close(r.phases[0].q,3000);close(r.phases[0].currentA,Math.sqrt(5000**2+3000**2)/(400/Math.sqrt(3)));close(r.phases[1].currentA,15000/(Math.sqrt(3)*400));close(r.phases[2].currentA,r.phases[1].currentA);close(r.currentA,r.phases[0].currentA);close(r.fault.amps,400/(Math.sqrt(3)*.01));
// Manufacturer guide's 400 kVA / 420 V / 4% transformer example (~13.7 kA).
close(C.fault(circuit('ac3',420,{fault:{mode:'impedance',sourceR:0,sourceX:17.64,lineR:0,lineX:0,factor:1}})).amps,400000/(Math.sqrt(3)*420)*25);
// Reactive power cancels algebraically; installed apparent loads do not.
r=C.calculate(ac1,[device('Inductive',460,{powerFactor:.8,reactive:'lagging'}),device('Capacitive',460,{powerFactor:.8,reactive:'leading'})]);close(r.demandVar,0);close(r.demandVA,920);close(r.installedVA,1150);close(r.currentA,4);
// Three-phase current input is per phase, single-phase current uses L–N voltage.
r=C.calculate(ac3,[device('Three phase',10,{input:'current',phase:'balanced',powerFactor:1,reactive:'lagging'}),device('L2',2,{input:'current',phase:'L2',powerFactor:1,reactive:'lagging'})]);close(r.phases[0].currentA,10);close(r.phases[1].currentA,12);close(r.phases[2].currentA,10);
assert.equal(C.calculate(dc,[]).complete,false);r=C.calculate(dc,[device('Valid',24),device('Bad',-1)]);assert.equal(r.complete,false);assert.equal(r.errors.length,1);close(r.demandW,24);
assert.equal(C.calculate(ac3,[device('Wrong phase',1)]).errors.length,1);assert.equal(C.calculate(ac1,[device('Missing pf',1)]).errors.length,1);
assert.equal(C.fault(circuit('dc',24)).status,'off');assert.equal(C.fault(circuit('ac1',230,{fault:{mode:'impedance',sourceR:0,lineR:0,sourceX:0,lineX:0,factor:1}})).status,'incomplete');assert.equal(C.fault(circuit('ac1',230,{fault:{mode:'impedance',sourceR:1,lineR:0,sourceX:0,factor:1}})).status,'incomplete');assert.equal(C.fault(circuit('dc',24,{fault:{mode:'limited'}})).status,'incomplete');r=C.fault(circuit('dc',24,{fault:{mode:'limited',limitA:12}}));assert.equal(r.status,'declared');close(r.amps,12);assert.equal(r.z,undefined);
for(const value of [-1,NaN,Infinity,'24',null])assert.throws(()=>C.validateLoad({...device('x',value).p.loadCalculation}));
for(const extra of [{voltage:0},{reservePct:-1},{system:'bad'},{ratingA:0},{fault:{mode:'impedance',sourceR:-1}},{fault:{mode:'limited',limitA:10},system:'ac1'}])assert.throws(()=>C.validateCircuit({...dc,...extra}));
const initial={title:'Electrical project',projectInfo:{electricalCalculations:{version:1,circuits:[dc]}},sheets:[{id:'a',title:'A',parts:[device('D1',24).p],wires:[]},{id:'b',title:'B',parts:[device('D2',12).p],wires:[]}]};
assert.deepEqual(Cloud.documentOf(initial),{...initial,cables:[]});let invalid=copy(initial);invalid.projectInfo.electricalCalculations.circuits.push(dc);assert.throws(()=>Cloud.documentOf(invalid));invalid=copy(initial);invalid.sheets[0].parts[0].loadCalculation.value=-1;assert.throws(()=>Cloud.documentOf(invalid));
// Cross-sheet load changes may merge, but supply changes and concurrent load
// changes must be reviewed together, including a removed-circuit race.
let local=copy(initial),remote=copy(initial);local.sheets[0].parts[0].loadCalculation.value=48;remote.sheets[1].parts[0].loadCalculation.value=36;r=Cloud.merge(initial,local,remote);assert.equal(r.conflicts.length,0);close(r.document.sheets[0].parts[0].loadCalculation.value,48);close(r.document.sheets[1].parts[0].loadCalculation.value,36);
local=copy(initial);local.projectInfo.electricalCalculations.circuits[0].voltage=48;r=Cloud.merge(initial,local,remote);assert.ok(r.conflicts.some(c=>c.key==='document'));assert.deepEqual(Cloud.merge(initial,local,remote,{document:'remote'}).document,remote);
remote=copy(initial);remote.sheets[1].parts[0].x=300;assert.equal(Cloud.merge(initial,local,remote).conflicts.length,0);
local=copy(initial);local.projectInfo.electricalCalculations.circuits=[];remote=copy(initial);remote.sheets[1].parts[0].loadCalculation.value=50;assert.ok(Cloud.merge(initial,local,remote).conflicts.some(c=>c.key==='document'));
console.log('PASS DC / single- and three-phase loads, unbalanced phases, signed reactive power, reserve/rating, independent fault examples, missing-data and invalid-input handling, cloud persistence and supply/load races');
