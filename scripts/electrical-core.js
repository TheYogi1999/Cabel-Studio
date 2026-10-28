/* Explicit supply/load models. No electrical values are inferred from a symbol,
   catalogue description, pin name or geometric connection. Units: W, V, A, mΩ. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CabelElectricalCore=api;})(globalThis,()=>{
  'use strict';
  const Network=typeof module==='object'&&module.exports?require('./electrical-network.js'):globalThis.CabelElectricalNetwork;
  const systems={dc:'DC',ac1:'Single-phase AC',ac3:'Three-phase AC'};
  const supplyPins=system=>system==='ac3'?['L1','L2','L3','N','PE']:system==='ac1'?['L','N','PE']:['+','−','PE'];
  const present=v=>v!==undefined&&v!==null&&v!=='';
  function number(v,label,min=0,max=1e12){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(label+' must be between '+min+' and '+max);return v;}
  function text(v,label,max=200){if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Invalid '+label);return v;}
  function validateCircuit(c){
    if(!c||typeof c!=='object')throw Error('Invalid supply circuit');text(c.id,'circuit ID');if(c.id==='@auto')throw Error('Reserved circuit ID');text(c.name,'circuit name');if(!Object.hasOwn(systems,c.system))throw Error('Unknown supply system');
    number(c.voltage,'Supply voltage',1,c.system==='dc'?1500:1000);number(c.reservePct,'Reserve (%)',0,1000);if(present(c.ratingA))number(c.ratingA,'Supply rating (A)',.000001,1e6);
    if(present(c.sourcePartId))text(c.sourcePartId,'source device ID');
    if(c.sourcePins!==undefined&&(!Array.isArray(c.sourcePins)||c.sourcePins.length!==(c.system==='ac3'?4:2)||new Set(c.sourcePins).size!==c.sourcePins.length||c.sourcePins.some(i=>!Number.isInteger(i)||i<0||i>63)))throw Error('Choose distinct source output terminals');
    const f=c.fault;if(!f)return;
    if(!['off','impedance','limited'].includes(f.mode))throw Error('Unknown fault model');if(f.mode==='limited'&&c.system!=='dc')throw Error('The declared current-limit model is for DC supplies');
    for(const k of ['sourceR','sourceX','lineR','lineX'])if(present(f[k]))number(f[k],k+' (mΩ)',0,1e9);
    if(present(f.factor))number(f.factor,'Fault voltage multiplier',.1,2);if(present(f.limitA))number(f.limitA,'Declared short-circuit current (A)',.000001,1e6);
  }
  function validateLoad(l){
    if(!l||typeof l!=='object')throw Error('Invalid load calculation');text(l.circuitId,'load circuit ID');if(!['power','current'].includes(l.input))throw Error('Choose load input power or current');
    if(l.value!==undefined||l.assignment!=='automatic')number(l.value,l.input==='power'?'Input power (W)':'Load current (A)',0,l.input==='power'?1e9:1e6);if(l.assignment!==undefined&&!['automatic','manual'].includes(l.assignment))throw Error('Invalid load assignment mode');number(l.demandFactor,'Demand factor',0,1);
    if(!['auto','single','balanced','L1','L2','L3'].includes(l.phase))throw Error('Invalid load phase');
    if(present(l.powerFactor))number(l.powerFactor,'Power factor',.01,1);if(present(l.reactive)&&!['lagging','leading'].includes(l.reactive))throw Error('Choose lagging or leading power factor');
  }
  function circuits(doc){return doc.projectInfo?.electricalCalculations?.circuits||[];}
  function entries(doc){return doc.sheets.flatMap(sheet=>sheet.parts.filter(p=>p.loadCalculation).map(p=>({p,sheet})));}
  function validateDocument(doc){
    const settings=doc.projectInfo?.electricalCalculations;if(settings!==undefined&&(!settings||typeof settings!=='object'||settings.version!==1||!Array.isArray(settings.circuits)))throw Error('Invalid electrical calculation settings');
    if(settings?.disabledSourcePartIds!==undefined){const list=settings.disabledSourcePartIds;if(!Array.isArray(list)||new Set(list).size!==list.length||list.some(id=>typeof id!=='string'||!id.trim()||id.length>200))throw Error('Invalid disabled automatic supplies');}
    const ids=new Set();for(const c of circuits(doc)){validateCircuit(c);if(ids.has(c.id))throw Error('Duplicate supply circuit ID');ids.add(c.id);}
    for(const sheet of doc.sheets)for(const p of sheet.parts)Network.validatePart(p);
    for(const sheet of doc.sheets)for(const p of sheet.parts)if(p.type==='supply'){if(!Object.hasOwn(systems,p.supplySystem)||!Array.isArray(p.pinNumbers)||p.pinNumbers.length!==supplyPins(p.supplySystem).length||p.portKinds?.some(k=>k!=='wire'))throw Error('Invalid Supply symbol or electrical ports');}
    for(const {p} of entries(doc)){validateLoad(p.loadCalculation);if(['text','image','reference','destination','terminal-pin'].includes(p.type))throw Error('Only devices may have load calculations');}
    return doc;
  }
  function fault(c){
    const f=c.fault;if(!f||f.mode==='off')return{status:'off',label:'Not configured',notes:'Enter source and feeder data to calculate a fault scenario.'};
    try{
      validateCircuit(c);
      if(f.mode==='limited'){
        if(!present(f.limitA))throw Error('Enter the manufacturer’s sustained short-circuit current');
        return{status:'declared',amps:f.limitA,label:'Declared DC short-circuit current',formula:'Manufacturer value (entered)',notes:'Source-terminal value, not a calculated fault current at the load. Boost duration, foldback/hiccup and downstream voltage drop require the supply characteristic. No trip-time verification.'};
      }
      for(const k of ['sourceR','lineR',...(c.system==='dc'?[]:['sourceX','lineX','factor'])])if(!present(f[k]))throw Error('Missing '+k+(k==='factor'?'':' (mΩ)'));
      const r=(f.sourceR+f.lineR)/1000,x=c.system==='dc'?0:(f.sourceX+f.lineX)/1000,z=Math.hypot(r,x);if(!(z>0))throw Error('Total fault impedance must be greater than zero');
      const factor=c.system==='dc'?1:f.factor,amps=factor*c.voltage/(c.system==='ac3'?Math.sqrt(3):1)/z;
      return{status:'calculated',amps,r,x,z,label:c.system==='ac3'?'Estimated three-phase bolted fault current':c.system==='ac1'?'Estimated L–N bolted fault current':'Estimated resistive DC fault current',formula:c.system==='ac3'?'I = c × U(L–L) / (√3 × |Z|)':c.system==='ac1'?'I = c × U(L–N) / |Z(loop)|':'I = U / R(loop)',notes:c.system==='dc'?'Resistive DC / Thevenin source only; not valid for current-limited electronic power supplies. Steady-state estimate; no transient or trip-time verification.':'One radial equivalent source with entered R/X; no automatic motor, generator or inverter contribution. This scenario is not an IEC 60909 study, an earth-fault calculation or a protection/disconnection check.'};
    }catch(e){return{status:'incomplete',label:'Fault data incomplete',notes:e.message};}
  }
  function load(c,entry){
    const l=entry.p.loadCalculation;validateLoad(l);if(l.value===undefined)throw Error('Electrical input power/current is missing');
    if(c.system==='ac3'?!['balanced','L1','L2','L3'].includes(l.phase):l.phase!=='single')throw Error('Load connection does not match the supply system');
    if(c.system!=='dc'&&(!present(l.powerFactor)||!present(l.reactive)))throw Error('AC load needs a power factor and lagging/leading choice');
    const pf=c.system==='dc'?1:l.powerFactor,voltage=c.system==='ac3'?(l.phase==='balanced'?Math.sqrt(3)*c.voltage:c.voltage/Math.sqrt(3)):c.voltage;
    const apparentVA=l.input==='current'?l.value*voltage:l.value/pf,powerW=apparentVA*pf,reactiveVar=c.system==='dc'?0:Math.sqrt(Math.max(0,apparentVA**2-powerW**2))*(l.reactive==='leading'?-1:1);
    return{entry,powerW,reactiveVar,apparentVA,currentA:apparentVA/voltage,demandW:powerW*l.demandFactor,demandVar:reactiveVar*l.demandFactor,demandFactor:l.demandFactor,phase:l.phase};
  }
  function calculate(c,allEntries){
    const errors=[],rows=[],phases=Array.from({length:c.system==='ac3'?3:1},(_,i)=>({name:c.system==='ac3'?'L'+(i+1):c.system==='dc'?'DC':'L',p:0,q:0}));
    try{validateCircuit(c);}catch(e){return{c,errors:[e.message],rows,complete:false,fault:fault(c)};}
    for(const entry of allEntries.filter(e=>e.p.loadCalculation?.circuitId===c.id)){
      try{const row=load(c,entry);rows.push(row);const targets=c.system!=='ac3'?[0]:row.phase==='balanced'?[0,1,2]:[Number(row.phase.slice(1))-1];for(const i of targets){phases[i].p+=row.demandW/targets.length;phases[i].q+=row.demandVar/targets.length;}}
      catch(e){errors.push((entry.p.deviceCode||entry.p.label||entry.p.id)+': '+e.message);}
    }
    for(const p of phases){p.s=Math.hypot(p.p,p.q);p.currentA=p.s/(c.system==='ac3'?c.voltage/Math.sqrt(3):c.voltage);p.requiredA=p.currentA*(1+c.reservePct/100);}
    const sum=key=>rows.reduce((n,r)=>n+r[key],0),powerW=sum('powerW'),installedVA=sum('apparentVA'),demandW=sum('demandW'),demandVar=sum('demandVar'),demandVA=Math.hypot(demandW,demandVar),currentA=Math.max(...phases.map(p=>p.currentA)),requiredA=currentA*(1+c.reservePct/100);
    return{c,rows,errors,complete:!errors.length&&rows.length>0,phases,powerW,installedVA,demandW,demandVar,demandVA,currentA,requiredA,requiredW:demandW*(1+c.reservePct/100),marginA:present(c.ratingA)?c.ratingA-requiredA:null,overloaded:present(c.ratingA)?requiredA>c.ratingA:null,fault:fault(c)};
  }
  return{systems,supplyPins,present,validateCircuit,validateLoad,validateDocument,circuits,entries,fault,load,calculate};
});
