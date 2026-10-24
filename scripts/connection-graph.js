/* Explicit junctions keep crossings separate from electrical connections.
   Split sections share a runId; branches are independent runs. */
globalThis.CabelConnections = (() => {
  const EPS=1e-6;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function clean(points){
    const out=[];for(const p of points){if(!p)continue;if(!out.length||distance(out.at(-1),p)>EPS)out.push({x:p.x,y:p.y});}
    for(let i=1;i<out.length-1;){const a=out[i-1],b=out[i],c=out[i+1],cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x),dot=(b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y);if(Math.abs(cross)<EPS&&dot>=-EPS)out.splice(i,1);else i++;}return out;
  }
  function octilinear(points){
    const out=[];for(const p of points){if(!p)continue;const a=out.at(-1);if(a){const dx=p.x-a.x,dy=p.y-a.y,d=Math.min(Math.abs(dx),Math.abs(dy));if(d>EPS&&Math.abs(Math.abs(dx)-Math.abs(dy))>EPS)out.push({x:a.x+Math.sign(dx)*d,y:a.y+Math.sign(dy)*d});}out.push({...p});}return clean(out);
  }
  function stretchStart(points,start){
    if(distance(points[0],start)<EPS)return points;
    if(points.length<2)return octilinear([start,points[0]]);
    if(points.length===2){
      const [old,end]=points,diagonal=Math.abs(old.x-end.x)>EPS&&Math.abs(old.y-end.y)>EPS;
      return diagonal?octilinear([end,start]).reverse():octilinear([start,end]);
    }
    const [old,corner,anchor]=points,u={x:corner.x-old.x,y:corner.y-old.y},v={x:anchor.x-corner.x,y:anchor.y-corner.y},cross=u.x*v.y-u.y*v.x;
    if(Math.abs(cross)>EPS){
      const t=((anchor.x-start.x)*v.y-(anchor.y-start.y)*v.x)/cross,next={x:start.x+t*u.x,y:start.y+t*u.y};
      if(Number.isFinite(next.x)&&Number.isFinite(next.y)&&t>=-EPS&&((anchor.x-next.x)*v.x+(anchor.y-next.y)*v.y)>=-EPS)return clean([start,next,...points.slice(2)]);
    }
    // A bend that has moved behind an endpoint no longer needs to be kept.
    // Reconnect to the next fixed vertex with at most one replacement bend.
    return clean([...octilinear([start,anchor]),...points.slice(3)]);
  }
  function stretch(points,a,b){
    if(points.length<2)return[];
    const dx=a.x-points[0].x,dy=a.y-points[0].y,last=points.at(-1);
    if(Math.abs(b.x-last.x-dx)<EPS&&Math.abs(b.y-last.y-dy)<EPS)return points.map(p=>({x:p.x+dx,y:p.y+dy}));
    const first=stretchStart(points.map(p=>({...p})),a);
    return stretchStart(first.reverse(),b).reverse();
  }
  function projection(points,p){
    let best=null,total=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,length=distance(a,b),u=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(length*length))):0,q={x:a.x+dx*u,y:a.y+dy*u},d=distance(p,q);if(!best||d<best.distance)best={point:q,index:i-1,distance:d,along:total+u*length};total+=length;}return best&&{...best,total};
  }
  function init(api){
    const drafts=new Map();let draftSerial=0,diagonalUsed=false,shift=false,locked=false,nodeDrag=null,lastCursor=null;
    const sheet=()=>api.sheet(),wires=()=>api.wires(),nodes=()=>sheet()?.junctions||[],ref=id=>'@'+id+':0',nodeId=key=>typeof key==='string'&&key.startsWith('@')?key.slice(1).split(':')[0]:null;
    const node=key=>nodes().find(n=>n.id===nodeId(key)),incident=n=>wires().filter(w=>w.a===ref(n.id)||w.b===ref(n.id));
    const angle=()=>shift||locked;
    const position=key=>node(key)||drafts.get(key)?.point||null;
    function terminals(s,key,exclude=null){
      if(!nodeId(key))return[key];const seen=new Set(),result=new Set(),queue=[key];
      while(queue.length){const current=queue.shift();if(seen.has(current))continue;seen.add(current);const draft=s===sheet()&&drafts.get(current);if(draft){const host=(s.wires||[]).find(w=>w.id===draft.wireId);if(host)queue.push(host.a,host.b);}
        for(const w of s.wires||[]){if(w.id===exclude||w.a!==current&&w.b!==current)continue;const other=w.a===current?w.b:w.a;if(nodeId(other))queue.push(other);else result.add(other);}}
      return[...result];
    }
    function kind(key){const draft=drafts.get(key);if(draft)return draft.kind;const n=node(key);return n?(incident(n)[0]?.kind||'wire'):null;}
    function bridge(key){const draft=drafts.get(key);if(draft)return draft.kind==='bridge';const n=node(key);if(n)return incident(n).some(w=>w.kind==='bridge');return null;}
    function validBridge(a,b,base){const left=terminals(sheet(),a),right=terminals(sheet(),b);return left.length>0&&right.length>0&&left.every(x=>right.every(y=>base(x,y)));}
    function conflictingKind(w,kind){const group=wires().filter(q=>q===w||w.runId&&q.runId===w.runId),ids=new Set(group.map(q=>q.id));return group.some(q=>[q.a,q.b].some(key=>{const n=node(key);return n&&incident(n).some(other=>!ids.has(other.id)&&(other.kind||'wire')!==kind);}));}
    function begin(key){diagonalUsed=false;lastCursor=null;for(const refKey of drafts.keys())if(refKey!==key)drafts.delete(refKey);}
    function build(cursor){
      const pending=api.pending(),a=api.position(pending.start);if(!a)return[];const prefix=[a,...pending.points],last=prefix.at(-1),tail=angle()?octilinear([last,cursor]):api.orthogonal([last,cursor]);return clean([...prefix,...tail.slice(1)]);
    }
    function waypoint(p){const points=build(p);if(angle())diagonalUsed=true;return points.slice(1);}
    function preview(p){lastCursor=p;return build(p);}
    function materialize(key){
      const draft=drafts.get(key);if(!draft)return key;
      const candidates=wires().filter(w=>w.id===draft.wireId||(w.runId||w.id)===draft.runId).map(w=>({w,hit:projection(api.route(w),draft.point)})).filter(e=>e.hit&&e.hit.distance<EPS*10).sort((a,b)=>a.hit.distance-b.hit.distance);
      const candidate=candidates[0];if(!candidate)return null;const {w,hit}=candidate,points=api.route(w);
      if(distance(points[0],hit.point)<EPS)return w.a;if(distance(points.at(-1),hit.point)<EPS)return w.b;
      const actualKey=ref(api.id('j')),n={id:nodeId(actualKey),x:hit.point.x,y:hit.point.y,style:'dot',rootWireId:w.id},left=clean([...points.slice(0,hit.index+1),hit.point]),right=clean([hit.point,...points.slice(hit.index+1)]),ratio=hit.along/hit.total,oldB=w.b,labelT=Number.isFinite(+w.labelT)?+w.labelT:.5;
      const continuation={...structuredClone(w),id:api.id('w'),a:actualKey,b:oldB,points:right.slice(1,-1),runId:w.runId||w.id};
      w.runId=continuation.runId;w.b=actualKey;w.points=left.slice(1,-1);
      if(!w.labelHidden){if(labelT<=ratio){w.labelT=ratio?labelT/ratio:.5;continuation.labelHidden=true;}else{w.labelHidden=true;continuation.labelHidden=false;continuation.labelT=(labelT-ratio)/(1-ratio);}}
      const oldEnd=node(oldB);if(oldEnd?.rootWireId===w.id)oldEnd.rootWireId=continuation.id;
      (sheet().junctions||= []).push(n);wires().push(continuation);drafts.delete(key);return actualKey;
    }
    function complete(target){
      const pending=api.pending(),points=build(api.position(target)),routing=diagonalUsed||angle()?'octilinear':null;
      // Split only once the complete connection has passed port validation.
      const a=materialize(pending.start),b=materialize(target);if(!a||!b)return null;
      drafts.clear();diagonalUsed=false;lastCursor=null;return{a,b,points:points.slice(1,-1),...(routing?{routing}:{})};
    }
    function nearest(p,tolerance){
      let best=null;for(const w of wires()){const hit=projection(api.route(w),p);if(hit&&hit.distance<=tolerance&&(!best||hit.distance<best.hit.distance))best={w,hit};}return best;
    }
    function connectAt(client,type='mouse'){
      const p=api.world({clientX:client.x,clientY:client.y}),matrix=api.content.getScreenCTM(),scale=Math.hypot(matrix.a,matrix.b),tolerance=(type==='touch'?14:9)/scale;
      let n=nodes().map(n=>({n,d:distance(n,p)})).filter(e=>e.d<=tolerance).sort((a,b)=>a.d-b.d)[0]?.n;
      if(n){api.connect(ref(n.id));return true;}
      const hit=nearest(p,tolerance);if(!hit)return false;
      const points=api.route(hit.w),snapped={x:api.snap(p.x),y:api.snap(p.y)},q=projection(points,snapped).point;
      const start=api.pending().start,startPoint=start&&api.position(start);if(startPoint&&distance(startPoint,q)<EPS){api.connect(start);return true;}
      if(distance(q,points[0])<EPS){api.connect(hit.w.a);return true;}if(distance(q,points.at(-1))<EPS){api.connect(hit.w.b);return true;}
      const key=ref('draft-'+(++draftSerial));drafts.set(key,{wireId:hit.w.id,runId:hit.w.runId||hit.w.id,point:q,kind:hit.w.kind||'wire'});api.connect(key);return true;
    }
    function displayRoute(w){
      const points=api.route(w).map(p=>({...p}));if(points.length<2)return points;
      for(const end of['a','b']){const n=node(w[end]);if(!n||n.style!=='root'||incident(n).length<3)continue;
        const root=wires().find(q=>q.id===n.rootWireId);if(!root||root===w)continue;
        const rootPoints=api.route(root),rootNext=root.a===ref(n.id)?rootPoints[1]:rootPoints.at(-2),at=end==='a'?0:points.length-1,next=end==='a'?points[1]:points.at(-2);if(!rootNext||!next)continue;
        const u={x:rootNext.x-n.x,y:rootNext.y-n.y},v={x:next.x-n.x,y:next.y-n.y},cross=u.x*v.y-u.y*v.x;if(Math.abs(cross)<EPS)continue;
        // A 45° entry between perpendicular octilinear legs. Other angles keep
        // their exact route rather than introducing a non-45° segment.
        if(Math.abs(u.x*v.x+u.y*v.y)>EPS)continue;
        const um=Math.max(Math.abs(u.x),Math.abs(u.y)),vm=Math.max(Math.abs(v.x),Math.abs(v.y)),d=Math.min(api.grid(),um/3,vm/3),join={x:n.x+u.x/um*d,y:n.y+u.y/um*d},cut={x:n.x+v.x/vm*d,y:n.y+v.y/vm*d};
        if(end==='a')points.splice(0,1,join,cut);else points.splice(at,1,cut,join);
      }return clean(points);
    }
    function prune(){
      // Permanent device deletion may affect a sheet that is not on screen.
      for(const s of api.sheets()){
        const original=s===sheet()?wires():s.wires,ids=new Set((s.junctions||[]).map(n=>n.id));let remaining=[...(s.junctions||[])],kept=original.filter(w=>![w.a,w.b].some(key=>nodeId(key)&&!ids.has(nodeId(key))));
        let changed=true;while(changed){changed=false;for(const n of[...remaining]){const connected=kept.filter(w=>w.a===ref(n.id)||w.b===ref(n.id));if(connected.length<2){kept=kept.filter(w=>w.a!==ref(n.id)&&w.b!==ref(n.id));remaining=remaining.filter(q=>q!==n);changed=true;}else if(!connected.some(w=>w.id===n.rootWireId))n.rootWireId=connected[0].id;}}
        if(remaining.length!==(s.junctions||[]).length)s.junctions=remaining;
        if(kept.length!==original.length){if(s===sheet())api.removeWires(w=>!kept.includes(w));else s.wires=kept;}
        const groups=new Map();for(const w of kept)if(w.runId){if(!groups.has(w.runId))groups.set(w.runId,[]);groups.get(w.runId).push(w);}for(const group of groups.values())if(group.every(w=>w.labelHidden))group[0].labelHidden=false;
      }
    }
    function enclosed(partIds){
      const remaining=new Set(nodes()),result=[];while(remaining.size){const first=remaining.values().next().value,component=[],queue=[first],pins=new Set();while(queue.length){const n=queue.pop();if(!remaining.delete(n))continue;component.push(n);for(const w of incident(n)){const other=w.a===ref(n.id)?w.b:w.a;if(nodeId(other)){const adjacent=node(other);if(adjacent)queue.push(adjacent);}else pins.add(other.split(':')[0]);}}
        if(pins.size&&[...pins].every(id=>partIds.has(id)))result.push(...component);}
      return result;
    }
    function edit(id){
      const n=nodes().find(n=>n.id===id);if(!n)return;api.clearSelection();api.select({kind:'junction',id});api.render();
      const connections=incident(n),options=connections.map(w=>{const other=w.a===ref(id)?w.b:w.a;return'<option value="'+api.safe(w.id)+'"'+(w.id===n.rootWireId?' selected':'')+'>'+api.safe(w.id+' · '+api.endpoint(sheet(),other,w.id))+'</option>';}).join('');
      api.panel('<h2>Junction properties</h2><div class="wire-form"><label>Junction style<select id="junctionStyle"><option value="dot"'+(n.style!=='root'?' selected':'')+'>Dot</option><option value="root"'+(n.style==='root'?' selected':'')+'>45° root</option></select></label><label>Root connection<select id="junctionRoot">'+options+'</select></label><p>The root connection stays straight. Perpendicular branches enter at 45°. Each branch can have more junctions.</p><div class="actions"><button id="junctionApply">Apply</button><button id="junctionDelete">Delete junction and attached sections</button></div></div>');
      document.querySelector('#junctionApply').onclick=()=>{n.style=document.querySelector('#junctionStyle').value;n.rootWireId=document.querySelector('#junctionRoot').value;api.render();api.close();};
      document.querySelector('#junctionDelete').onclick=()=>{remove(id);api.close();};
    }
    function remove(id){api.removeWires(w=>w.a===ref(id)||w.b===ref(id));if(sheet().junctions)sheet().junctions=nodes().filter(n=>n.id!==id);api.select(null);api.render();}
    function draw(){
      if(!api.pending().start){drafts.clear();diagonalUsed=false;lastCursor=null;}
      for(const n of nodes()){
        const connected=incident(n);if(connected.length<2)continue;const active=api.selected()?.kind==='junction'&&api.selected().id===n.id||api.isSelected?.(n.id),g=api.el('g',{'data-junction-id':n.id,class:'connection-junction'+(active?' selected':'')},api.layer),color=connected.some(w=>w.kind==='bridge')?'#795548':connected.some(w=>w.kind==='fiber')?'#ef7d24':'#263943';
        if(n.style!=='root'&&connected.length>=3)api.el('circle',{cx:n.x,cy:n.y,r:3,fill:color,class:'junction-dot','pointer-events':'none'},g);
        if(active)api.el('circle',{cx:n.x,cy:n.y,r:6,fill:'none',stroke:'#e94391','stroke-width':1.5,class:'screen-only','pointer-events':'none'},g);
        const hit=api.el('circle',{cx:n.x,cy:n.y,r:9,fill:'transparent','pointer-events':'all',class:'junction-hit screen-only',tabindex:0,role:'button','aria-label':'Connection junction: open properties to choose dot or 45° root'},g);
        hit.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();edit(n.id);});hit.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();nodeDrag=null;edit(n.id);});
        hit.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();edit(n.id);}});
      }
    }
    function cancel(){drafts.clear();lastCursor=null;diagonalUsed=false;nodeDrag=null;}
    api.svg.addEventListener('pointerdown',e=>{
      if(e.button!==0||api.blocked()||e.ctrlKey||e.metaKey)return;
      if(api.connecting()){if(e.target.closest('.terminal'))return;if(e.target.closest('#wires')&&connectAt({x:e.clientX,y:e.clientY},e.pointerType)){e.preventDefault();e.stopImmediatePropagation();}return;}
      const id=e.target.closest('[data-junction-id]')?.dataset.junctionId;if(!id||api.mode()!=='select')return;
      e.preventDefault();e.stopImmediatePropagation();const n=nodes().find(n=>n.id===id);api.commit();api.clearSelection();api.select({kind:'junction',id});nodeDrag={n,start:api.world(e),x:n.x,y:n.y,routes:api.captureRoutes()};api.capture(e.pointerId);api.render();
    },true);
    api.svg.addEventListener('pointermove',e=>{if(!nodeDrag)return;e.preventDefault();e.stopImmediatePropagation();const p=api.world(e),state=nodeDrag;api.moveNode(state.n,state.x+api.snap(p.x-state.start.x),state.y+api.snap(p.y-state.start.y),state.routes);api.render();},true);
    api.svg.addEventListener('pointerup',e=>{if(!nodeDrag)return;e.preventDefault();e.stopImmediatePropagation();nodeDrag=null;api.render();},true);
    api.svg.addEventListener('pointercancel',()=>{if(nodeDrag){api.moveNode(nodeDrag.n,nodeDrag.x,nodeDrag.y,nodeDrag.routes);nodeDrag=null;api.render();}},true);
    document.addEventListener('keydown',e=>{
      if(e.key==='Shift'){shift=true;if(lastCursor)api.updatePreview(lastCursor);return;}
      if(e.target.closest('input,textarea,select,[contenteditable="true"]')||api.blocked())return;
      if(e.key==='Escape'&&nodeDrag){e.preventDefault();e.stopImmediatePropagation();api.moveNode(nodeDrag.n,nodeDrag.x,nodeDrag.y,nodeDrag.routes);nodeDrag=null;api.render();}
      if(['Delete','Backspace'].includes(e.key)&&api.selected()?.kind==='junction'){e.preventDefault();e.stopImmediatePropagation();remove(api.selected().id);}
    },true);
    document.addEventListener('keyup',e=>{if(e.key==='Shift'){shift=false;if(lastCursor)api.updatePreview(lastCursor);}});
    window.addEventListener('blur',()=>{shift=false;});
    return{position,kind,host:key=>drafts.get(key)?.wireId||null,bridge,validBridge,conflictingKind,begin,waypoint,preview,complete,connectAt,displayRoute,prune,enclosed,edit,remove,draw,cancel,busy:()=>Boolean(nodeDrag),angle:()=>locked,toggleAngle:()=>{locked=!locked;if(lastCursor)api.updatePreview(lastCursor);api.refresh();},terminals,nodeId};
  }
  return{init,clean,octilinear,stretch};
})();
