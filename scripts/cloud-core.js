/* Transactional document merge. An electrical sheet is one atomic unit: a route,
   its devices and its junctions must never be merged independently. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CabelCloudCore=api;})(globalThis,()=>{
  'use strict';
  const Electrical=typeof module==='object'&&module.exports?require('./electrical-core.js'):globalThis.CabelElectricalCore;
  function stable(value){if(value===undefined)return 'undefined';if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(stable).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';}
  const equal=(a,b)=>stable(a)===stable(b),copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  function documentOf(raw){
    if(!raw||typeof raw!=='object'||!Array.isArray(raw.sheets)||!raw.sheets.length)throw Error('A project needs at least one drawing sheet');
    const doc={title:String(raw.title||'New schematic'),projectInfo:copy(raw.projectInfo||{}),cables:copy(raw.cables||[]),sheets:copy(raw.sheets)};
    const ids=new Set();for(const s of doc.sheets){if(!s||typeof s.id!=='string'||!s.id||ids.has(s.id)||!Array.isArray(s.parts)||!Array.isArray(s.wires))throw Error('Invalid or duplicate drawing sheet');ids.add(s.id);delete s._pageNumber;}
    // Sheet numbers are assigned by the editor; duplicates from two added sheets
    // are a conflict, never silently renumbered during a cloud merge.
    const numbers=new Set();for(const s of doc.sheets)if(s.number!==undefined){if(!Number.isInteger(s.number)||s.number<1||s.number>9999||numbers.has(s.number))throw Error('Drawing sheet numbers conflict');numbers.add(s.number);}
    const objects=new Set();for(const s of doc.sheets)for(const p of [...s.parts,...s.wires,...(s.junctions||[]),...(s.looseEnds||[])]){if(typeof p.id!=='string'||!p.id||objects.has(p.id))throw Error('Duplicate project object ID');objects.add(p.id);}
    if(doc.projectInfo.coverImages!==undefined){if(!Array.isArray(doc.projectInfo.coverImages))throw Error('Invalid cover images');for(const p of doc.projectInfo.coverImages){if(p?.type!=='image'||typeof p.id!=='string'||!p.id||objects.has(p.id))throw Error('Invalid or duplicate cover image');objects.add(p.id);}}
    Electrical.validateDocument(doc);return doc;
  }
  function merge(base,local,remote,choices={}){
    const conflicts=[];
    function unit(key,label,b,l,r){if(equal(l,r)||equal(b,r))return copy(l);if(equal(b,l))return copy(r);if(choices[key]==='local')return copy(l);if(choices[key]==='remote')return copy(r);conflicts.push({key,label});return copy(l);}
    const result={title:unit('title','Project title',base.title,local.title,remote.title),projectInfo:unit('projectInfo','Project information / cover images / approvals',base.projectInfo,local.projectInfo,remote.projectInfo),cables:unit('cables','Cable definitions',base.cables,local.cables,remote.cables),sheets:[]};
    const maps=[base,local,remote].map(d=>new Map(d.sheets.map(s=>[s.id,s]))),order=[...new Set([...remote.sheets,...local.sheets].map(s=>s.id))];
    for(const id of order){const [b,l,r]=maps.map(m=>m.get(id)),s=unit('sheet:'+id,'Sheet: '+(l?.title||r?.title||b?.title||id),b,l,r);if(s)result.sheets.push(s);}
    // Cable material removal/renaming and simultaneous route edits can be linked.
    // Escalate these cross-sheet changes instead of creating inconsistent cable cores.
    if(!equal(local,remote)&&(!equal(base.cables,local.cables)&&!equal(base.sheets,remote.sheets)||!equal(base.cables,remote.cables)&&!equal(base.sheets,local.sheets))){
      if(!choices.document)conflicts.push({key:'document',label:'Cable definitions and drawing connections changed together'});
      else return{document:copy(choices.document==='local'?local:remote),conflicts:[]};
    }
    // A circuit edit and a concurrent device-load edit can change the same
    // electrical result across otherwise independent sheets. Review together.
    const supplies=d=>d.projectInfo?.electricalCalculations,loadAssignments=d=>d.sheets.map(s=>({id:s.id,parts:s.parts.filter(p=>!['text','image'].includes(p.type)).map(p=>({id:p.id,type:p.type,unplaced:p.unplaced,load:p.loadCalculation,conversion:p.powerConversion,excluded:p.loadExcluded,paths:p.calculationLinks,master:p.masterId,pin:p.pinIndex,relayContact:p.relayContact,terminalType:p.terminalType,terminalFunction:p.catalog?.attributes?.terminalFunction,ports:p.pinNumbers,model:p.catalog?.attributes?.loadModel,outputVoltage:p.catalog?.attributes?.outputVoltageV,kinds:p.portKinds,system:p.supplySystem,target:[p.targetSheetId,p.targetPartId]})).sort((a,b)=>a.id.localeCompare(b.id)),wires:s.wires.map(w=>({id:w.id,a:w.a,b:w.b,kind:w.kind})).sort((a,b)=>a.id.localeCompare(b.id))})).filter(s=>s.parts.length||s.wires.length).sort((a,b)=>a.id.localeCompare(b.id));
    if(!equal(local,remote)&&(!equal(supplies(base),supplies(local))&&!equal(loadAssignments(base),loadAssignments(remote))||!equal(supplies(base),supplies(remote))&&!equal(loadAssignments(base),loadAssignments(local)))){
      if(!choices.document)conflicts.push({key:'document',label:'Electrical supplies and connected devices / paths changed together'});
      else return{document:copy(choices.document==='local'?local:remote),conflicts:[]};
    }
    try{documentOf(result);}catch(e){if(choices.document)return{document:copy(choices.document==='local'?local:remote),conflicts:[]};conflicts.push({key:'document',label:e.message});}
    return{document:result,conflicts};
  }

  // Network callbacks never apply a document during a drag, open property form,
  // PDF export or unfinished connection. Acknowledgements are merged with any
  // edits made while the request was in flight.
  class Session{
    constructor(api){this.api=api;this.base=documentOf(api.initial);this.pending=null;this.conflict=null;this.sending=false;this.stopped=false;this.generation=0;}
    dirty(){return !equal(documentOf(this.api.capture()),this.base);}
    async tick(){
      if(this.stopped||this.conflict||this.api.busy()||this.sending)return;
      try{
        if(this.pending){const ack=this.pending,now=documentOf(this.api.capture()),merged=merge(ack.local,now,ack.remote);this.pending=null;if(merged.conflicts.length){this.pause(ack.local,now,ack.remote,merged.conflicts);return;}this.base=ack.remote;if(!equal(now,merged.document))this.api.apply(merged.document);this.api.status(this.dirty()?'pending':'saved');return;}
        if(!this.api.connected()){this.api.status(this.dirty()?'offline-pending':'offline');return;}
        if(!this.dirty()&&!this.api.changed()){this.api.status('saved');return;}
        const local=documentOf(this.api.capture());this.sending=true;this.api.status('syncing');
        const generation=this.generation;
        const result=await this.api.transact(this.base,local);
        if(this.stopped||generation!==this.generation)return;
        if(result.conflicts?.length){this.pause(this.base,documentOf(this.api.capture()),result.document,result.conflicts);return;}
        this.pending={local,remote:documentOf(result.document)};
      }catch(e){if(!this.stopped)this.api.error(e);}finally{this.sending=false;}
    }
    pause(base,local,remote,conflicts){this.conflict={base:copy(base),local:copy(local),remote:copy(remote),conflicts};this.api.status('conflict');this.api.conflict(this.conflict);}
    refreshConflict(){if(!this.conflict)return;const c=this.conflict;c.local=documentOf(this.api.capture());c.conflicts=merge(c.base,c.local,c.remote).conflicts;}
    resolve(choices){if(!this.conflict)return;const c=this.conflict,now=documentOf(this.api.capture());if(!equal(now,c.local))throw Error('The local document changed. Reopen the conflict review.');const result=merge(c.base,c.local,c.remote,choices);if(result.conflicts.length)throw Error('Choose a version for every conflict');this.base=c.remote;this.conflict=null;this.api.apply(result.document);this.api.status('pending');}
    stop(){this.stopped=true;this.generation++;}
  }
  return{stable,equal,copy,documentOf,merge,Session};
});
