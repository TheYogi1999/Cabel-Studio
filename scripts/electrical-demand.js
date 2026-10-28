/* Derived converter demand. Saved load values and source definitions stay intact. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./electrical-core.js'),require('./electrical-network.js')):factory(root.CabelElectricalCore,root.CabelElectricalNetwork);if(typeof module==='object'&&module.exports)module.exports=api;else root.CabelElectricalDemand=api;})(globalThis,(Core,Net)=>{
  'use strict';
  function analyse(doc,lookup){
    const n=Net.analyse(doc,lookup),automatic=[...n.byId.values()].filter(e=>Core.conversionMode(e.p)==='automatic'),autoIds=new Set(automatic.map(e=>e.p.id)),converters=new Map(),results=new Map(),visiting=new Set();
    const resolved=n.resolved.filter(e=>!autoIds.has(e.p.id)),issues=n.issues.filter(i=>!autoIds.has(i.state.entry.p.id)||i.message!=='Detected load; electrical input power/current is missing');
    const binding=e=>{const s=n.states.get(e.p.id),l=e.p.loadCalculation;if(e.p.loadExcluded||s?.excluded)return null;if(l?.assignment==='manual')return{id:l.circuitId,phase:l.phase};return s?.status==='connected'?{id:s.circuit.id,phase:s.phase}:null;};
    function circuit(c){
      if(results.has(c.id))return results.get(c.id);
      if(visiting.has(c.id))return{...Core.calculate(c,[]),complete:false,errors:['Power-supply dependency cycle; input demand cannot be calculated'],marginA:null,overloaded:null};
      visiting.add(c.id);
      for(const e of automatic)if(binding(e)?.id===c.id)converter(e);
      const r=Core.calculate(c,resolved),problems=[...(n.sourceErrors.get(c.id)||[]),...issues.filter(i=>i.circuitIds.includes(c.id)).map(i=>(i.state.entry.p.deviceCode||i.state.entry.p.id)+': '+i.message)];
      r.errors.push(...new Set(problems));r.complete=r.complete&&!r.errors.length;if(!r.complete){r.marginA=null;r.overloaded=null;}visiting.delete(c.id);results.set(c.id,r);return r;
    }
    function converter(e){
      if(converters.has(e.p.id))return converters.get(e.p.id);
      const p=e.p,s=n.states.get(p.id),linked=n.circuits.filter(c=>c.sourcePartId===p.id),settings=p.powerConversion||{},errors=[];
      // Circuit recursion detects loops before any result can become a load.
      const output=linked.map(c=>circuit(c)),outputInstalledW=output.reduce((v,r)=>v+(r.powerW||0),0),outputDemandW=output.reduce((v,r)=>v+(r.demandW||0),0);
      if(converters.has(p.id))return converters.get(p.id);
      if(!linked.length)errors.push('Enable or configure the DC output supply to calculate input power');
      if(linked.some(c=>c.system!=='dc'))errors.push('Automatic input power requires DC output circuits');
      for(const r of output)if(!r.complete)errors.push(...(r.errors.length?r.errors:['No complete output loads configured']));
      try{Core.validateConversion(p);}catch(error){errors.push(error.message);}
      if(settings.efficiencyPct===undefined)errors.push('Enter the power-supply efficiency (%) to calculate input power');
      const value={mode:'automatic',complete:!errors.length,outputInstalledW,outputDemandW,efficiencyPct:settings.efficiencyPct,fixedLossW:settings.fixedLossW??0,outputCircuitIds:linked.map(c=>c.id),errors:[...new Set(errors)]};
      if(value.complete){
        value.installedInputW=outputInstalledW/(value.efficiencyPct/100)+value.fixedLossW;
        value.demandInputW=outputDemandW/(value.efficiencyPct/100)+value.fixedLossW;
        if(!Number.isFinite(value.installedInputW)||value.installedInputW>1e9){value.complete=false;value.errors.push('Calculated input power exceeds the supported range');delete value.installedInputW;delete value.demandInputW;}
      }
      converters.set(p.id,value);if(s)s.inputCalculation=value;
      const target=binding(e);
      if(value.complete&&target){
        const l={...(p.loadCalculation||{}),assignment:p.loadCalculation?.assignment==='manual'?'manual':'automatic',circuitId:target.id,phase:target.phase,input:'power',value:value.installedInputW,demandFactor:value.installedInputW?value.demandInputW/value.installedInputW:1};
        resolved.push({...e,p:{...p,loadCalculation:l},automatic:l.assignment!=='manual',derivedPower:true,inputCalculation:value});if(s)s.effectiveLoadData=l;
      }else if(!value.complete&&s&&!p.loadExcluded&&!s.excluded){
        issues.push({state:s,circuitIds:target?[target.id]:s.related,message:'Power-supply input incomplete: '+value.errors.join('; ')});
      }
      return value;
    }
    for(const e of automatic)converter(e);
    for(const c of n.circuits)circuit(c);
    return{...n,resolved,issues,converters,results};
  }
  return{analyse};
});
