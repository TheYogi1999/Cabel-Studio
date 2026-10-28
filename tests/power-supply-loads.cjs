const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Net=require('../scripts/electrical-network.js'),Core=require('../scripts/electrical-core.js'),Cloud=require('../scripts/cloud-core.js');
const catalog=new Map();for(const file of fs.readdirSync(path.join(__dirname,'../libraries')).filter(f=>f.endsWith('.json'))){const l=JSON.parse(fs.readFileSync(path.join(__dirname,'../libraries',file)));for(const f of l.families)for(const p of f.products)catalog.set(l.id+':'+p.id,{library:l,product:p});}
const lookup=p=>catalog.get(p.catalog?.libraryId+':'+p.catalog?.productId)?.product.attributes?.loadModel;
function product(key,id,legacy=false){const{product:p}=catalog.get(key),attributes=structuredClone(p.attributes||{});if(legacy)delete attributes.loadModel;return{id,type:p.symbol,deviceCode:id,pinNumbers:structuredClone(p.pinNumbers),portKinds:structuredClone(p.portKinds),catalog:{libraryId:key.split(':')[0],productId:p.id,attributes}};}
const load=value=>({assignment:'automatic',circuitId:'@auto',phase:'auto',input:'power',value,demandFactor:1,powerFactor:1,reactive:'lagging'});
function fixture(psu=product('phoenix-contact:uno-24dc-60w','psu')){
  const io=product('beckhoff:el1008','io',true),lamp={id:'lamp',type:'lamp',loadCalculation:load(12)};io.loadCalculation=load(4.8);
  return{title:'Automatic PSU outputs',projectInfo:{},sheets:[{id:'s',parts:[psu,io,lamp],wires:[['psu:5','io:0'],['psu:6','io:1'],['psu:3','lamp:0'],['psu:4','lamp:1']].map(([a,b],i)=>({id:'w'+i,a,b,kind:'wire',points:[]}))}]};
}
const calc=(n,c=n.circuits[0])=>Core.calculate(c,n.resolved),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,a+' != '+b);
let tested=0;
for(const[key,{product:p}]of catalog)if(p.symbol==='power-supply')for(const legacy of [false,true]){
  const d=fixture(product(key,'psu',legacy)),before=structuredClone(d),n=Net.analyse(d,lookup),c=n.circuits[0];
  assert.equal(n.circuits.length,1,key);assert.equal(c.id,'@psu:psu');assert.equal(c.automaticSource,true);assert.equal(c.voltage,24);assert.equal(c.ratingA,undefined);assert.equal(n.states.get('io').circuit.id,c.id);assert.equal(n.states.get('lamp').circuit.id,c.id);assert.deepEqual(c.sourcePins,[3,4]);
  near(calc(n).powerW,16.8);near(calc(n).currentA,.7);near(calc(n).requiredA,.84);assert.equal(n.resolved.length,2);assert.deepEqual(d,before);Core.validateDocument(d);tested++;
}
// The generic template aliases duplicate DC rails, never AC or DC OK contacts.
let d=fixture({id:'psu',type:'power-supply'}),n=Net.analyse(d,lookup);assert.equal(n.circuits.length,1);near(calc(n).powerW,16.8);assert.equal(n.circuits[0].voltageDefaulted,true);
d.sheets[0].wires[0].a='psu:7';assert.notEqual(Net.analyse(d,lookup).states.get('io').status,'connected');d.sheets[0].wires[0].a='psu:0';assert.notEqual(Net.analyse(d,lookup).states.get('io').status,'connected');
d=fixture({id:'psu',type:'power-supply',pinNumbers:['L','N','PE','+','−']});d.sheets[0].wires[0].a='psu:3';d.sheets[0].wires[1].a='psu:4';near(calc(Net.analyse(d,lookup)).powerW,16.8);
// A connected product with no consumption is detected, never counted as 0 W.
d=fixture();delete d.sheets[0].parts[1].loadCalculation;n=Net.analyse(d,lookup);assert.equal(n.states.get('io').status,'connected');assert.match(n.issues.find(i=>i.state.entry.p.id==='io').message,/input power\/current is missing/);assert.equal(n.resolved.length,1);near(calc(n).powerW,12);
// Explicit voltage/output mappings take precedence and do not create duplicates.
d=fixture();d.projectInfo.electricalCalculations={version:1,circuits:[{id:'configured',name:'Configured output',system:'dc',voltage:12,reservePct:10,ratingA:2,sourcePartId:'psu',sourcePins:[3,4]}]};n=Net.analyse(d,lookup);assert.equal(n.circuits.length,1);assert.equal(n.circuits[0].id,'configured');near(calc(n).currentA,1.4);
d.projectInfo.electricalCalculations.circuits[0].sourcePins=[5,6];near(calc(Net.analyse(d,lookup)).powerW,16.8);d.projectInfo.electricalCalculations.circuits[0].sourcePins=[0,1];n=Net.analyse(d,lookup);assert.notEqual(n.states.get('lamp').status,'connected');
// Generic sources and product sources remain electrically isolated from their
// upstream input load. DC output demand is not guessed as AC input consumption.
d=fixture();d.projectInfo.electricalCalculations={version:1,circuits:[{id:'ac',name:'AC input',system:'ac1',voltage:230,reservePct:20,sourcePartId:'incoming'}]};d.sheets[0].parts.unshift({id:'incoming',type:'supply',supplySystem:'ac1',pinNumbers:['L','N','PE']});d.sheets[0].parts.find(p=>p.id==='psu').loadCalculation=load(20);d.sheets[0].wires.push({id:'ac1',a:'incoming:0',b:'psu:0'},{id:'ac2',a:'incoming:1',b:'psu:1'});n=Net.analyse(d,lookup);assert.equal(n.circuits.length,2);assert.equal(n.states.get('psu').circuit.id,'ac');near(calc(n,n.circuits.find(c=>c.id==='ac')).powerW,20);near(calc(n,n.circuits.find(c=>c.sourcePartId==='psu')).powerW,16.8);
// Two supplies sharing only return remain separate; parallel positive outputs
// cause a visible conflict instead of a plausible but wrong load assignment.
d=fixture();const second=product('phoenix-contact:trio-24dc-5','second');d.sheets[0].parts.push(second);d.sheets[0].wires.push({id:'return',a:'psu:4',b:'second:4'});d.sheets[0].wires[0].a='second:3';n=Net.analyse(d,lookup);assert.equal(n.states.get('io').circuit.sourcePartId,'second');assert.equal(n.states.get('lamp').circuit.sourcePartId,'psu');d.sheets[0].wires.push({id:'parallel',a:'psu:3',b:'second:3'});n=Net.analyse(d,lookup);assert.equal(n.states.get('io').status,'conflict');assert.ok(n.sourceErrors.get('@psu:psu').length);
// Open/fiber returns and unplaced devices cannot complete a copper circuit.
d=fixture();d.sheets[0].wires[1].kind='fiber';assert.notEqual(Net.analyse(d,lookup).states.get('io').status,'connected');d.sheets[0].wires[1].kind='wire';d.sheets[0].parts[0].unplaced=true;n=Net.analyse(d,lookup);assert.equal(n.circuits.length,1);assert.equal(n.resolved.length,0);delete d.sheets[0].parts[0].unplaced;near(calc(Net.analyse(JSON.parse(JSON.stringify(d)),lookup)).powerW,16.8);
// Unknown/ambiguous product ports need an explicit mapping, never positional
// assumptions. Renaming one documented pole invalidates its automatic model.
d=fixture();delete d.sheets[0].parts[0].catalog.attributes.loadModel;d.sheets[0].parts[0].catalog.productId='unknown';assert.equal(Net.analyse(d,lookup).circuits.length,0);
d=fixture();d.sheets[0].parts[0].pinNumbers[3]='custom output';assert.equal(Net.analyse(d,lookup).circuits.length,0);
d=fixture({id:'psu',type:'power-supply',pinNumbers:['L','N','PE','+','+']});assert.equal(Net.analyse(d,lookup).circuits.length,0);
// Removal is a persisted opt-out; explicit configured circuits still win.
d=fixture();d.projectInfo.electricalCalculations={version:1,circuits:[],disabledSourcePartIds:['psu']};assert.equal(Net.analyse(d,lookup).circuits.length,0);Core.validateDocument(d);delete d.projectInfo.electricalCalculations.disabledSourcePartIds;assert.equal(Net.analyse(d,lookup).circuits[0].id,'@psu:psu');
for(const bad of [null,'psu',['psu','psu'],[''],[42]]){const invalid=structuredClone(d);invalid.projectInfo.electricalCalculations.disabledSourcePartIds=bad;assert.throws(()=>Core.validateDocument(invalid),/disabled automatic supplies/);}
// Cloud edits to names/models/nominal output voltage and concurrent circuit
// settings need the same explicit review as other cross-sheet electrical edits.
for(const change of [p=>p.pinNumbers[3]='renamed',p=>p.catalog.attributes.loadModel.groups=[],p=>p.catalog.attributes.outputVoltageV=12]){
  const base=fixture(),local=structuredClone(base),remote=structuredClone(base);local.projectInfo.electricalCalculations={version:1,circuits:[{...Net.powerSupplyCircuit(base.sheets[0].parts[0],lookup),ratingA:2}]};change(remote.sheets[0].parts[0]);assert.ok(Cloud.merge(base,local,remote).conflicts.some(c=>c.key==='document'));
}
console.log('PASS '+tested+' product PSU output scenarios plus generic/legacy rails, automatic Beckhoff/lamp loads, missing input, explicit overrides, AC/DC isolation, two-source conflicts, fiber/open/unplaced exclusion, persisted opt-out, JSON and cloud supply/model races');
