/* Logical copper nets. Geometry, equipment tags and cable/core labels do not
   connect nets. Internal paths describe the schematic, not verified hardware. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CabelElectricalNetwork=api;})(globalThis,()=>{
  'use strict';
  const AUTO='@auto',two=new Set(['resistor','capacitor','lamp','led','diode','motor','coil','relay-coil','trip-coil','motor-ac-1p','power-supply','io-module','controller-board','contactor-4p']);
  const defaults={'switch-changeover':3,'optocoupler':4,'contactor-4p':10,'auxiliary-contact':4,busbar:2,'motor-ac-3p':4,'motor-ac-6t':7,supply:3,relay:11,'relay-contact':3,'terminal-pin':1,reference:1,destination:1,connector:2,'power-supply':9,'io-module':10,'controller-board':8,'rcd-2p':4,'rcd-4p':8,'mcb-1p':2,'mcb-2p':4,'mcb-3p':6,'mcb-4p':8,'illuminated-pushbutton-no':4,'illuminated-pushbutton-nc':4};
  function ports(p){return p.type==='custom-symbol'?(p.symbolDefinition?.terminals?.length||0):p.pinNumbers?.length||(p.type==='supply'&&p.supplySystem==='ac3'?5:defaults[p.type]||(two.has(p.type)||['fuse','switch','switch-nc','pushbutton-no','pushbutton-nc','selector-switch','key-switch'].includes(p.type)?2:0));}
  const copper=(p,i)=>Number.isInteger(i)&&i>=0&&(i<ports(p)||p.type==='connector'&&i===8)&&p.portKinds?.[i]!=='fiber'&&p.type!=='fiber-device';
  function powerPins(p){
    if(p.loadCalculation?.powerPins)return p.loadCalculation.powerPins;
    if(p.catalog&&['controller-board','io-module'].includes(p.type))return null;
    if(two.has(p.type))return[0,1];if(p.type==='motor-ac-3p')return[0,1,2];if(String(p.type||'').startsWith('illuminated-pushbutton'))return[2,3];return null;
  }
  const candidate=p=>two.has(p.type)||['motor-ac-3p','motor-ac-6t'].includes(p.type)||String(p.type||'').startsWith('illuminated-pushbutton')||Boolean(p.loadCalculation);
  function paths(p){
    if(p.calculationLinks!==undefined)return p.calculationLinks;
    if(p.type==='connector'){
      const all=Array.from({length:ports(p)},(_,i)=>i),disconnect=p.catalog?.attributes?.terminalFunction==='disconnect'||/^Disconnect terminal$/i.test(p.terminalType||'')||[p.value,p.terminalType,p.catalog?.model].some(v=>/^ST\s+\d+(?:[,.]\d+)?-MT(?:$|[\s/-])/i.test(String(v||'').trim()));
      const connected=disconnect?[...all.slice(1),8]:[...all,8];return connected.slice(1).map(i=>[connected[0],i]);
    }
    if(['fuse','switch-nc','pushbutton-nc','illuminated-pushbutton-nc','busbar'].includes(p.type))return[[0,1]];
    if(/^mcb-[1-4]p$/.test(p.type)||/^rcd-[24]p$/.test(p.type))return Array.from({length:ports(p)/2},(_,i)=>[i*2,i*2+1]);
    return[];
  }
  function validatePart(p){
    if(p.loadExcluded!==undefined&&typeof p.loadExcluded!=='boolean')throw Error('Invalid load exclusion');
    if(p.calculationLinks!==undefined&&(!Array.isArray(p.calculationLinks)||p.calculationLinks.length>64||p.calculationLinks.some(pair=>!Array.isArray(pair)||pair.length!==2||pair[0]===pair[1]||pair.some(i=>!copper(p,i)))))throw Error('Invalid internal conductive paths');
    if(p.loadCalculation?.powerPins!==undefined&&(!Array.isArray(p.loadCalculation.powerPins)||![2,3].includes(p.loadCalculation.powerPins.length)||new Set(p.loadCalculation.powerPins).size!==p.loadCalculation.powerPins.length||p.loadCalculation.powerPins.some(i=>!copper(p,i))))throw Error('Choose two or three distinct copper power inputs');
  }
  function analyse(doc){
    const circuits=doc.projectInfo?.electricalCalculations?.circuits||[],entries=doc.sheets.flatMap(sheet=>sheet.parts.map(p=>({p,sheet}))),byId=new Map(entries.map(e=>[e.p.id,e])),parent=new Map(),connected=new Map(circuits.map(c=>[c.id,[]])),sourceErrors=new Map(circuits.map(c=>[c.id,[]]));
    const find=k=>{if(!parent.has(k))parent.set(k,k);let r=k;while(parent.get(r)!==r)r=parent.get(r);while(k!==r){const n=parent.get(k);parent.set(k,r);k=n;}return r;},join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent.set(a,b);},key=(sheet,ref)=>JSON.stringify([sheet.id,ref]);
    const partKey=(e,i)=>key(e.sheet,e.p.id+':'+i),valid=(sheet,ref)=>{
      if(typeof ref!=='string')return false;const [id,n]=ref.split(':'),i=Number(n);
      if(id.startsWith('@'))return i===0&&(sheet.junctions||[]).some(p=>'@'+p.id===id&&p.kind!=='fiber');
      if(id.startsWith('~'))return i===0&&(sheet.looseEnds||[]).some(p=>'~'+p.id===id&&p.kind!=='fiber');
      const e=byId.get(id);return e?.sheet===sheet&&(!e.p.unplaced||e.p.type==='connector')&&copper(e.p,i);
    };
    for(const sheet of doc.sheets)for(const w of sheet.wires)if(w.kind!=='fiber'&&valid(sheet,w.a)&&valid(sheet,w.b))join(key(sheet,w.a),key(sheet,w.b));
    const representative=p=>{let owner=byId.get(p.masterId);if(p.type==='relay-contact'&&owner?.p.type==='relay-coil')owner=byId.get(owner.p.masterId);return ['relay-coil','relay-contact'].includes(p.type)&&owner?.p.type==='relay'&&!owner.p.unplaced?owner:null;};
    const assumptions=[];
    for(const e of entries){const {p,sheet}=e;
      if(!p.unplaced||p.type==='connector'||representative(p))for(const [a,b] of paths(p))if(copper(p,a)&&copper(p,b)){join(partKey(e,a),partKey(e,b));assumptions.push({entry:e,a,b,custom:p.calculationLinks!==undefined});}
      if(p.type==='relay-coil'){const owner=byId.get(p.masterId);if(owner?.p.type==='relay')for(const i of [0,1])join(partKey(e,i),partKey(owner,i));}
      if(p.type==='relay-contact'){const coil=byId.get(p.masterId),owner=byId.get(coil?.p.masterId);if(coil?.p.type==='relay-coil'&&owner?.p.type==='relay'&&Number.isInteger(p.relayContact))for(const i of [0,1,2])join(partKey(e,i),partKey(owner,2+3*(p.relayContact-1)+i));}
      if(p.type==='terminal-pin'&&!p.unplaced){const owner=byId.get(p.masterId);if(owner?.p.type==='connector'&&copper(owner.p,p.pinIndex))join(partKey(e,0),partKey(owner,p.pinIndex));}
      if(['reference','destination'].includes(p.type)&&!p.unplaced){const target=byId.get(p.targetPartId);if(target&&!target.p.unplaced&&target.sheet.id===p.targetSheetId&&['reference','destination'].includes(target.p.type)&&target.p.type!==p.type)join(partKey(e,0),partKey(target,0));}
    }
    const tags=new Map(),seeds=[];
    for(const c of circuits){const e=byId.get(c.sourcePartId);if(!e||e.p.unplaced)continue;let pins=c.sourcePins;
      if(e.p.type==='supply')pins=c.system==='ac3'?[0,1,2,3]:[0,1];
      // Other source devices need an explicit output mapping. Never join a
      // converter's AC inputs to its DC outputs or infer physical pin numbers.
      if(!pins)continue;const roles=c.system==='ac3'?['L1','L2','L3','N']:c.system==='dc'?['+','−']:['L','N'];
      if(pins.length!==roles.length||pins.some(i=>!copper(e.p,i))){sourceErrors.get(c.id).push('Source output mapping is invalid');continue;}
      if(e.p.type==='supply'&&e.p.supplySystem!==c.system){sourceErrors.get(c.id).push('Source symbol system differs from its circuit');continue;}
      for(let i=0;i<pins.length;i++)seeds.push({c,role:roles[i],root:find(partKey(e,pins[i]))});
      if(e.p.type==='supply')seeds.push({c,role:'PE',root:find(partKey(e,c.system==='ac3'?4:2))});
    }
    for(const seed of seeds){if(!tags.has(seed.root))tags.set(seed.root,[]);tags.get(seed.root).push(seed);}
    const live=role=>['+','L','L1','L2','L3'].includes(role);
    for(const list of tags.values()){
      const active=list.filter(t=>live(t.role));if(!active.length)continue;
      const roles=new Set(active.map(t=>t.c.id+':'+t.role));if(roles.size>1||list.some(t=>!live(t.role)))for(const id of new Set(list.map(t=>t.c.id)))sourceErrors.get(id).push('Conflicting source poles or multiple live sources share a copper net');
    }
    for(const [id,list] of sourceErrors)sourceErrors.set(id,[...new Set(list)]);
    const at=(e,i)=>tags.get(find(partKey(e,i)))||[],related=(e,pins)=>[...new Set(pins.flatMap(i=>at(e,i).map(t=>t.c.id)))];
    const states=new Map(),resolved=[],issues=[];
    for(const e of entries){const {p}=e,pins=powerPins(p);
      // The connected-device directory includes transit devices and PE-only
      // connections, while only power-input candidates enter the load total.
      if((!p.unplaced||representative(p))&&!['text','image','reference','destination','terminal-pin','terminal-strip'].includes(p.type)){
        const all=[...Array.from({length:ports(p)},(_,i)=>i),...(p.type==='connector'?[8]:[])].filter(i=>copper(p,i)),ids=related(e,all);
        for(const id of ids)if(circuits.find(c=>c.id===id)?.sourcePartId!==p.id)connected.get(id).push({...e,inputs:all.flatMap(i=>at(e,i).filter(t=>t.c.id===id).map(t=>({pin:i,role:t.role}))),transit:!candidate(p)});
      }
      if(!candidate(p))continue;
      if(!p.loadCalculation&&pins&&circuits.some(c=>c.sourcePartId===p.id&&c.sourcePins?.length===pins.length&&c.sourcePins.every(i=>pins.includes(i))))continue;
      const state={entry:e,pins,related:related(e,pins||Array.from({length:ports(p)},(_,i)=>i)),status:'unresolved',message:'',circuit:null,phase:null};states.set(p.id,state);
      if(p.loadExcluded){state.status='excluded';state.message='Excluded from load totals';continue;}
      if(p.unplaced&&!representative(p)){state.message='Device is unplaced';}
      else if(!pins||![2,3].includes(pins.length)||pins.some(i=>!copper(p,i))){state.message='Select two or three copper power inputs';}
      else{
        const roots=pins.map(i=>find(partKey(e,i))),candidates=[];
        for(const c of circuits){if(c.sourcePartId===p.id)continue;const roles=pins.map(i=>at(e,i).filter(t=>t.c.id===c.id).map(t=>t.role));let phase=null;
          if(pins.length===3&&c.system==='ac3'&&['L1','L2','L3'].every(role=>roles.some(a=>a.includes(role)))&&new Set(roots).size===3)phase='balanced';
          if(pins.length===2&&new Set(roots).size===2){if(c.system==='dc'&&roles.some(a=>a.includes('+'))&&roles.some(a=>a.includes('−')))phase='single';if(c.system==='ac1'&&roles.some(a=>a.includes('L'))&&roles.some(a=>a.includes('N')))phase='single';if(c.system==='ac3'&&roles.some(a=>a.includes('N')))phase=['L1','L2','L3'].find(role=>roles.some(a=>a.includes(role)))||null;}
          if(phase)candidates.push({c,phase});
        }
        if(candidates.length===1&&!sourceErrors.get(candidates[0].c.id).length){state.circuit=candidates[0].c;state.phase=candidates[0].phase;state.status='connected';state.message=state.circuit.name+' · '+state.phase;}
        else if(candidates.length>1||state.related.some(id=>sourceErrors.get(id)?.length)){state.status='conflict';state.message='Conflicting supplies / source poles; no automatic assignment';}
        else state.message=roots.length!==new Set(roots).size?'Power inputs share the same copper net':state.related.length>1?'Power inputs belong to different supplies':'Incomplete wiring or unsupported supply/phase combination';
      }
      const l=p.loadCalculation;
      if(l?.assignment==='manual'){
        state.manual=true;resolved.push(e);if(state.circuit&&state.circuit.id!==l.circuitId)issues.push({state,circuitIds:[state.circuit.id,l.circuitId],message:'Manual supply differs from connected supply'});continue;
      }
      if(state.status==='connected'&&l&&typeof l.value==='number')resolved.push({...e,representedBy:representative(p)?.p.id,p:{...p,loadCalculation:{...l,circuitId:state.circuit.id,phase:state.phase}},automatic:true});
      else{const message=state.status==='connected'?'Electrical input power/current is missing':state.message;issues.push({state,circuitIds:state.circuit?[state.circuit.id]:state.related,message});}
    }
    return{states,resolved,issues,connected,sourceErrors,assumptions,byId};
  }
  return{AUTO,ports,copper,powerPins,candidate,paths,validatePart,analyse};
});
