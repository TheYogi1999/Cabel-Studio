/* Local proposal editor. Camera, tools and preferences never enter symbol JSON. */
(() => {
  'use strict';
  const $=s=>document.querySelector(s),NS='http://www.w3.org/2000/svg',canvas=$('#editorCanvas'),format=CabelSymbol;
  let state={kind:'cabel-symbol',schemaVersion:1,units:'mm',id:'user-symbol',name:'New symbol',group:'Switchgear',tagPrefix:'U',defaultValue:'',widthMm:48,heightMm:48,geometry:[],terminals:[]},selected=null,tool='select',gesture=null,loading=false,gridVisible=true;
  let view={x:0,y:0,zoom:1},navigation=null;
  const physical=new Set(),retained=new Set(),keeper=document.createElement('div');keeper.className='symbol-input-targets';keeper.setAttribute('aria-hidden','true');document.body.append(keeper);
  const pointers=new Map(),ignored=new Set(),undo=[],redo=[],clone=o=>structuredClone(o),snapshot=()=>JSON.stringify(state),status=s=>$('#editorStatus').textContent=s;
  const fields={symbolName:'name',symbolId:'id',symbolGroup:'group',tagPrefix:'tagPrefix',defaultValue:'defaultValue',canvasWidth:'widthMm',canvasHeight:'heightMm'};
  function node(tag,attrs,parent=canvas){const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n;}
  const all=()=>[...state.geometry,...state.terminals],find=()=>all().find(o=>o.id===selected),blocked=()=>loading||Boolean($('#settingsDialog')?.open);
  // A completed canvas drag can suppress Safari/Chromium's next compatibility
  // click. Activate a stationary touch/Pencil button once if that click is lost.
  let controlContact=null;const pendingControls=new WeakMap(),fallbackClicks=new WeakMap();
  function armControl(id,target,p,type){const n=target.closest?.('button');if(!n||n.disabled)return;const old=pendingControls.get(n);if(old)old.handled=true;fallbackClicks.delete(n);controlContact={id,node:n,start:p,type,moved:false,handled:false};}
  function moveControl(id,p,type){const c=controlContact;if(c?.id===id&&c.type===type&&Math.hypot(p.clientX-c.start.clientX,p.clientY-c.start.clientY)>8)c.moved=true;}
  function finishControl(id,p,cancelled,type){const c=controlContact;if(!c||c.id!==id||c.type!==type)return;controlContact=null;if(cancelled||c.moved)return;pendingControls.set(c.node,c);setTimeout(()=>{if(c.handled||!c.node.isConnected||c.node.disabled||document.elementFromPoint(p.clientX,p.clientY)?.closest('button')!==c.node)return;pendingControls.delete(c.node);fallbackClicks.set(c.node,performance.now()+800);c.node.click();},80);}
  document.addEventListener('touchstart',e=>{if(e.touches.length!==1){if(controlContact)controlContact.moved=true;return;}const t=e.changedTouches[0];armControl(t.identifier,e.target,t,'touch');},{capture:true,passive:true});
  document.addEventListener('touchmove',e=>{for(const t of e.changedTouches)moveControl(t.identifier,t,'touch');},{capture:true,passive:true});
  for(const name of ['touchend','touchcancel'])document.addEventListener(name,e=>{for(const t of e.changedTouches)finishControl(t.identifier,t,name==='touchcancel','touch');},{capture:true,passive:true});
  document.addEventListener('pointerdown',e=>{if(e.pointerType==='pen')armControl(e.pointerId,e.target,e,'pen');},true);
  document.addEventListener('pointermove',e=>{if(e.pointerType==='pen')moveControl(e.pointerId,e,'pen');},true);
  for(const name of ['pointerup','pointercancel'])document.addEventListener(name,e=>{if(e.pointerType==='pen')finishControl(e.pointerId,e,name==='pointercancel','pen');},true);
  document.addEventListener('click',e=>{const n=e.target.closest?.('button');if(!n)return;const c=pendingControls.get(n);if(c){c.handled=true;pendingControls.delete(n);}if(e.isTrusted&&e.detail>0&&(fallbackClicks.get(n)||0)>performance.now()){e.preventDefault();e.stopImmediatePropagation();}},true);
  function persist(){try{localStorage.setItem('cabel-symbol-draft',snapshot());$('#symbolDraftStatus').textContent='Draft saved in this browser';}catch{$('#symbolDraftStatus').textContent='Draft storage unavailable · download JSON to keep your work';}}
  function record(before){if(before===snapshot())return;undo.push(before);if(undo.length>100)undo.shift();redo.length=0;persist();}
  function syncFields(){for(const [id,key]of Object.entries(fields))$('#'+id).value=state[key];}
  function restore(text){state=format.validate(JSON.parse(text));selected=null;gesture=null;syncFields();render();persist();}
  function cancelGesture(){if(!gesture)return false;state=JSON.parse(gesture.before);selected=gesture.selection;if(gesture.nextTerminalName!==undefined)$('#terminalName').value=gesture.nextTerminalName;gesture=null;return true;}
  function release(id){try{if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}catch{}}
  function cancelInput(){const changed=cancelGesture();navigation=null;const ids=[...pointers.keys()];pointers.clear();ignored.clear();ids.forEach(release);if(changed)render();}
  function history(back){cancelInput();const from=back?undo:redo,to=back?redo:undo;if(!from.length)return;to.push(snapshot());restore(from.pop());status(back?'Undo':'Redo');}
  for(const group of format.groups){const o=document.createElement('option');o.value=o.textContent=group;$('#symbolGroup').append(o);}
  function readFields(){const next={...state};for(const [id,key]of Object.entries(fields))next[key]=['widthMm','heightMm'].includes(key)?+$('#'+id).value:$('#'+id).value;state=format.validate(next);}
  for(const id of Object.keys(fields))$('#'+id).onchange=()=>{cancelInput();const before=snapshot();try{readFields();record(before);render();status('Symbol updated');}catch(e){state=JSON.parse(before);syncFields();status(e.message);}};
  function applyView(){canvas.setAttribute('viewBox',[view.x-state.widthMm/(2*view.zoom),view.y-state.heightMm/(2*view.zoom),state.widthMm/view.zoom,state.heightMm/view.zoom].join(' '));$('#symbolZoomLabel').textContent=Math.round(view.zoom*100)+'%';$('#symbolZoomOut').disabled=view.zoom<=.25;$('#symbolZoomIn').disabled=view.zoom>=8;}
  const raw=e=>new DOMPoint(e.clientX,e.clientY).matrixTransform(canvas.getScreenCTM().inverse());
  function point(e,spacing=+$('#shapeGrid').value){const p=raw(e),bound=(n,half)=>Math.max(Math.ceil(-half/spacing)*spacing,Math.min(Math.floor(half/spacing)*spacing,Math.round(n/spacing)*spacing));return{x:bound(p.x,state.widthMm/2),y:bound(p.y,state.heightMm/2)};}
  function zoomAt(factor,e){if(blocked()||gesture||pointers.size)return;const r=canvas.getBoundingClientRect(),anchor=e||{clientX:r.x+r.width/2,clientY:r.y+r.height/2},before=raw(anchor);view.zoom=Math.max(.25,Math.min(8,view.zoom*factor));applyView();const after=raw(anchor);view.x+=before.x-after.x;view.y+=before.y-after.y;applyView();}
  function fit(){cancelInput();view={x:0,y:0,zoom:1};applyView();status('Symbol fitted to view');}
  function hit(o){let d;if(o.name)d=`M${o.x-.01} ${o.y}h.02`;else if(o.type==='line')d=`M${o.x1} ${o.y1}L${o.x2} ${o.y2}`;else if(o.type==='rect')d=`M${o.x} ${o.y}h${o.width}v${o.height}h${-o.width}Z`;else if(o.type==='circle')d=`M${o.cx-o.r} ${o.cy}a${o.r} ${o.r} 0 1 0 ${2*o.r} 0a${o.r} ${o.r} 0 1 0 ${-2*o.r} 0`;if(d)node('path',{d,fill:'none',stroke:'transparent','stroke-width':14,'vector-effect':'non-scaling-stroke','stroke-linecap':'round','pointer-events':'stroke','data-object-id':o.id,class:'symbol-hit'});}
  function cleanupTargets(){setTimeout(()=>{if(physical.size)return;keeper.replaceChildren();retained.clear();},0);}
  function render(){
    // Native Touch objects keep their original target, even after a redraw.
    // Keep that node attached until touchend has passed through the browser.
    for(const n of retained)if(canvas.contains(n))keeper.append(n);
    canvas.replaceChildren();applyView();canvas.dataset.activeTool=tool;
    const spacing=tool==='terminal'?4:+$('#shapeGrid').value;
    if(gridVisible){const defs=node('defs',{}),pattern=node('pattern',{id:'editorGrid',width:spacing,height:spacing,patternUnits:'userSpaceOnUse'},defs);node('path',{d:`M0 ${spacing}V0H${spacing}`,fill:'none',stroke:'#bdcbd4','stroke-width':.06},pattern);node('rect',{x:-state.widthMm/2,y:-state.heightMm/2,width:state.widthMm,height:state.heightMm,fill:'url(#editorGrid)','pointer-events':'none'});node('path',{d:`M${-state.widthMm/2} 0H${state.widthMm/2}M0 ${-state.heightMm/2}V${state.heightMm/2}`,fill:'none',stroke:'#8fa4b3','stroke-width':.12,'stroke-dasharray':'.4 .5','pointer-events':'none'});}
    format.draw(canvas,state);
    for(const t of state.terminals){node('circle',{cx:t.x,cy:t.y,r:.65,fill:'#07977e',stroke:'#fff','stroke-width':.15,'data-object-id':t.id});node('text',{x:t.x,y:t.y-1,'text-anchor':'middle','font-size':1.6,fill:'#0000FF','pointer-events':'none'}).textContent=':'+t.name;}
    all().forEach(hit);for(const n of canvas.querySelectorAll('[data-object-id]'))n.classList.toggle('selected',n.dataset.objectId===selected);
    const list=$('#objectList');list.replaceChildren();
    if(!all().length){const p=document.createElement('p');p.textContent='Draw a shape or place a terminal to begin.';list.append(p);}
    for(const o of all()){const b=document.createElement('button');b.type='button';b.className='object'+(selected===o.id?' selected':'');b.dataset.objectId=o.id;b.setAttribute('aria-pressed',String(selected===o.id));b.textContent=o.type==='text'?'Text: '+o.text:o.name?'Terminal: '+o.name:o.type[0].toUpperCase()+o.type.slice(1);b.onclick=()=>{cancelInput();selected=o.id;tool='select';render();};list.append(b);}
    const form=$('#inspector');form.replaceChildren();const o=find();$('#inspectorEmpty').hidden=Boolean(o);
    if(o){const keys=o.name?['name','x','y']:({line:['x1','y1','x2','y2'],rect:['x','y','width','height'],circle:['cx','cy','r'],text:['x','y','text','fontSize']}[o.type]);
      for(const key of keys){const label=document.createElement('label');label.textContent=({name:'Terminal name',x:'X (mm)',y:'Y (mm)',x1:'Start X (mm)',y1:'Start Y (mm)',x2:'End X (mm)',y2:'End Y (mm)',cx:'Centre X (mm)',cy:'Centre Y (mm)',r:'Radius (mm)',width:'Width (mm)',height:'Height (mm)',text:'Text',fontSize:'Font size (mm)'})[key];const input=document.createElement('input');input.name=key;input.type=typeof o[key]==='number'?'number':'text';input.step=o.name&&['x','y'].includes(key)?'4':'.25';input.value=o[key];label.append(input);form.append(label);}
      const apply=document.createElement('button');apply.type='submit';apply.textContent='Apply object';form.append(apply);
      form.onsubmit=e=>{e.preventDefault();if(blocked())return;const before=snapshot();for(const key of keys)o[key]=typeof o[key]==='number'?+form.elements[key].value:form.elements[key].value;try{state=format.validate(state);record(before);render();status('Object updated');}catch(error){state=JSON.parse(before);render();status(error.message);}};
    }
    document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===tool);b.setAttribute('aria-pressed',String(b.dataset.tool===tool));});$('#undoSymbol').disabled=!undo.length||loading;$('#redoSymbol').disabled=!redo.length||loading;$('#deleteObject').disabled=!selected||loading;$('#clearSymbol').disabled=!all().length||loading;
    $('#objectCount').textContent=all().length;$('#symbolObjectCount').textContent=state.geometry.length+' shapes · '+state.terminals.length+' terminals';$('#symbolGridToggle').setAttribute('aria-pressed',String(gridVisible));
    for(const n of document.querySelectorAll('.editor-panel-body input,.editor-panel-body select,[data-tool],#openProposal,#saveProposal,#savePreview'))n.disabled=loading;
  }
  function setTool(value){cancelInput();tool=value;render();status(value==='terminal'?'Tap a 4 mm grid point to add a terminal':value==='pan'?'Drag to pan · two fingers pan and zoom in every tool':'Tool: '+value);}
  document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
  const contact=e=>({clientX:e.clientX,clientY:e.clientY,type:e.pointerType});
  function pair(){const values=[...pointers.values()].slice(0,2),a=values[0],b=values[1]||a;return{clientX:(a.clientX+b.clientX)/2,clientY:(a.clientY+b.clientY)/2,distance:values.length>1?Math.max(1,Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY)):0};}
  function rebase(){if(!pointers.size){navigation=null;return;}const p=pair();navigation={view:{...view},start:p,world:raw(p)};}
  function navigate(){if(!navigation)return;const p=pair(),n=navigation;view={...n.view,zoom:Math.max(.25,Math.min(8,n.view.zoom*(n.start.distance&&p.distance?p.distance/n.start.distance:1)))};applyView();const after=raw(p);view.x+=n.world.x-after.x;view.y+=n.world.y-after.y;applyView();}
  function capture(id){try{canvas.setPointerCapture(id);}catch{}}
  canvas.addEventListener('pointerdown',e=>{
    if(blocked()||![0,1].includes(e.button))return;physical.add(e.pointerId);if(e.target!==canvas)retained.add(e.target);
    if(e.pointerType==='touch'&&[...pointers.values()].some(p=>p.type==='pen')){ignored.add(e.pointerId);return;}
    e.preventDefault();canvas.focus({preventScroll:true});
    if(e.pointerType==='pen'&&pointers.size){cancelGesture();for(const id of pointers.keys())ignored.add(id);pointers.clear();navigation=null;render();}
    pointers.set(e.pointerId,contact(e));capture(e.pointerId);
    if(pointers.size>1){cancelGesture();render();rebase();return;}
    if(tool==='pan'||e.button===1){rebase();return;}
    const p=point(e,tool==='terminal'?4:+$('#shapeGrid').value),before=snapshot(),selection=selected,nextTerminalName=$('#terminalName').value,id=crypto.randomUUID();
    if(tool==='select'){selected=e.target.closest('[data-object-id]')?.dataset.objectId||null;const o=find();if(o)gesture={before,selection,start:point(e,o.name?4:+$('#shapeGrid').value),object:clone(o),id:o.id,pointerId:e.pointerId};render();return;}
    if(tool==='terminal'||tool==='text'){
      if(tool==='terminal'){const name=$('#terminalName').value.trim();if(!name||state.terminals.some(t=>t.name===name)){status('Choose a unique terminal name');return;}state.terminals.push({id,name,...p});if(/^\d+$/.test(name))$('#terminalName').value=String(+name+1);}
      else state.geometry.push({id,type:'text',...p,text:$('#insertText').value,fontSize:2});
      selected=id;gesture={before,selection,nextTerminalName,id,pointerId:e.pointerId,placed:true};render();return;
    }
    const o=tool==='line'?{id,type:tool,x1:p.x,y1:p.y,x2:p.x,y2:p.y}:tool==='rect'?{id,type:tool,...p,width:0,height:0}:{id,type:'circle',cx:p.x,cy:p.y,r:0};state.geometry.push(o);selected=id;gesture={before,selection,start:p,id,creating:true,pointerId:e.pointerId};render();
  });
  canvas.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId)||ignored.has(e.pointerId))return;if(blocked()){cancelInput();return;}e.preventDefault();pointers.set(e.pointerId,contact(e));if(navigation){navigate();return;}
    if(!gesture||gesture.pointerId!==e.pointerId||gesture.placed)return;const o=find(),p=point(e,o.name?4:+$('#shapeGrid').value),s=gesture.start;
    if(gesture.creating){if(o.type==='line'){o.x2=p.x;o.y2=p.y;}else if(o.type==='rect'){o.x=Math.min(s.x,p.x);o.y=Math.min(s.y,p.y);o.width=Math.abs(p.x-s.x);o.height=Math.abs(p.y-s.y);}else o.r=Math.min(Math.hypot(p.x-s.x,p.y-s.y),state.widthMm/2-Math.abs(o.cx),state.heightMm/2-Math.abs(o.cy));}
    else{const dx=p.x-s.x,dy=p.y-s.y,old=gesture.object;for(const key of ['x','x1','x2','cx'])if(key in o)o[key]=old[key]+dx;for(const key of ['y','y1','y2','cy'])if(key in o)o[key]=old[key]+dy;}
    render();
  });
  function finish(e,cancelled=false){
    if(ignored.delete(e.pointerId))return;if(!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);
    if(gesture?.pointerId===e.pointerId){const g=gesture;gesture=null;if(cancelled){state=JSON.parse(g.before);selected=g.selection;if(g.nextTerminalName!==undefined)$('#terminalName').value=g.nextTerminalName;}else try{state=format.validate(state);record(g.before);status(g.placed?'Object placed':'Drawing updated');}catch(error){state=JSON.parse(g.before);selected=g.selection;if(g.nextTerminalName!==undefined)$('#terminalName').value=g.nextTerminalName;status(error.message);}render();}
    if(navigation)rebase();release(e.pointerId);
  }
  canvas.addEventListener('pointerup',e=>finish(e));canvas.addEventListener('pointercancel',e=>finish(e,true));
  for(const name of ['pointerup','pointercancel'])window.addEventListener(name,e=>{physical.delete(e.pointerId);cleanupTargets();},true);canvas.addEventListener('lostpointercapture',e=>finish(e,true));window.addEventListener('blur',()=>{physical.clear();cancelInput();cleanupTargets();});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('wheel',e=>{if(blocked()||pointers.size)return;e.preventDefault();const k=e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1,dx=e.deltaX*k,dy=e.deltaY*k;if(e.ctrlKey||e.metaKey)zoomAt(Math.exp(-dy*.002),e);else{const m=canvas.getScreenCTM();view.x+=(e.shiftKey&&!dx?dy:dx)/m.a;view.y+=(e.shiftKey&&!dx?0:dy)/m.d;applyView();}},{passive:false});
  for(const name of ['gesturestart','gesturechange','gestureend'])canvas.addEventListener(name,e=>e.preventDefault(),{passive:false});
  $('#symbolZoomOut').onclick=()=>zoomAt(1/1.25);$('#symbolZoomIn').onclick=()=>zoomAt(1.25);$('#symbolFit').onclick=fit;
  function toggleGrid(){gridVisible=!gridVisible;render();}$('#symbolGridToggle').onclick=toggleGrid;$('#shapeGrid').onchange=()=>render();
  function remove(){cancelInput();if(!selected)return;const before=snapshot();state.geometry=state.geometry.filter(o=>o.id!==selected);state.terminals=state.terminals.filter(o=>o.id!==selected);selected=null;record(before);render();}
  $('#deleteObject').onclick=remove;$('#undoSymbol').onclick=()=>history(true);$('#redoSymbol').onclick=()=>history(false);
  $('#clearSymbol').onclick=()=>{cancelInput();const before=snapshot();state.geometry=[];state.terminals=[];selected=null;record(before);render();};
  function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.hidden=true;document.body.append(a);try{a.click();}finally{setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},60000);}}
  function exportSymbol(svg){cancelInput();const before=snapshot();try{readFields();record(before);render();download(svg?format.svgText(state):JSON.stringify(format.validate(state),null,2),state.id+(svg?'.svg':'.cabel-symbol.json'),svg?'image/svg+xml':'application/json');status(svg?'SVG preview downloaded':'Symbol proposal downloaded');}catch(e){state=JSON.parse(before);syncFields();status(e.message);}}
  $('#saveProposal').onclick=()=>exportSymbol(false);$('#savePreview').onclick=()=>exportSymbol(true);
  $('#openProposal').onclick=()=>$('#proposalFile').click();$('#proposalFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;cancelInput();loading=true;render();try{if(file.size>2*1024*1024)throw Error('File is too large');const next=format.validate(JSON.parse(await file.text())),before=snapshot();state=next;selected=null;view={x:0,y:0,zoom:1};record(before);syncFields();status('Symbol proposal opened');}catch(error){status(error.message);}finally{loading=false;render();e.target.value='';}};
  document.addEventListener('keydown',e=>{if(blocked()||e.target.closest('input,textarea,select,[contenteditable]')||e.altKey)return;const key=e.key.toLowerCase();if(e.ctrlKey||e.metaKey){if(key==='z'||key==='y'){e.preventDefault();history(key==='z'&&!e.shiftKey);}return;}if(key==='delete'||key==='backspace'){e.preventDefault();remove();}if(key==='escape'){e.preventDefault();cancelInput();selected=null;setTool('select');}if(key==='f'){e.preventDefault();fit();}if(key==='g'){e.preventDefault();toggleGrid();}const tools={v:'select',h:'pan',l:'line',b:'rect',o:'circle',p:'terminal',t:'text'};if(tools[key]){e.preventDefault();setTool(tools[key]);}});
  try{const draft=localStorage.getItem('cabel-symbol-draft');if(draft)state=format.validate(JSON.parse(draft));}catch{$('#symbolDraftStatus').textContent='Local draft unavailable · use Download JSON';}
  if(matchMedia('(max-width:680px)').matches)for(const id of ['symbolInfoPanel','symbolObjectsPanel'])$('#'+id).open=false;
  CabelSettings.init({blocked:()=>loading,buttonHost:$('.editor-actions'),beforeOpen:cancelInput,shortcutSections:['Symbol editor keyboard'],appearanceNote:'Choose the look of your symbol workspace. The drawing canvas stays white in both modes.',localNote:'Shared with the schematic editor in this browser. Your proposal, geometry and SVG export keep their original colours.',shortcutIntro:'Shortcuts for this symbol editor. Ctrl/⌘ means Control on Windows/Linux or Command on Mac. Inputs keep normal text editing; Tab moves between controls. Arrow Left/Right or Home/End switches Settings tabs.'});
  syncFields();render();
})();
