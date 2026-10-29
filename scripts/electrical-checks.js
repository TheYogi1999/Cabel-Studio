/* Continuous-load and DC-polarity checks on the schematic copper graph. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./electrical-core.js'),require('./electrical-network.js'),require('./electrical-demand.js')):factory(root.CabelElectricalCore,root.CabelElectricalNetwork,root.CabelElectricalDemand);if(typeof module==='object'&&module.exports)module.exports=api;else root.CabelElectricalChecks=api;})(globalThis,(Core,Net,Demand)=>{
  'use strict';
  const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0,live=role=>['+','−','L','L1','L2','L3'].includes(role),unique=items=>[...new Set(items)];
  function ratings(p,lookup){
    const a={...(lookup?.(p)||{}),...(p.catalog?.attributes||{})},manual=p.electricalLimits||{};
    const current=manual.currentA??(p.type==='power-supply'?a.outputCurrentA:a.ratedCurrentA),power=manual.powerW??a.outputPowerW;
    return{currentA:positive(current)?current:undefined,powerW:p.type==='power-supply'&&positive(power)?power:undefined,basis:manual.currentA!==undefined||manual.powerW!==undefined?'Entered device rating':'Structured catalogue reference; verify selected variant'};
  }
  function analyse(doc,lookup,attributeLookup){
    const n=Demand.analyse(doc,lookup),t=n.topology,checks=[],polarities=new Map();
    const at=(e,i)=>t.at(e,i),id=e=>e.p.deviceCode||e.p.label||e.p.id;
    for(const e of n.byId.values()){
      const p=e.p;if(p.unplaced||['text','image','reference','destination','terminal-pin','terminal-strip','connector','supply'].includes(p.type)||/^mcb-/.test(p.type))continue;
      if(!Net.candidate(p,lookup)&&!p.dcPolarity)continue;
      const groups=Net.inputGroups(p,lookup),pairs=Net.polarityPairs(p,lookup),related=unique((groups.length?groups.flat():Array.from({length:Net.ports(p)},(_,i)=>i)).flatMap(i=>at(e,i).filter(v=>v.c.system==='dc').map(v=>v.c.id)));
      if(!pairs.length&&!related.length)continue;
      const outcomes=pairs.map(([a,b])=>{
        const plus=at(e,a).filter(v=>v.c.system==='dc'),minus=at(e,b).filter(v=>v.c.system==='dc'),circuits=unique([...plus,...minus].map(v=>v.c.id));
        if(plus.some(v=>v.role==='−')||minus.some(v=>v.role==='+'))return{status:'reversed',message:'Reverse DC polarity: positive terminal must connect to + and negative terminal to −',circuitIds:circuits};
        if(plus.some(v=>v.role==='+'&&minus.some(q=>q.c.id===v.c.id&&q.role==='−'))&&circuits.every(c=>!n.sourceErrors.get(c)?.length))return{status:'ok',message:'DC positive and negative inputs match the source poles',circuitIds:circuits};
        return{status:'incomplete',message:'DC polarity incomplete: connect both inputs to the same DC source',circuitIds:circuits};
      });
      const selected=outcomes.find(v=>v.status==='reversed')||outcomes.find(v=>v.status==='ok')||outcomes.find(v=>v.circuitIds.length)||outcomes[0]||{status:p.dcPolarity?.mode==='none'||!p.catalog&&['resistor','capacitor','lamp'].includes(p.type)?'not-applicable':'unknown',message:p.dcPolarity?.mode==='none'?'Declared non-polarized device':!p.catalog&&['resistor','capacitor','lamp'].includes(p.type)?'Non-polarized generic symbol':'DC polarity unknown: define the positive and negative input terminals',circuitIds:related};
      const row={kind:'polarity',entry:e,...selected,pairs};polarities.set(p.id,row);checks.push(row);
      if(row.status==='reversed')for(const c of row.circuitIds){const r=n.results.get(c);if(r){r.errors.push(id(e)+': '+row.message);r.complete=false;r.marginA=null;r.overloaded=null;}}
    }
    const invalidate=(ids,message)=>{for(const cid of ids){const r=n.results.get(cid);if(r){if(!r.errors.includes(message))r.errors.push(message);r.complete=false;r.marginA=null;r.overloaded=null;}}};
    for(const state of n.states.values()){
      if(state.aliasOf)continue;
      if(state.excluded)invalidate(state.related,id(state.entry)+': connected load excluded from totals');
      const l=state.entry.p.loadCalculation;if(l?.assignment==='manual'&&state.status==='connected'&&l.phase!==state.phase)invalidate(unique([l.circuitId,state.circuit.id]),id(state.entry)+': manual phase differs from wired phase');
    }
    // A converter fed by an invalid output circuit cannot make upstream totals complete.
    for(let pass=0;pass<n.circuits.length;pass++)for(const [part,value]of n.converters){
      if(!value.complete||value.outputCircuitIds.every(c=>n.results.get(c)?.complete))continue;
      value.complete=false;value.errors.push('Output wiring / DC polarity check failed');
      const binding=n.resolved.find(e=>e.p.id===part)?.p.loadCalculation?.circuitId,r=n.results.get(binding);
      if(r){r.errors.push(part+': output wiring / DC polarity check failed');r.complete=false;r.marginA=null;r.overloaded=null;}
    }
    for(const c of n.circuits){
      const e=n.byId.get(c.sourcePartId),r=n.results.get(c.id);if(!e)continue;
      const limits=ratings(e.p,attributeLookup),currents=[c.ratingA,limits.currentA,...(c.system==='dc'&&limits.powerW!==undefined?[limits.powerW/c.voltage]:[])].filter(positive),currentA=currents.length?Math.min(...currents):undefined,powerW=limits.powerW;
      const errors=[...r.errors];if(e.p.type==='power-supply'&&c.system!=='dc')errors.push('DC output ratings cannot verify an AC output circuit');if(e.p.unplaced)errors.push('Source is unplaced');
      if(n.circuits.filter(q=>q.sourcePartId===e.p.id).length>1)errors.push('Multiple circuits share this source: per-output limits need review');
      if([...n.states.values()].some(s=>!s.aliasOf&&s.related.includes(c.id)&&s.excluded))errors.push('Connected loads are excluded from totals');
      const overloaded=currentA!==undefined&&r.currentA>currentA+1e-9||powerW!==undefined&&r.demandW>powerW+1e-9,reserve=currentA!==undefined&&r.requiredA>currentA+1e-9||powerW!==undefined&&r.requiredW>powerW+1e-9;
      const status=!r.complete||errors.length?'incomplete':overloaded?'overload':currentA===undefined&&powerW===undefined?'unknown':reserve?'reserve':'ok';
      r.effectiveRatingA=currentA;if(r.complete&&!errors.length&&currentA!==undefined){r.marginA=currentA-r.requiredA;r.overloaded=r.marginA< -1e-9;}else if(errors.length){r.marginA=null;r.overloaded=null;}
      checks.push({kind:'supply',entry:e,circuitIds:[c.id],status,currentA:r.rows.length?r.currentA:undefined,requiredA:r.rows.length?r.requiredA:undefined,powerW:r.rows.length?r.demandW:undefined,requiredW:r.rows.length?r.requiredW:undefined,ratingA:currentA,ratingW:powerW,errors:unique(errors),message:status==='overload'?'Supply overloaded':status==='reserve'?'Demand fits; reserve exceeds supply rating':status==='ok'?'Supply demand and reserve fit the known rating':status==='unknown'?'Enter the continuous output current or power rating':'Supply capacity check incomplete',basis:limits.basis});
    }
    function walk(start,blocked){const seen=new Set([start]),queue=[start];for(let i=0;i<queue.length;i++)for(const edge of t.adjacency.get(queue[i])||[])if(edge.deviceId!==blocked&&!seen.has(edge.to)){seen.add(edge.to);queue.push(edge.to);}return seen;}
    for(const e of n.byId.values()){
      const p=e.p;if(p.unplaced||!/^mcb-[1-4]p$/.test(p.type))continue;
      const rating=ratings(p,attributeLookup),poleCount=Number(p.type[4]),poles=[],errors=[],circuitIds=new Set(),paths=Net.paths(p,lookup),cache=new Map();
      if(paths.length!==poleCount||paths.some(([a,b])=>Math.floor(a/2)!==Math.floor(b/2)||Math.abs(a-b)!==1))errors.push('MCB conduction model is open or does not match its poles');
      for(let pole=0;pole<poleCount;pole++){
        const a=pole*2,b=a+1,tags=[...at(e,a),...at(e,b)],sources=[...new Map(tags.filter(v=>live(v.role)).map(v=>[v.c.id+':'+v.role,v])).values()];
        if(!sources.length){if(!tags.some(v=>v.role==='N'))errors.push('Pole '+(pole+1)+': no sourced live / DC pole');continue;}
        if(sources.length!==1){errors.push('Pole '+(pole+1)+': conflicting sources');continue;}
        const {c,role}=sources[0];circuitIds.add(c.id);if(n.sourceErrors.get(c.id)?.length){errors.push(...n.sourceErrors.get(c.id));continue;}
        const seed=t.seeds.find(s=>s.c.id===c.id&&s.role===role);if(!seed){errors.push('Source output mapping missing');continue;}
        const source=n.byId.get(c.sourcePartId),sourcePins=c.sourcePins||Net.sourcePins(source.p,c.system,lookup),roles=c.system==='dc'?['+','−']:c.system==='ac3'?['L1','L2','L3','N']:['L','N'],start=t.partKey(source,sourcePins[roles.indexOf(role)]),key=c.id+':'+role;
        if(!cache.has(key))cache.set(key,walk(start,p.id));const upstream=cache.get(key),left=upstream.has(t.partKey(e,a)),right=upstream.has(t.partKey(e,b));
        if(left&&right){errors.push('Pole '+(pole+1)+': MCB is bypassed by another conductive path');continue;}
        if(!left&&!right){errors.push('Pole '+(pole+1)+': source side cannot be determined');continue;}
        const downstream=walk(t.partKey(e,left?b:a),p.id),selected=[],seen=new Set(),localErrors=[];
        for(const state of n.states.values()){
          if(state.aliasOf||seen.has(state.physicalId))continue;seen.add(state.physicalId);
          const pins=state.pins||[],onPole=pins.some(i=>downstream.has(t.partKey(state.entry,i))&&at(state.entry,i).some(v=>v.c.id===c.id&&v.role===role));if(!onPole)continue;
          const resolved=n.resolved.find(q=>q.p.id===state.physicalId),polarity=polarities.get(state.physicalId);
          if(state.excluded||!resolved||state.status!=='connected'||resolved.p.loadCalculation.circuitId!==c.id||resolved.p.loadCalculation.phase!==state.phase||polarity?.status==='reversed'){localErrors.push(id(state.entry)+': '+(state.excluded?'excluded load':polarity?.status==='reversed'?'reverse DC polarity':'incomplete wiring or load value / conflicting manual assignment'));continue;}
          selected.push(resolved);
        }
        const r=Core.calculate(c,selected),index=c.system==='ac3'?['L1','L2','L3'].indexOf(role):0,phase=r.phases[index];localErrors.push(...r.errors);
        if(!r.rows.length)localErrors.push('No complete downstream loads configured');
        const item={pole:pole+1,role,circuitId:c.id,currentA:r.rows.length?phase?.currentA:undefined,requiredA:r.rows.length?phase?.requiredA:undefined,loadIds:selected.map(q=>q.p.id),errors:unique(localErrors)};poles.push(item);errors.push(...item.errors.map(message=>'Pole '+(pole+1)+': '+message));
      }
      const known=poles.filter(v=>Number.isFinite(v.currentA)),currentA=known.length?Math.max(...known.map(v=>v.currentA)):undefined,requiredA=known.length?Math.max(...known.map(v=>v.requiredA)):undefined,overloaded=rating.currentA!==undefined&&currentA>rating.currentA+1e-9,reserve=rating.currentA!==undefined&&requiredA>rating.currentA+1e-9;
      const status=errors.length||!poles.length?'incomplete':overloaded?'overload':rating.currentA===undefined?'unknown':reserve?'reserve':'ok';
      checks.push({kind:'mcb',entry:e,circuitIds:[...circuitIds],status,currentA,requiredA,ratingA:rating.currentA,poles,errors:unique(errors),message:status==='overload'?'MCB overloaded':status==='reserve'?'Demand fits; reserve exceeds MCB rating':status==='ok'?'MCB downstream demand and reserve fit the rating':status==='unknown'?'Enter the MCB rated current':'MCB capacity check incomplete',basis:rating.basis});
    }
    return{...n,checks,polarities};
  }
  return{analyse,ratings};
});
