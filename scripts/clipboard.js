/* A clipboard fragment owns its geometry. Connections outside the fragment end
   at open terminals; pasted copies never reuse physical device or cable IDs. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CabelClipboard=api;})(globalThis,()=>{
  'use strict';
  const clone=value=>structuredClone(value),owner=ref=>ref.split(':')[0];
  const annotation=p=>['text','image','reference','destination',...(typeof module==='object'&&module.exports?require('./electrical-network.js').basicTypes:globalThis.CabelElectricalNetwork.basicTypes)].includes(p.type);
  function capture(api){
    const {sheet,parts,ends,junctions,segments}=api,ids=new Set([...parts,...[...ends].map(id=>'~'+id),...[...junctions,...api.enclosed].map(id=>'@'+id)]);
    const chosen=sheet.parts.filter(p=>parts.has(p.id)&&!p.unplaced),sections=[],whole=new Set(),nodesOnly=!parts.size&&!api.wires.size&&!segments.size;let serial=0;
    for(const w of sheet.wires){
      const route=api.route(w);if(route.length<2)continue;
      const selected=new Set(segments.get(w.id)||[]),full=api.wires.has(w.id)||ids.has(owner(w.a))&&ids.has(owner(w.b))||nodesOnly&&[w.a,w.b].some(ref=>junctions.has(owner(ref).slice(1))&&ref[0]==='@'||ends.has(owner(ref).slice(1))&&ref[0]==='~');
      if(full||route.slice(1).every((_,i)=>selected.has(i))){sections.push({wire:clone(w),route:clone(route)});whole.add(w.id);continue;}
      for(let i=0;i<route.length-1;i++)if(selected.has(i)){
        const first=i;while(i+1<route.length-1&&selected.has(i+1))i++;
        const key='!section'+(++serial),points=route.slice(first,i+2);
        sections.push({wire:{...clone(w),id:key,runId:key,a:first===0?w.a:key+'a:0',b:i===route.length-2?w.b:key+'b:0',labelT:.5,labelHidden:false},route:clone(points)});
      }
    }
    if(!chosen.length&&!sections.length)return null;
    const degree=new Map();for(const {wire:w}of sections)for(const ref of [w.a,w.b])degree.set(ref,(degree.get(ref)||0)+1);
    const nodes=[],open=[],references=new Map();
    function endpoint(ref,point,w){
      if(parts.has(owner(ref))&&!ref.startsWith('@')&&!ref.startsWith('~'))return ref;
      if(references.has(ref))return references.get(ref);
      const node=(sheet.junctions||[]).find(n=>ref==='@'+n.id+':0');
      if(node&&degree.get(ref)>=2){nodes.push(clone(node));references.set(ref,ref);return ref;}
      const old=(sheet.looseEnds||[]).find(n=>ref==='~'+n.id+':0'),id=old?.id||'!end'+(++serial);
      const value=old?clone(old):{id,x:point.x,y:point.y,kind:w.kind||'wire',formerLabel:ref[0]==='!'?'Open end':api.label(ref)};
      if(!old&&!ref.startsWith('!'))value.formerRef=ref;
      const strip=api.strip?.(ref);if(strip)value.strip=strip;
      open.push(value);const result='~'+id+':0';references.set(ref,result);return result;
    }
    for(const {wire:w,route}of sections){w.a=endpoint(w.a,route[0],w);w.b=endpoint(w.b,route.at(-1),w);w.points=route.slice(1,-1);}
    const wireIds=new Set(sections.map(s=>s.wire.id));for(const n of nodes)if(!wireIds.has(n.rootWireId))n.rootWireId=sections.find(s=>[s.wire.a,s.wire.b].includes('@'+n.id+':0')).wire.id;
    const ancestors=[],all=new Map(api.allParts.map(p=>[p.id,p])),seen=new Set(parts);
    for(const p of chosen){let current=p;while(current.masterId&&!seen.has(current.masterId)){seen.add(current.masterId);current=all.get(current.masterId);if(!current)break;ancestors.push({...clone(current),unplaced:true});}}
    const cableIds=new Set(sections.map(s=>s.wire.cableId)),circuits=api.circuits.filter(c=>parts.has(c.sourcePartId));
    return{sheetId:sheet.id||sheet.generatedId,parts:clone(chosen),ancestors,wires:sections.map(s=>s.wire),junctions:nodes,looseEnds:open,cables:clone(api.cables.filter(c=>cableIds.has(c.id))),circuits:clone(circuits),disabledSources:api.disabledSources.filter(id=>parts.has(id)),removeWires:[...whole],partial:sections.some(s=>s.wire.id.startsWith('!')),offset:0,cut:false};
  }
  function instantiate(fragment,api){
    const cut=fragment.cut,ids=new Map(),circuitIds=new Map(),usedIds=new Set(api.existingIds),names=new Set(api.parts.filter(p=>!p.masterId).map(p=>String(p.deviceCode||p.label||''))),cableNames=new Set(api.cables.map(c=>c.number.toLocaleLowerCase('en'))),circuitNames=new Set(api.circuits.map(c=>c.name));
    function unique(value,used,max=200,fold=v=>v){let i=1,name;do{name=String(value||'Device').slice(0,max-16)+' Copy'+(i===1?'':' '+i);i++;}while(used.has(fold(name)));used.add(fold(name));return name;}
    function fresh(prefix){let value;do{value=api.id(prefix);}while(usedIds.has(value));usedIds.add(value);return value;}
    function mapped(value,prefix){if(!ids.has(value)){const id=cut&&!value.startsWith('!')&&!usedIds.has(value)?value:fresh(prefix);usedIds.add(id);ids.set(value,id);}return ids.get(value);}
    const selectedIds=new Set(fragment.parts.map(p=>p.id)),sourceParts=[...fragment.parts,...(cut?[]:fragment.ancestors)],offset=api.offset;
    for(const p of sourceParts)mapped(p.id,'p');for(const w of fragment.wires){mapped(w.id,'w');if(w.runId)mapped(w.runId,'w');}for(const n of fragment.junctions)mapped(n.id,'j');for(const n of fragment.looseEnds)mapped(n.id,'e');
    const circuits=cut?[]:fragment.circuits.map(c=>{const id=fresh('c');circuitIds.set(c.id,id);return{...clone(c),id,name:unique(c.name,circuitNames),sourcePartId:mapped(c.sourcePartId,'p')};});
    for(const p of sourceParts)if(!circuitIds.has('@psu:'+p.id))circuitIds.set('@psu:'+p.id,'@psu:'+mapped(p.id,'p'));
    const cables=cut?[]:fragment.cables.map(c=>{const id=mapped(c.id,'cable');return{...clone(c),id,number:unique(c.number,cableNames,64,v=>v.toLocaleLowerCase('en')),cores:c.cores.map(core=>({...clone(core),id:mapped(core.id,'core'),masterId:id}))};});
    function ref(value){const prefix=value[0]==='@'||value[0]==='~'?value[0]:'',at=value.indexOf(':');return prefix+(ids.get(value.slice(prefix.length,at))||value.slice(prefix.length,at))+value.slice(at);}
    function strip(value){return typeof value==='string'&&value.startsWith('master:')&&ids.has(value.slice(7))?'master:'+ids.get(value.slice(7)):value;}
    const parts=sourceParts.map(original=>{
      const p=clone(original);p.id=mapped(original.id,'p');p.x+=offset;p.y+=offset;
      if(!cut&&!annotation(p)&&!p.masterId){p.deviceCode=unique(p.deviceCode||p.label,names);p.label=p.deviceCode;}
      if(ids.has(p.masterId))p.masterId=ids.get(p.masterId);
      if(p.targetSheetId===fragment.sheetId&&selectedIds.has(p.targetPartId)){p.targetPartId=ids.get(p.targetPartId);p.targetSheetId=api.sheetId;}
      else if(!cut&&['reference','destination'].includes(p.type)){delete p.targetPartId;delete p.targetSheetId;}
      if(p.loadCalculation&&circuitIds.has(p.loadCalculation.circuitId))p.loadCalculation.circuitId=circuitIds.get(p.loadCalculation.circuitId);
      return p;
    });
    const point=n=>({...clone(n),id:ids.get(n.id),x:n.x+offset,y:n.y+offset});
    return{parts,wires:fragment.wires.map(w=>({...clone(w),id:ids.get(w.id),a:ref(w.a),b:ref(w.b),...(w.runId?{runId:ids.get(w.runId)}:{}),points:w.points.map(p=>({x:p.x+offset,y:p.y+offset})),...(w.cableId&&ids.has(w.cableId)?{cableId:ids.get(w.cableId),coreId:ids.get(w.coreId)}:{})})),junctions:fragment.junctions.map(n=>({...point(n),rootWireId:ids.get(n.rootWireId)})),looseEnds:fragment.looseEnds.map(n=>({...point(n),...(n.formerRef?{formerRef:ref(n.formerRef)}:{}),...(n.strip?{strip:strip(n.strip)}:{})})),cables,circuits,disabledSources:fragment.disabledSources.map(id=>ids.get(id)),selectedParts:fragment.parts.map(p=>ids.get(p.id)),ids};
  }
  return{capture,instantiate};
});
