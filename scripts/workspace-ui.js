/* Native Touch Events own finger gestures on iPad. Document edits reuse the
   editor's pointer handlers through marked events, without pointer capture. */
globalThis.CabelWorkspaceUI = {
  init(api) {
    const $=s=>document.querySelector(s),svg=api.svg,ink=api.redPen,app=$('.app'),header=$('header');
    let hand=false,placement=null,focusRequested=false,nativeAvailable=true;
    let finger=null,pen=null,holdTimer=null,sourceHold=null,ghost=null,viewRefreshFrame=null;
    let suppressCanvasClickUntil=0,suppressSource=null,controlContact=null;
    const ignoredTouches=new Set(),pendingControls=new WeakMap(),fallbackClicks=new WeakMap();
    // Safari keeps a Touch's original DOM target for its whole lifetime. Keep
    // replaced hit targets attached until release so redraws cannot lose moves.
    const retainedTargets=new Set(),targetKeeper=document.createElement('div');
    targetKeeper.className='input-target-keeper';targetKeeper.setAttribute('aria-hidden','true');document.body.append(targetKeeper);
    function rememberTarget(node){retainedTargets.add(node.closest?.('#parts > g,#wires > path,#wires > g,[data-aks-area]')||node);}
    function retainTargets(){for(const node of retainedTargets)if(!node.isConnected)targetKeeper.append(node);}
    function clearTargets(){for(const node of retainedTargets)if(node.parentNode===targetKeeper)node.remove();retainedTargets.clear();}
    const appbar=document.createElement('div');appbar.className='workspace-appbar';appbar.append(...header.children);header.append(appbar);
    const toolbar=document.createElement('div');toolbar.id='workspaceToolbar';toolbar.className='workspace-toolbar';
    toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Drawing and editing');
    const utility=document.createElement('div');utility.className='workspace-utility';header.append(toolbar,utility);
    const group=label=>{const n=document.createElement('div');n.className='tool-group';n.setAttribute('role','group');n.setAttribute('aria-label',label);toolbar.append(n);return n;};
    const icons={
      select:'M4 3v16l4-5 4 7 3-2-4-6 7-1z',
      pan:'M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4',
      horizontal:'M2 12h20M6 8l-4 4 4 4M18 8l4 4-4 4M12 3v3M12 18v3',
      vertical:'M12 2v20M8 6l4-4 4 4M8 18l4 4 4-4M3 12h3M18 12h3',
      fullscreen:'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6',
      pen:'M4 17l-1 4 4-1L21 6l-3-3zM15 6l3 3'
    };
    function labelButton(node,label,icon){
      node.replaceChildren();
      if(icon){const g=document.createElementNS('http://www.w3.org/2000/svg','svg');g.setAttribute('viewBox','0 0 24 24');g.setAttribute('aria-hidden','true');g.classList.add('control-icon');const p=document.createElementNS(g.namespaceURI,'path');p.setAttribute('d',icons[icon]);g.append(p);node.append(g);}
      const text=document.createElement('span');text.textContent=label;node.append(text);
    }
    const button=(id,label,title,parent,action,icon)=>{const n=document.createElement('button');n.type='button';n.id=id;n.className='tool-button';n.title=title||label;n.setAttribute('aria-label',title||label);labelButton(n,label,icon);n.onclick=action;parent.append(n);return n;};
    const history=group('History');
    const undo=button('undoBtn','Undo','Undo last change',history,()=>api.action('undo'));
    const redo=button('redoBtn','Redo','Redo last change',history,()=>api.action('redo'));
    const modes=group('Drawing tools');modes.append($('#selectTool'),$('#wireTool'),$('#aksAreaTool'));
    for(const node of modes.children)node.classList.add('tool-button');
    $('#bridgeTool').hidden=true;labelButton($('#selectTool'),'Select','select');labelButton($('#aksAreaTool'),'Field');
    const handButton=button('panTool','Pan','Drag to pan with a finger, Pencil or mouse',modes,()=>{ink.setTool(null);hand=!hand;placement=null;api.cancel();refresh();},'pan');
    const redButton=button('redPenTool','Red pen','Freehand annotations: draw, erase or select strokes',modes,()=>{const enable=!ink.active();ink.setTool(null);hand=false;placement=null;api.cancel();ink.setTool(enable?'draw':null);refresh();},'pen');
    const redTools=group('Red pen tools');redTools.id='redPenTools';
    for(const[id,label,tool]of[['redPenDraw','Draw','draw'],['redPenErase','Erase stroke','erase'],['redPenSelect','Select strokes','select']])button(id,label,label,redTools,()=>ink.setTool(tool));
    const smaller=button('redPenSmaller','Smaller','Scale selected strokes to 80%',redTools,()=>ink.resize(.8));
    const larger=button('redPenLarger','Larger','Scale selected strokes to 125%',redTools,()=>ink.resize(1.25));
    const deleteStrokes=button('redPenDelete','Delete strokes','Delete selected strokes',redTools,()=>ink.removeSelected());
    const editing=group('Selection actions');
    const properties=button('propertiesBtn','Properties','Edit selection or page properties',editing,()=>api.editSelection());
    for(const[id,label,title,action,icon]of[
      ['rotateBtn','Rotate','Rotate selected object by 90°','rotate'],
      ['mirrorXBtn','Mirror H','Mirror horizontally','flipX','horizontal'],['mirrorYBtn','Mirror V','Mirror vertically','flipY','vertical'],
      ['copyBtn','Copy','Copy selected object','copy'],['cutBtn','Cut','Cut selected object','cut'],['pasteBtn','Paste','Paste copied object','paste'],
      ['deleteBtn','Delete','Remove selection from the drawing','delete'],['textBtn','Text','Insert text annotation','text']
    ])button(id,label,title,editing,()=>api.action(action),icon);
    const cancel=button('cancelActionBtn','Cancel','Cancel placement or drawing tool',editing,()=>{ink.setTool(null);placement=null;hand=false;clearHold();removeGhost();api.cancel();refresh();});
    api.nav.append($('#pagePropertiesBtn'),$('#projectInfoBtn'),$('#autoLists'));utility.append(api.nav,$('.zoom-controls'));
    for(const[id,title]of[['sheetPrev','Previous sheet'],['sheetNext','Next sheet'],['sheetCurrent','Show sheets'],['fitBtn','Fit the whole page']]){$('#'+id).title=title;$('#'+id).setAttribute('aria-label',title);}
    $('#saveBtn .wide').textContent='Save';$('.sidebar').id='componentSidebar';app.dataset.libraryOpen=app.dataset.overviewOpen='true';
    const tools=$('.tools');
    const fullscreenButton=button('fullscreenBtn','Full screen','Enter or restore full screen',tools,enterFullscreen,'fullscreen');
    const exitButton=button('exitFullscreenBtn','Exit…','Leave full screen',tools,()=>api.confirmFullscreenExit(leaveFullscreen));
    $('#sheetCurrent').onclick=()=>{$('[data-overview="sheets"]')?.click();};
    $('.hint').textContent='Select: drag objects or an empty-paper selection box. Connect: tap ports and route points. Pan: drag the paper. Two fingers pan and zoom in every mode. Red pen: draw freely, erase whole strokes, or select and resize them. Drag library components sideways onto the paper, or tap then place. Right-click edits properties on desktop.';
    $('#statusText').setAttribute('role','status');$('#statusText').setAttribute('aria-live','polite');

    function fullscreenElement(){return document.fullscreenElement||document.webkitFullscreenElement;}
    function isStandalone(){return navigator.standalone===true||matchMedia('(display-mode:standalone)').matches;}
    // Native fullscreen and viewport changes can finish after the initial
    // layout. Reapply the same camera on the next paint, without resetting it.
    function refreshViewport(){
      cancelAnimationFrame(viewRefreshFrame);
      viewRefreshFrame=requestAnimationFrame(()=>{viewRefreshFrame=null;if(!api.state().exporting)api.refreshView();});
    }
    async function enterFullscreen(){
      focusRequested=true;app.classList.add('focus-mode');refresh();
      const enter=document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen;
      if(!fullscreenElement()&&!isStandalone()&&enter){try{await enter.call(document.documentElement);}catch{nativeAvailable=false;}}
      else if(!enter)nativeAvailable=false;
      refresh();refreshViewport();
    }
    async function leaveFullscreen(){
      focusRequested=false;app.classList.remove('focus-mode');const exit=document.exitFullscreen||document.webkitExitFullscreen;
      if(fullscreenElement()&&exit){try{await exit.call(document);}catch{/* Keep the normal workspace usable. */}}refresh();refreshViewport();
    }
    // A system gesture can exit Safari fullscreen. Preserve the workspace;
    // re-entry requires a fresh user action under the browser's own rules.
    for(const name of['fullscreenchange','webkitfullscreenchange'])document.addEventListener(name,()=>{app.classList.toggle('focus-mode',focusRequested);refresh();refreshViewport();});
    window.addEventListener('resize',refreshViewport);
    if(globalThis.ResizeObserver)new ResizeObserver(refreshViewport).observe(svg);

    const point=e=>({x:e.clientX,y:e.clientY}),stop=e=>{if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();};
    const inCanvas=n=>n instanceof Element&&Boolean(n.closest('#sheet'));
    const capture=id=>{try{svg.setPointerCapture(id);}catch{/* Touch Events need no capture. */}};
    const release=id=>{if(svg.hasPointerCapture(id))svg.releasePointerCapture(id);};
    function forward(type,target,p,id,inputType='touch'){
      const e=new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:inputType,isPrimary:true,button:0,buttons:type==='pointerup'||type==='pointercancel'?0:1,clientX:p.x,clientY:p.y,pressure:type==='pointerup'?0:.5});
      Object.defineProperty(e,'__leitwerkInput',{value:true});target.dispatchEvent(e);
    }
    function clearHold(){clearTimeout(holdTimer);holdTimer=null;}
    function startHold(session){
      if(session.kind!=='edit'||api.state().mode!=='select'||api.state().fieldDrawing)return;
      holdTimer=setTimeout(()=>{if(session!==finger&&session!==pen)return;session.kind='handled';api.cancelPointer(session.checkpoint);api.editTarget(session.target);suppressCanvasClickUntil=performance.now()+1000;release(session.id);},550);
    }
    function sourceAt(target){
      const node=target.closest?.('.part[data-type],.catalog-part[data-catalog-product],.part[data-custom-symbol],.device-jump,.pin-node');if(!node)return null;
      let payload;if(node.dataset.type)payload={kind:'component',type:node.dataset.type};else if(node.dataset.catalogProduct)payload={kind:'product',key:node.dataset.catalogProduct};
      else if(node.dataset.customSymbol)payload={kind:'symbol',id:node.dataset.customSymbol};else if(node.dataset.pinPart)payload={kind:'pin',id:node.dataset.pinPart,index:Number(node.dataset.pinIndex)};
      else payload={kind:'device',id:node.closest('[data-device-id]')?.dataset.deviceId};
      return{node,payload,label:node.querySelector('.part-name,strong')?.textContent||node.textContent.trim()};
    }
    function queueSource(source){ink.setTool(null);api.cancel();api.preparePlacement();hand=false;placement=source;suppressSource={node:source.node,until:performance.now()+1000};refresh();}
    function removeGhost(){ghost?.remove();ghost=null;delete svg.dataset.dropValid;clearTimeout(sourceHold);sourceHold=null;}
    function insideDrawing(p){const r=svg.getBoundingClientRect(),w=api.world({clientX:p.x,clientY:p.y});return p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom&&w.x>=0&&w.x<=1128&&w.y>=0&&w.y<=710;}
    function moveGhost(p){if(!ghost)return;ghost.style.left=p.x+14+'px';ghost.style.top=p.y+14+'px';svg.dataset.dropValid=String(insideDrawing(p));}
    function startSourceDrag(session){
      if(session.kind!=='source'||session.dragging)return;session.dragging=true;ink.setTool(null);api.preparePlacement();
      ghost=document.createElement('div');ghost.className='library-drag-ghost';ghost.textContent=session.source.label;document.body.append(ghost);moveGhost(session.last);
    }
    function finishSource(session,cancelled){
      clearTimeout(sourceHold);sourceHold=null;session.source.node.draggable=session.wasDraggable;suppressSource={node:session.source.node,until:performance.now()+1000};
      if(!cancelled){if(session.dragging){if(insideDrawing(session.last)){api.cancel();api.place(session.source.payload,api.world({clientX:session.last.x,clientY:session.last.y}));placement=null;}}else queueSource(session.source);}
      removeGhost();refresh();
    }
    function nearbyTerminal(p,type){
      let best=null,distance=type==='touch'?22:14;
      for(const n of svg.querySelectorAll('.terminal')){if(!api.terminal(n))continue;const matrix=n.getScreenCTM();if(!matrix)continue;const q=new DOMPoint(n.cx.baseVal.value,n.cy.baseVal.value).matrixTransform(matrix),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<=distance){best=n;distance=d;}}return best;
    }
    function connectAt(p,type){const terminal=nearbyTerminal(p,type);if(terminal)api.connect(terminal);else{forward('pointerdown',svg,p,700001,type);forward('pointerup',svg,p,700001,type);}}
    function makeSession(id,p,target,type,options={}){
      const state=api.state(),kind=hand?'pan':placement?'placement':ink.active()?'redpen':state.mode==='wire'||state.mode==='bridge'?'connect':state.fieldDrawing||!state.generated&&target.closest('#parts,#wires,.aks-field-handle')?'edit':target.closest('[role="button"],.page-reference,.relay-symbol-link,.terminal-cross-reference,.screen-only')?'link':state.generated?'handled':'edit';
      const s={id,type,kind,target,start:{...p},last:{...p},moved:false,checkpoint:kind==='edit'?api.checkpoint():null};
      if(kind==='edit')forward('pointerdown',target,p,id,type);else if(kind==='redpen')ink.begin(p,target,{shift:options.shiftKey});return s;
    }
    function center(contacts){
      const points=[...contacts.values()],p={x:points.reduce((n,v)=>n+v.x,0)/points.length,y:points.reduce((n,v)=>n+v.y,0)/points.length},q=api.svgPoint({clientX:p.x,clientY:p.y});
      // SVGPoint/DOMPoint coordinates are inherited accessors; object spread
      // drops them and would turn pan/zoom anchors into NaN.
      return{x:q.x,y:q.y,distance:points[1]?Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y):0};
    }
    function rebase(session,contacts){const c=center(contacts),v=api.view();session.navigation={zoom:v.zoom,distance:c.distance,anchor:{x:(c.x-v.pan.x-564*(1-v.zoom))/v.zoom,y:(c.y-v.pan.y-399*(1-v.zoom))/v.zoom}};}
    function navigate(session,contacts){const c=center(contacts),n=session.navigation;if(!n)return;const z=Math.max(.5,Math.min(4,n.zoom*(n.distance&&c.distance?c.distance/n.distance:1)));api.setView({zoom:z,pan:{x:c.x-564*(1-z)-n.anchor.x*z,y:c.y-399*(1-z)-n.anchor.y*z}});}
    function zoomAt(p,factor){const c=api.svgPoint({clientX:p.x,clientY:p.y}),v=api.view(),w=api.world({clientX:p.x,clientY:p.y}),z=Math.max(.5,Math.min(4,v.zoom*factor));api.setView({zoom:z,pan:{x:c.x-564*(1-z)-w.x*z,y:c.y-399*(1-z)-w.y*z}});}
    $('#zoomIn').onclick=()=>{const r=svg.getBoundingClientRect();zoomAt({x:r.left+r.width/2,y:r.top+r.height/2},1.15);};
    $('#zoomOut').onclick=()=>{const r=svg.getBoundingClientRect();zoomAt({x:r.left+r.width/2,y:r.top+r.height/2},1/1.15);};
    document.addEventListener('wheel',e=>{if(!inCanvas(e.target)||api.state().modalOpen)return;if(e.ctrlKey||e.metaKey){stop(e);zoomAt(point(e),e.deltaY<0?1.1:1/1.1);}},{capture:true,passive:false});
    function armControl(id,node,p){if(!node||node.disabled)return;const old=pendingControls.get(node);if(old)old.handled=true;fallbackClicks.delete(node);controlContact={id,node,p,handled:false,moved:false};}
    function finishControl(id,p,cancelled){
      if(controlContact?.id!==id)return;const c=controlContact;controlContact=null;
      if(cancelled||c.moved)return;pendingControls.set(c.node,c);
      setTimeout(()=>{if(c.handled||!c.node.isConnected||c.node.disabled||document.elementFromPoint(p.x,p.y)?.closest('button')!==c.node)return;pendingControls.delete(c.node);fallbackClicks.set(c.node,performance.now()+800);c.node.click();},80);
    }
    function touchContacts(e){const result=new Map();for(const t of Array.from(e.touches)){if(t.touchType==='stylus'||ignoredTouches.has(t.identifier))continue;if(inCanvas(t.target)||finger?.contacts?.has(t.identifier))result.set(t.identifier,point(t));}return result;}
    function beginPinch(session,contacts){clearHold();if(session.kind==='edit')api.cancelPointer(session.checkpoint,true);else if(session.kind==='redpen')ink.cancel();session.kind='pinch';session.moved=true;session.contacts=contacts;rebase(session,contacts);}
    document.addEventListener('touchstart',e=>{
      if(api.state().modalOpen||api.state().exporting)return;
      const changed=Array.from(e.changedTouches).filter(t=>t.touchType!=='stylus');if(!changed.length)return;
      if(pen){if(changed.some(t=>inCanvas(t.target))){for(const t of changed)ignoredTouches.add(t.identifier);stop(e);}return;}
      const t=changed[0],p=point(t),target=document.elementFromPoint(p.x,p.y)||t.target;
      if(!finger){
        const source=sourceAt(target);
        if(source){rememberTarget(source.node);finger={kind:'source',id:t.identifier,type:'touch',source,start:p,last:p,moved:false,wasDraggable:source.node.draggable};source.node.draggable=false;sourceHold=setTimeout(()=>{if(finger?.kind==='source')startSourceDrag(finger);},280);return;}
        if(!inCanvas(target)){armControl(t.identifier,target.closest('button'),p);return;}
        stop(e);rememberTarget(t.target);finger=makeSession(800000+t.identifier,p,target,'touch');finger.touchId=t.identifier;finger.contacts=new Map([[t.identifier,p]]);finger.contacts=touchContacts(e);retainTargets();
        if(finger.contacts.size>1)beginPinch(finger,finger.contacts);else{rebase(finger,finger.contacts);startHold(finger);}return;
      }
      if(finger.kind==='source'){stop(e);finishSource(finger,true);finger=null;for(const x of changed)ignoredTouches.add(x.identifier);return;}
      const contacts=touchContacts(e);if(contacts.size>1){stop(e);beginPinch(finger,contacts);}
    },{capture:true,passive:false});
    document.addEventListener('touchmove',e=>{
      if(controlContact){const t=Array.from(e.touches).find(t=>t.identifier===controlContact.id);if(t&&Math.hypot(t.clientX-controlContact.p.x,t.clientY-controlContact.p.y)>8)controlContact.moved=true;}
      if(!finger){if(Array.from(e.touches).some(t=>ignoredTouches.has(t.identifier)))stop(e);return;}
      if(finger.kind==='source'){
        const t=Array.from(e.touches).find(t=>t.identifier===finger.id);if(!t)return;finger.last=point(t);
        const dx=finger.last.x-finger.start.x,dy=finger.last.y-finger.start.y;
        if(!finger.dragging&&Math.abs(dy)>9&&Math.abs(dy)>Math.abs(dx)){const old=finger;finger=null;clearTimeout(sourceHold);old.source.node.draggable=old.wasDraggable;return;}
        if(!finger.dragging&&Math.abs(dx)>8)startSourceDrag(finger);if(finger.dragging){stop(e);moveGhost(finger.last);}return;
      }
      stop(e);const contacts=touchContacts(e);if(!contacts.size)return;
      if(contacts.size>1&&finger.kind!=='pinch')beginPinch(finger,contacts);
      finger.contacts=contacts;const p=contacts.get(finger.touchId)||contacts.values().next().value;finger.last=p;
      if(Math.hypot(p.x-finger.start.x,p.y-finger.start.y)>6){finger.moved=true;clearHold();}
      if(finger.kind==='edit'){forward('pointermove',svg,p,finger.id);retainTargets();}
      else if(finger.kind==='redpen'){ink.move(p);retainTargets();}
      else if(finger.kind==='pan'||finger.kind==='pinch')navigate(finger,contacts);
      else if(finger.kind==='connect')forward('pointermove',svg,p,finger.id);
    },{capture:true,passive:false});
    function finishTouch(e,cancelled){
      for(const t of Array.from(e.changedTouches)){ignoredTouches.delete(t.identifier);finishControl(t.identifier,point(t),cancelled);}
      if(!finger){if(!ignoredTouches.size)clearTargets();return;}
      if(finger.kind==='source'){const t=Array.from(e.changedTouches).find(t=>t.identifier===finger.id);if(!t)return;stop(e);finger.last=point(t);const old=finger;finger=null;finishSource(old,cancelled);clearTargets();return;}
      stop(e);clearHold();suppressCanvasClickUntil=performance.now()+1000;
      const contacts=touchContacts(e);
      if(contacts.size){if(finger.kind==='edit')api.cancelPointer(finger.checkpoint,true);else if(finger.kind==='redpen')ink.cancel();finger.kind='pan';finger.contacts=contacts;finger.touchId=contacts.keys().next().value;rebase(finger,contacts);return;}
      const old=finger,ended=Array.from(e.changedTouches).find(t=>t.identifier===old.touchId);finger=null;if(ended)old.last=point(ended);
      if(old.kind==='edit'){if(cancelled)api.cancelPointer(old.checkpoint);else forward('pointerup',svg,old.last,old.id);}
      else if(old.kind==='redpen'){if(cancelled)ink.cancel();else ink.end(old.last);}
      else if(!cancelled&&!old.moved){
        if(old.kind==='placement'&&placement&&insideDrawing(old.last)){const source=placement;placement=null;api.place(source.payload,api.world({clientX:old.last.x,clientY:old.last.y}));refresh();}
        else if(old.kind==='connect')connectAt(old.last,'touch');else if(old.kind==='link')old.target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:old.last.x,clientY:old.last.y}));
      }
      clearTargets();
    }
    document.addEventListener('touchend',e=>finishTouch(e,false),{capture:true,passive:false});
    document.addEventListener('touchcancel',e=>finishTouch(e,true),{capture:true,passive:false});
    for(const name of['gesturestart','gesturechange','gestureend'])document.addEventListener(name,e=>{if(!api.state().modalOpen&&(finger||inCanvas(e.target)))stop(e);},{capture:true,passive:false});
    document.addEventListener('contextmenu',e=>{if(finger||pen)stop(e);},true);

    document.addEventListener('pointerdown',e=>{
      if(e.__leitwerkInput||!(e.target instanceof Element))return;
      if(e.pointerType==='touch'){if(inCanvas(e.target))e.stopImmediatePropagation();return;}
      if(e.pointerType==='mouse')suppressSource=null;
      const state=api.state();if(state.modalOpen||state.exporting||(e.pointerType==='mouse'?e.button!==0:e.button>0))return;
      const source=e.pointerType==='pen'&&sourceAt(e.target);
      if(source){stop(e);clearHold();pen={kind:'source',id:e.pointerId,type:'pen',source,start:point(e),last:point(e),wasDraggable:source.node.draggable};source.node.draggable=false;capture(e.pointerId);return;}
      if(!inCanvas(e.target)){if(e.pointerType==='pen')armControl(e.pointerId,e.target.closest('button'),point(e));return;}
      if(e.pointerType==='mouse'&&!hand&&!ink.active())return;
      stop(e);clearHold();
      if(finger){if(finger.kind==='edit')api.cancelPointer(finger.checkpoint,true);else if(finger.kind==='redpen')ink.cancel();for(const id of finger.contacts?.keys()||[])ignoredTouches.add(id);finger=null;}
      pen=makeSession(e.pointerId,point(e),e.target,e.pointerType,e);capture(e.pointerId);rebase(pen,new Map([[pen.id,pen.start]]));startHold(pen);
    },{capture:true,passive:false});
    document.addEventListener('pointermove',e=>{
      if(e.__leitwerkInput)return;if(e.pointerType==='touch'){if(inCanvas(e.target))e.stopImmediatePropagation();return;}
      if(controlContact?.id===e.pointerId&&Math.hypot(e.clientX-controlContact.p.x,e.clientY-controlContact.p.y)>8)controlContact.moved=true;
      if(!pen||pen.id!==e.pointerId)return;
      stop(e);pen.last=point(e);if(Math.hypot(pen.last.x-pen.start.x,pen.last.y-pen.start.y)>6){pen.moved=true;clearHold();}
      if(pen.kind==='source'){if(pen.moved)startSourceDrag(pen);moveGhost(pen.last);}
      else if(pen.kind==='edit')forward('pointermove',svg,pen.last,pen.id,pen.type);
      else if(pen.kind==='redpen')ink.move(pen.last,e.getCoalescedEvents?.());
      else if(pen.kind==='pan')navigate(pen,new Map([[pen.id,pen.last]]));
      else if(pen.kind==='connect')forward('pointermove',svg,pen.last,pen.id,pen.type);
    },{capture:true,passive:false});
    function finishPen(e,cancelled){
      if(e.__leitwerkInput)return;if(e.pointerType==='touch'){if(inCanvas(e.target))e.stopImmediatePropagation();return;}
      finishControl(e.pointerId,point(e),cancelled);if(!pen||pen.id!==e.pointerId)return;
      stop(e);clearHold();const old=pen;pen=null;old.last=point(e);
      if(old.kind==='source')finishSource(old,cancelled);
      else if(old.kind==='edit'){if(cancelled)api.cancelPointer(old.checkpoint);else forward('pointerup',svg,old.last,old.id,old.type);}
      else if(old.kind==='redpen'){if(cancelled)ink.cancel();else ink.end(old.last);}
      else if(!cancelled){if(old.kind==='placement'&&placement&&insideDrawing(old.last)){const source=placement;placement=null;api.place(source.payload,api.world({clientX:old.last.x,clientY:old.last.y}));refresh();}else if(old.kind==='connect'&&!old.moved)connectAt(old.last,old.type);else if(old.kind==='link'&&!old.moved)old.target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));}
      suppressCanvasClickUntil=performance.now()+1000;release(old.id);
    }
    document.addEventListener('pointerup',e=>finishPen(e,false),{capture:true,passive:false});
    document.addEventListener('pointercancel',e=>finishPen(e,true),{capture:true,passive:false});
    document.addEventListener('click',e=>{
      if(e.__leitwerkInput||!(e.target instanceof Element))return;
      const n=e.target.closest('button'),pending=n&&pendingControls.get(n);if(pending){pending.handled=true;pendingControls.delete(n);}
      if(n&&e.isTrusted&&(fallbackClicks.get(n)||0)>performance.now()){stop(e);return;}
      if(suppressSource&&performance.now()<suppressSource.until&&suppressSource.node.contains(e.target)){stop(e);return;}
      if(e.isTrusted&&inCanvas(e.target)&&performance.now()<suppressCanvasClickUntil){stop(e);return;}
      if(e.target.closest('#selectTool,#wireTool,#aksAreaTool')){ink.setTool(null);hand=false;placement=null;queueMicrotask(refresh);}
    },true);
    document.addEventListener('keydown',e=>{
      if(api.state().modalOpen||e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
      if(e.key==='Escape'){placement=null;hand=false;clearHold();removeGhost();refresh();}
      else if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&['v','c','w','t'].includes(e.key.toLowerCase())){ink.setTool(null);hand=false;placement=null;queueMicrotask(refresh);}
    },true);
    window.addEventListener('blur',()=>{
      clearHold();if(finger?.kind==='edit')api.cancelPointer(finger.checkpoint);if(pen?.kind==='edit')api.cancelPointer(pen.checkpoint);
      if(finger?.kind==='source')finishSource(finger,true);if(pen?.kind==='source')finishSource(pen,true);
      ink.cancel();
      finger=null;pen=null;ignoredTouches.clear();removeGhost();controlContact=null;clearTargets();
    });
    function refresh(){
      retainTargets();const state=api.state(),connecting=state.mode==='wire'||state.mode==='bridge';handButton.setAttribute('aria-pressed',String(hand));
      const marking=ink.active();toolbar.classList.toggle('red-pen-mode',marking);redButton.setAttribute('aria-pressed',String(marking));redButton.disabled=state.generated||state.exporting;redTools.hidden=!marking;editing.hidden=marking;
      for(const[id,tool]of[['redPenDraw','draw'],['redPenErase','erase'],['redPenSelect','select']]){$('#'+id).setAttribute('aria-pressed',String(ink.tool()===tool));$('#'+id).disabled=state.generated||state.exporting;}
      smaller.disabled=larger.disabled=deleteStrokes.disabled=!ink.hasSelection()||ink.busy()||state.generated||state.exporting;
      $('#selectTool').setAttribute('aria-pressed',String(state.mode==='select'&&!hand&&!state.fieldDrawing&&!marking));$('#selectTool').classList.toggle('active',state.mode==='select'&&!hand&&!state.fieldDrawing&&!marking);
      const wire=$('#wireTool'),label=state.mode==='bridge'?'Bridge':state.connecting?'Wire':'Connect';if(wire.textContent!==label)labelButton(wire,label);
      wire.setAttribute('aria-label','Connect; automatically choose a wire or terminal bridge');wire.setAttribute('aria-pressed',String(connecting));wire.classList.toggle('active',connecting);wire.dataset.connectionKind=state.mode==='bridge'?'bridge':'wire';
      $('#aksAreaTool').setAttribute('aria-pressed',String(state.fieldDrawing));svg.dataset.hand=String(hand);svg.dataset.placement=String(Boolean(placement));
      for(const id of['rotateBtn','mirrorXBtn','mirrorYBtn','copyBtn','cutBtn'])$('#'+id).disabled=!state.partSelected||state.exporting;
      $('#deleteBtn').disabled=!state.hasSelection||state.exporting;$('#pasteBtn').disabled=!state.canPaste||state.exporting;
      undo.disabled=!state.canUndo||state.exporting;redo.disabled=!state.canRedo||state.exporting;properties.disabled=state.generated&&!state.hasSelection||state.exporting;
      cancel.hidden=!placement&&!state.connecting&&!state.fieldDrawing&&!hand;exitButton.hidden=!focusRequested;
      const native=Boolean(fullscreenElement())||isStandalone(),text=focusRequested&&!native&&nativeAvailable?'Resume full screen':'Full screen';
      if(fullscreenButton.textContent!==text)labelButton(fullscreenButton,text,'fullscreen');fullscreenButton.setAttribute('aria-pressed',String(focusRequested));app.dataset.nativeFullscreen=String(native);
      if(placement)api.status('Tap the paper to place '+placement.label+' · Cancel to finish');else if(hand)api.status('Pan: drag the paper · Two fingers: zoom');
      else if(marking)api.status(state.generated?'Red pen: open a drawing sheet':ink.tool()==='draw'?'Red pen: draw with a finger, Pencil or mouse · Two fingers: pan/zoom':ink.tool()==='erase'?'Red pen: touch a stroke to erase it completely':'Red pen: tap a stroke or drag a selection box · Drag corners to scale');
      svg.dataset.redPen=marking?ink.tool():'';
    }
    document.body.classList.add('workspace-ready');refresh();return{refresh,openOverview:()=>{}};
  }
};
