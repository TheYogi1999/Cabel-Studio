/* Logical copper nets. Geometry, equipment tags and cable/core labels do not
   connect nets. Internal paths describe the schematic, not verified hardware. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CabelElectricalNetwork=api;})(globalThis,()=>{
  'use strict';
  const AUTO='@auto',two=new Set(['resistor','capacitor','lamp','led','diode','motor','coil','relay-coil','trip-coil','motor-ac-1p','power-supply','io-module','controller-board','contactor-4p','optocoupler']);
  const defaults={'switch-changeover':3,'optocoupler':4,'contactor-4p':10,'auxiliary-contact':4,busbar:2,'motor-ac-3p':4,'motor-ac-6t':7,supply:3,relay:11,'relay-contact':3,'terminal-pin':1,reference:1,destination:1,connector:2,'power-supply':9,'io-module':10,'controller-board':8,'rcd-2p':4,'rcd-4p':8,'mcb-1p':2,'mcb-2p':4,'mcb-3p':6,'mcb-4p':8,'illuminated-pushbutton-no':4,'illuminated-pushbutton-nc':4};
  function ports(p){return p.type==='custom-symbol'?(p.symbolDefinition?.terminals?.length||0):p.pinNumbers?.length||(p.type==='supply'&&p.supplySystem==='ac3'?5:defaults[p.type]||(two.has(p.type)||['fuse','switch','switch-nc','pushbutton-no','pushbutton-nc','selector-switch','key-switch'].includes(p.type)?2:0));}
  const copper=(p,i)=>Number.isInteger(i)&&i>=0&&(i<ports(p)||p.type==='connector'&&i===8)&&p.portKinds?.[i]!=='fiber'&&p.type!=='fiber-device';
  function validateModel(m){
    if(!m||m.version!==1||!Array.isArray(m.portNames)||!m.portNames.length||m.portNames.length>64||m.portNames.some(n=>typeof n!=='string'||!n))throw Error('Invalid product load model');
    const group=(g,min,max)=>Array.isArray(g)&&g.length>=min&&g.length<=max&&new Set(g).size===g.length&&g.every(i=>Number.isInteger(i)&&i>=0&&i<m.portNames.length);
    if(!Array.isArray(m.inputs)||m.inputs.some(g=>!group(g,2,3))||!Array.isArray(m.groups)||m.groups.some(g=>!group(g,2,64))||!m.outputs||typeof m.outputs!=='object'||Object.entries(m.outputs).some(([k,g])=>!['dc','ac1','ac3'].includes(k)||!group(g,k==='ac3'?4:2,k==='ac3'?4:2)))throw Error('Invalid product power ports');
    return m;
  }
  function genericSupplyModel(p){
    if(p.type!=='power-supply'||p.catalog)return null;
    const names=p.pinNumbers||['L','N','PE','+24V','0V','+24V.2','0V.2','DC OK 13','DC OK 14'],normal=names.map(n=>String(n).trim().toUpperCase()),unique=name=>normal.indexOf(name)>=0&&normal.indexOf(name)===normal.lastIndexOf(name)?normal.indexOf(name):-1;
    const positive=normal.flatMap((n,i)=>/^(?:\+24V|\+)(?:\.\d+)?$/.test(n)&&unique(n)===i?[i]:[]),negative=normal.flatMap((n,i)=>/^(?:0V|[−-])(?:\.\d+)?$/.test(n)&&unique(n)===i?[i]:[]),l=unique('L'),n=unique('N');
    return{inputs:l>=0&&n>=0?[[l,n]]:[],groups:[positive,negative].filter(g=>g.length>1),outputs:positive.length&&negative.length?{dc:[positive[0],negative[0]]}:{},scope:'Generic schematic AC input and equivalent DC output rails; verify custom port roles.'};
  }
  function productModel(p,lookup){
    const raw=p.catalog?.attributes?.loadModel||lookup?.(p);if(!raw)return genericSupplyModel(p);
    try{validateModel(raw);}catch{return null;}
    const normal=s=>String(s).trim().replace(/\s+/g,' ').toUpperCase(),names=(p.pinNumbers||[]).map(normal),map=raw.portNames.map(n=>{const name=normal(n),i=names.indexOf(name);return i>=0&&names.lastIndexOf(name)===i?i:-1;}),translate=g=>g.every(i=>map[i]>=0)?g.map(i=>map[i]):null;
    return{inputs:raw.inputs.map(translate).filter(Boolean),groups:raw.groups.map(translate).filter(Boolean),outputs:Object.fromEntries(Object.entries(raw.outputs).map(([k,g])=>[k,translate(g)]).filter(([,g])=>g)),scope:raw.scope};
  }
  function inputGroups(p,lookup){
    if(p.loadCalculation?.powerPins)return[p.loadCalculation.powerPins];
    const model=productModel(p,lookup);if(model)return model.inputs;
    if(p.catalog&&['controller-board','io-module'].includes(p.type))return[];
    if(two.has(p.type)||p.type==='relay')return[[0,1]];if(p.type==='motor-ac-3p')return[[0,1,2]];if(String(p.type||'').startsWith('illuminated-pushbutton'))return[[2,3]];return[];
  }
  const powerPins=(p,lookup)=>inputGroups(p,lookup)[0]||null;
  const candidate=(p,lookup)=>two.has(p.type)||['relay','motor-ac-3p','motor-ac-6t'].includes(p.type)||String(p.type||'').startsWith('illuminated-pushbutton')||Boolean(p.loadCalculation)||Boolean(productModel(p,lookup)?.inputs.length);
  function paths(p,lookup){
    if(p.calculationLinks!==undefined)return p.calculationLinks;
    let pairs=[];
    if(p.type==='connector'){
      const all=Array.from({length:ports(p)},(_,i)=>i),disconnect=p.catalog?.attributes?.terminalFunction==='disconnect'||/^Disconnect terminal$/i.test(p.terminalType||'')||[p.value,p.terminalType,p.catalog?.model].some(v=>/^ST\s+\d+(?:[,.]\d+)?-MT(?:$|[\s/-])/i.test(String(v||'').trim()));
      const connected=disconnect?[...all.slice(1),8]:[...all,8];pairs=connected.slice(1).map(i=>[connected[0],i]);
    }
    if(['fuse','switch-nc','pushbutton-nc','illuminated-pushbutton-nc','busbar'].includes(p.type))pairs=[[0,1]];
    if(/^mcb-[1-4]p$/.test(p.type)||/^rcd-[24]p$/.test(p.type))pairs=Array.from({length:ports(p)/2},(_,i)=>[i*2,i*2+1]);
    return [...pairs,...(productModel(p,lookup)?.groups||[]).flatMap(g=>g.slice(1).map(i=>[g[0],i]))];
  }
  function sourcePins(p,system,lookup){return p.type==='supply'?(system==='ac3'?[0,1,2,3]:[0,1]):productModel(p,lookup)?.outputs[system];}
  function powerSupplyCircuit(p,lookup){
    if(p.type!=='power-supply')return null;const pins=sourcePins(p,'dc',lookup);if(!pins||pins.some(i=>!copper(p,i)))return null;
    const voltage=p.catalog?.attributes?.outputVoltageV,known=typeof voltage==='number'&&Number.isFinite(voltage)&&voltage>=1&&voltage<=1500;
    return{id:'@psu:'+p.id,name:(String(p.deviceCode||p.label||p.id).slice(0,185)+' · DC output'),sourcePartId:p.id,sourcePins:[...pins],system:'dc',voltage:known?voltage:24,reservePct:20,fault:{mode:'off'},automaticSource:true,voltageDefaulted:!known};
  }
  function circuits(doc,lookup){
    const settings=doc.projectInfo?.electricalCalculations,explicit=settings?.circuits||[],disabled=new Set(settings?.disabledSourcePartIds||[]),sources=new Set(explicit.map(c=>c.sourcePartId)),ids=new Set(explicit.map(c=>c.id));
    return[...explicit,...doc.sheets.flatMap(sheet=>sheet.parts.flatMap(p=>{if(sources.has(p.id)||disabled.has(p.id))return[];const c=powerSupplyCircuit(p,lookup);return c&&!ids.has(c.id)?[c]:[];}))];
  }
  function validatePart(p){
    if(p.loadExcluded!==undefined&&typeof p.loadExcluded!=='boolean')throw Error('Invalid load exclusion');
    if(p.calculationLinks!==undefined&&(!Array.isArray(p.calculationLinks)||p.calculationLinks.length>64||p.calculationLinks.some(pair=>!Array.isArray(pair)||pair.length!==2||pair[0]===pair[1]||pair.some(i=>!copper(p,i)))))throw Error('Invalid internal conductive paths');
    if(p.loadCalculation?.powerPins!==undefined&&(!Array.isArray(p.loadCalculation.powerPins)||![2,3].includes(p.loadCalculation.powerPins.length)||new Set(p.loadCalculation.powerPins).size!==p.loadCalculation.powerPins.length||p.loadCalculation.powerPins.some(i=>!copper(p,i))))throw Error('Choose two or three distinct copper power inputs');
  }
  function analyse(doc,lookup){
    const supplies=circuits(doc,lookup),entries=doc.sheets.flatMap(sheet=>sheet.parts.map(p=>({p,sheet}))),byId=new Map(entries.map(e=>[e.p.id,e])),parent=new Map(),connected=new Map(supplies.map(c=>[c.id,[]])),sourceErrors=new Map(supplies.map(c=>[c.id,[]]));
    const find=k=>{if(!parent.has(k))parent.set(k,k);let r=k;while(parent.get(r)!==r)r=parent.get(r);while(k!==r){const n=parent.get(k);parent.set(k,r);k=n;}return r;},join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent.set(a,b);},key=(sheet,ref)=>JSON.stringify([sheet.id,ref]);
    const partKey=(e,i)=>key(e.sheet,e.p.id+':'+i),valid=(sheet,ref)=>{
      if(typeof ref!=='string')return false;const [id,n]=ref.split(':'),i=Number(n);
      if(id.startsWith('@'))return i===0&&(sheet.junctions||[]).some(p=>'@'+p.id===id&&p.kind!=='fiber');
      if(id.startsWith('~'))return i===0&&(sheet.looseEnds||[]).some(p=>'~'+p.id===id&&p.kind!=='fiber');
      const e=byId.get(id);return e?.sheet===sheet&&(!e.p.unplaced||e.p.type==='connector')&&copper(e.p,i);
    };
    for(const sheet of doc.sheets)for(const w of sheet.wires)if(w.kind!=='fiber'&&valid(sheet,w.a)&&valid(sheet,w.b))join(key(sheet,w.a),key(sheet,w.b));
    const representative=p=>{if(p.type==='relay')return entries.find(e=>e.p.type==='relay-coil'&&e.p.masterId===p.id&&!e.p.unplaced)||null;let owner=byId.get(p.masterId);if(p.type==='relay-contact'&&owner?.p.type==='relay-coil')owner=byId.get(owner.p.masterId);return ['relay-coil','relay-contact'].includes(p.type)&&owner?.p.type==='relay'&&!owner.p.unplaced?owner:null;};
    const assumptions=[];
    for(const e of entries){const {p,sheet}=e;
      if(!p.unplaced||p.type==='connector'||representative(p))for(const [a,b] of paths(p,lookup))if(copper(p,a)&&copper(p,b)){join(partKey(e,a),partKey(e,b));assumptions.push({entry:e,a,b,custom:p.calculationLinks!==undefined});}
      if(p.type==='relay-coil'){const owner=byId.get(p.masterId);if(owner?.p.type==='relay')for(const i of [0,1])join(partKey(e,i),partKey(owner,i));}
      if(p.type==='relay-contact'){const coil=byId.get(p.masterId),owner=byId.get(coil?.p.masterId);if(coil?.p.type==='relay-coil'&&owner?.p.type==='relay'&&Number.isInteger(p.relayContact))for(const i of [0,1,2])join(partKey(e,i),partKey(owner,2+3*(p.relayContact-1)+i));}
      if(p.type==='terminal-pin'&&!p.unplaced){const owner=byId.get(p.masterId);if(owner?.p.type==='connector'&&copper(owner.p,p.pinIndex))join(partKey(e,0),partKey(owner,p.pinIndex));}
      if(['reference','destination'].includes(p.type)&&!p.unplaced){const target=byId.get(p.targetPartId);if(target&&!target.p.unplaced&&target.sheet.id===p.targetSheetId&&['reference','destination'].includes(target.p.type)&&target.p.type!==p.type)join(partKey(e,0),partKey(target,0));}
    }
    const tags=new Map(),seeds=[];
    for(const c of supplies){const e=byId.get(c.sourcePartId);if(!e||e.p.unplaced)continue;let pins=c.sourcePins||sourcePins(e.p,c.system,lookup);
      // Unknown source devices need an explicit output mapping. Never join a
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
    const coilMaster=p=>p.type==='relay'?byId.get(p.id):p.type==='relay-coil'&&byId.get(p.masterId)?.p.type==='relay'?byId.get(p.masterId):null;
    const states=new Map(),resolved=[],issues=[];
    for(let e of entries){let {p}=e;
      const master=coilMaster(p),slaves=master?entries.filter(q=>q.p.type==='relay-coil'&&q.p.masterId===master.p.id):[];
      const loadData=master?(master.p.loadCalculation||slaves.find(q=>q.p.loadCalculation?.value!==undefined)?.p.loadCalculation||slaves.find(q=>q.p.loadCalculation)?.p.loadCalculation):p.loadCalculation;
      const excluded=Boolean(master?(master.p.loadExcluded||!master.p.loadCalculation&&!loadData&&slaves.some(q=>q.p.loadExcluded)):p.loadExcluded);
      if(master&&p.id===master.p.id){p={...p,loadCalculation:loadData,loadExcluded:excluded};e={...e,p};}
      const groups=inputGroups(p,lookup).filter(g=>g.every(i=>copper(p,i)));let pins=groups[0]||null;
      // The connected-device directory includes transit devices and PE-only
      // connections, while only power-input candidates enter the load total.
      if((!p.unplaced||representative(p))&&!['text','image','reference','destination','terminal-pin','terminal-strip'].includes(p.type)){
        const all=[...Array.from({length:ports(p)},(_,i)=>i),...(p.type==='connector'?[8]:[])].filter(i=>copper(p,i)),ids=related(e,all);
        for(const id of ids)if(supplies.find(c=>c.id===id)?.sourcePartId!==p.id)connected.get(id).push({...e,inputs:all.flatMap(i=>at(e,i).filter(t=>t.c.id===id).map(t=>({pin:i,role:t.role}))),transit:!candidate(p,lookup)});
      }
      if(master&&p.id!==master.p.id)continue;
      if(!candidate(p,lookup))continue;
      if(!p.loadCalculation&&pins&&supplies.some(c=>c.sourcePartId===p.id&&c.sourcePins?.length===pins.length&&c.sourcePins.every(i=>pins.includes(i))))continue;
      const state={entry:e,pins,physicalId:master?.p.id||p.id,loadData,excluded,related:related(e,groups.length?groups.flat():Array.from({length:ports(p)},(_,i)=>i)),status:'unresolved',message:'',circuit:null,phase:null};states.set(p.id,state);
      if(p.loadExcluded){state.status='excluded';state.message='Excluded from load totals';continue;}
      if(p.unplaced&&!representative(p)){state.message='Device is unplaced';}
      else if(!pins||![2,3].includes(pins.length)||pins.some(i=>!copper(p,i))){state.message='Select two or three copper power inputs';}
      else{
        const candidates=[];for(const selected of groups){const roots=selected.map(i=>find(partKey(e,i)));
        for(const c of supplies){if(c.sourcePartId===p.id)continue;const roles=selected.map(i=>at(e,i).filter(t=>t.c.id===c.id).map(t=>t.role));let phase=null;
          if(selected.length===3&&c.system==='ac3'&&['L1','L2','L3'].every(role=>roles.some(a=>a.includes(role)))&&new Set(roots).size===3)phase='balanced';
          if(selected.length===2&&new Set(roots).size===2){if(c.system==='dc'&&roles.some(a=>a.includes('+'))&&roles.some(a=>a.includes('−')))phase='single';if(c.system==='ac1'&&roles.some(a=>a.includes('L'))&&roles.some(a=>a.includes('N')))phase='single';if(c.system==='ac3'&&roles.some(a=>a.includes('N')))phase=['L1','L2','L3'].find(role=>roles.some(a=>a.includes(role)))||null;}
          if(phase&&!candidates.some(v=>v.c.id===c.id&&v.phase===phase))candidates.push({c,phase,pins:selected});
        }}
        if(candidates.length===1&&!sourceErrors.get(candidates[0].c.id).length){state.pins=candidates[0].pins;state.circuit=candidates[0].c;state.phase=candidates[0].phase;state.status='connected';state.message=state.circuit.name+' · '+state.phase;}
        else if(candidates.length>1||state.related.some(id=>sourceErrors.get(id)?.length)){state.status='conflict';state.message='Conflicting supplies / source poles; no automatic assignment';}
        else state.message=pins.length!==new Set(pins.map(i=>find(partKey(e,i)))).size?'Power inputs share the same copper net':state.related.length>1?'Power inputs belong to different supplies':'Incomplete wiring or unsupported supply/phase combination';
      }
      const l=p.loadCalculation;
      if(l?.assignment==='manual'){
        state.manual=true;resolved.push(e);if(state.circuit&&state.circuit.id!==l.circuitId)issues.push({state,circuitIds:[state.circuit.id,l.circuitId],message:'Manual supply differs from connected supply'});continue;
      }
      if(state.status==='connected'&&l&&typeof l.value==='number')resolved.push({...e,representedBy:representative(p)?.p.id,p:{...p,loadCalculation:{...l,circuitId:state.circuit.id,phase:state.phase}},automatic:true});
      else{const message=state.status==='connected'?'Detected load; electrical input power/current is missing':state.message;issues.push({state,circuitIds:state.circuit?[state.circuit.id]:state.related,message});}
    }
    for(const e of entries){const master=coilMaster(e.p),state=master&&states.get(master.p.id);if(state&&e.p.id!==master.p.id)states.set(e.p.id,{...state,aliasOf:master.p.id});}
    return{circuits:supplies,states,resolved,issues,connected,sourceErrors,assumptions,byId};
  }
  return{AUTO,circuits,powerSupplyCircuit,ports,copper,powerPins,inputGroups,sourcePins,productModel,validateModel,candidate,paths,validatePart,analyse};
});
