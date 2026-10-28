const assert=require('node:assert/strict'),Core=require('../scripts/electrical-core.js'),Demand=require('../scripts/electrical-demand.js'),Cloud=require('../scripts/cloud-core.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,a+' != '+b),clone=structuredClone;
const lc=(value,factor=1)=>({assignment:'automatic',circuitId:'@auto',phase:'auto',input:'power',...(value===undefined?{}:{value}),demandFactor:factor,powerFactor:.8,reactive:'lagging'});
function fixture(){return{title:'Converter input',projectInfo:{electricalCalculations:{version:1,circuits:[{id:'ac',name:'Incoming',sourcePartId:'incoming',system:'ac1',voltage:230,reservePct:20,ratingA:10}]}},sheets:[{id:'s',parts:[
  {id:'incoming',type:'supply',supplySystem:'ac1',pinNumbers:['L','N','PE']},
  {id:'psu',type:'power-supply',deviceCode:'G1',loadCalculation:lc(),powerConversion:{mode:'automatic',efficiencyPct:90,fixedLossW:.6}},
  {id:'io',type:'io-module',loadCalculation:lc(4.8,.5)},
  {id:'lamp',type:'lamp',loadCalculation:lc(12,.25)}
],wires:[['incoming:0','psu:0'],['incoming:1','psu:1'],['psu:5','io:0'],['psu:6','io:1'],['psu:3','lamp:0'],['psu:4','lamp:1']].map(([a,b],i)=>({id:'w'+i,a,b,kind:'wire'}))}]};}
let d=fixture(),before=clone(d),n=Demand.analyse(d),p=n.converters.get('psu'),ac=n.results.get('ac'),dc=n.results.get('@psu:psu');
Core.validateDocument(d);assert.equal(p.complete,true);near(p.outputInstalledW,16.8);near(p.outputDemandW,5.4);near(p.installedInputW,16.8/.9+.6);near(p.demandInputW,6.6);near(ac.powerW,16.8/.9+.6);near(ac.demandW,6.6);near(ac.currentA,6.6/(230*.8));near(ac.requiredA,6.6/(230*.8)*1.2);assert.equal(ac.complete,true);assert.equal(ac.rows.length,1);assert.equal(ac.rows[0].entry.derivedPower,true);near(dc.demandW,5.4);assert.deepEqual(d,before);
// Downstream reserves size that circuit; they are not extra consumption.
d.projectInfo.electricalCalculations.circuits.push({id:'out',name:'Output',sourcePartId:'psu',system:'dc',voltage:24,reservePct:75,ratingA:10});n=Demand.analyse(d);near(n.converters.get('psu').demandInputW,6.6);near(n.results.get('ac').requiredW,6.6*1.2);near(n.results.get('out').requiredW,5.4*1.75);
// Current-based consumers use the actual output voltage, including after edits.
d=fixture();d.sheets[0].parts[3].loadCalculation={...lc(.5,.25),input:'current'};n=Demand.analyse(d);near(n.converters.get('psu').demandInputW,6.6);d.projectInfo.electricalCalculations.circuits.push({id:'out',name:'Output',sourcePartId:'psu',system:'dc',voltage:12,reservePct:20});n=Demand.analyse(d);near(n.converters.get('psu').demandInputW,(2.4+1.5)/.9+.6);
// Unknown consumption, missing return and a missing efficiency stay incomplete.
for(const change of [d=>delete d.sheets[0].parts[3].loadCalculation.value,d=>d.sheets[0].wires.pop(),d=>delete d.sheets[0].parts[1].powerConversion.efficiencyPct]){
  d=fixture();change(d);n=Demand.analyse(d);assert.equal(n.converters.get('psu').complete,false);assert.equal(n.converters.get('psu').demandInputW,undefined);assert.equal(n.results.get('ac').complete,false);assert.equal(n.results.get('ac').marginA,null);assert.equal(n.results.get('ac').rows.length,0);
}
// An explicitly entered zero still counts; exclusion intentionally removes it.
d=fixture();for(const p of d.sheets[0].parts.slice(2))p.loadCalculation.value=0;n=Demand.analyse(d);near(n.converters.get('psu').demandInputW,.6);assert.equal(n.results.get('ac').complete,true);
d=fixture();d.sheets[0].parts[3].loadExcluded=true;n=Demand.analyse(d);near(n.converters.get('psu').demandInputW,2.4/.9+.6);d.sheets[0].parts[1].loadExcluded=true;n=Demand.analyse(d);assert.equal(n.results.get('ac').rows.length,0);assert.ok(!n.issues.some(i=>i.state.entry.p.id==='psu'));
// Existing numeric entries remain manual until automatic mode is selected.
d=fixture();delete d.sheets[0].parts[1].powerConversion;d.sheets[0].parts[1].loadCalculation=lc(25,.4);n=Demand.analyse(d);assert.equal(n.converters.has('psu'),false);near(n.results.get('ac').powerW,25);near(n.results.get('ac').demandW,10);
d.sheets[0].parts[1].powerConversion={mode:'automatic',efficiencyPct:100};n=Demand.analyse(d);near(n.results.get('ac').demandW,5.4);assert.equal(d.sheets[0].parts[1].loadCalculation.value,25);
// Explicit upstream assignment remains independent of automatic watt calculation.
d=fixture();d.sheets[0].wires=d.sheets[0].wires.slice(2);d.sheets[0].parts[1].loadCalculation={...lc(),assignment:'manual',circuitId:'ac',phase:'single'};Core.validateDocument(d);n=Demand.analyse(d);near(n.results.get('ac').demandW,6.6);
// The real-power calculation remains available if AC PF is missing, but no
// complete AC current/capacity result may be shown until PF is configured.
d=fixture();delete d.sheets[0].parts[1].loadCalculation.powerFactor;n=Demand.analyse(d);assert.equal(n.converters.get('psu').complete,true);assert.equal(n.results.get('ac').complete,false);assert.equal(n.results.get('ac').marginA,null);
// A single-phase converter on an AC3 source contributes to its actual phase.
d=fixture();Object.assign(d.sheets[0].parts[0],{supplySystem:'ac3',pinNumbers:['L1','L2','L3','N','PE']});Object.assign(d.projectInfo.electricalCalculations.circuits[0],{system:'ac3',voltage:400});d.sheets[0].wires[0].a='incoming:1';d.sheets[0].wires[1].a='incoming:3';n=Demand.analyse(d);near(n.results.get('ac').phases[0].currentA,0);near(n.results.get('ac').phases[1].currentA,6.6/(400/Math.sqrt(3)*.8));near(n.results.get('ac').phases[2].currentA,0);
// Cascaded logical DC converters retain separate installed/demand sums and
// fixed losses. This tests the demand model, not hardware voltage compatibility.
d=fixture();const a=d.sheets[0].parts[1];a.powerConversion={mode:'automatic',efficiencyPct:90,fixedLossW:2};d.sheets[0].parts=[d.sheets[0].parts[0],a,{id:'b',type:'power-supply',pinNumbers:['VIN','GND','PE','+','−'],loadCalculation:{...lc(),powerPins:[0,1]},powerConversion:{mode:'automatic',efficiencyPct:80,fixedLossW:1}},{id:'load',type:'lamp',loadCalculation:{...lc(.5,.5),input:'current'}},{id:'direct',type:'lamp',loadCalculation:lc(12,.25)}];d.projectInfo.electricalCalculations.circuits.push({id:'b-out',name:'12 V',sourcePartId:'b',sourcePins:[3,4],system:'dc',voltage:12,reservePct:50});d.sheets[0].wires=[['incoming:0','psu:0'],['incoming:1','psu:1'],['psu:3','b:0'],['psu:4','b:1'],['b:3','load:0'],['b:4','load:1'],['psu:5','direct:0'],['psu:6','direct:1']].map(([a,b],i)=>({id:'w'+i,a,b}));n=Demand.analyse(d);near(n.converters.get('b').installedInputW,8.5);near(n.converters.get('b').demandInputW,4.75);near(n.converters.get('psu').installedInputW,20.5/.9+2);near(n.results.get('ac').demandW,7.75/.9+2);assert.equal(n.resolved.filter(e=>e.p.id==='b').length,1);assert.equal(n.resolved.filter(e=>e.p.id==='psu').length,1);
// A converter-dependency loop must terminate with an explicit incomplete result.
d.sheets[0].wires=d.sheets[0].wires.filter(w=>!w.a.startsWith('incoming:'));d.sheets[0].wires.push({id:'cycle1',a:'b:3',b:'psu:0'},{id:'cycle2',a:'b:4',b:'psu:1'});n=Demand.analyse(d);assert.equal(n.converters.get('psu').complete,false);assert.equal(n.converters.get('b').complete,false);assert.match(n.converters.get('psu').errors.join(' '),/dependency cycle/);assert.equal(n.results.get('@psu:psu').complete,false);
// Disabled output detection, JSON, strict parameter validation and cloud races.
d=fixture();d.projectInfo.electricalCalculations.disabledSourcePartIds=['psu'];n=Demand.analyse(d);assert.equal(n.converters.get('psu').complete,false);assert.equal(n.results.get('ac').complete,false);
d=fixture();assert.deepEqual(Demand.analyse(JSON.parse(JSON.stringify(d))).converters.get('psu'),Demand.analyse(d).converters.get('psu'));
for(const bad of [null,{mode:'other'},{mode:'automatic',efficiencyPct:0},{mode:'automatic',efficiencyPct:101},{mode:'automatic',efficiencyPct:'90'},{mode:'automatic',fixedLossW:-1}]){const invalid=clone(d);invalid.sheets[0].parts[1].powerConversion=bad;assert.throws(()=>Core.validateDocument(invalid));}
const invalid=clone(d);invalid.sheets[0].parts[2].powerConversion={mode:'automatic'};assert.throws(()=>Core.validateDocument(invalid),/input calculation mode/);
const local=clone(d),remote=clone(d);local.projectInfo.electricalCalculations.circuits[0].voltage=240;remote.sheets[0].parts[1].powerConversion.efficiencyPct=95;assert.ok(Cloud.merge(d,local,remote).conflicts.some(c=>c.key==='document'));
console.log('PASS converter installed/demand input W, efficiency/fixed loss, no compounded reserve or duplicate loads, output currents/voltage, unknowns/exclusion, legacy/manual overrides, AC power factor and phase, cascading/cycles, JSON and cloud parameter races');
