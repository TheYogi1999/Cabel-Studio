/* A local viewing preference changes presentation and input handling only.
   Cloud access roles and the drawing's page/data format stay independent. */
globalThis.CabelPhoneViewer={init(api){
  const $=s=>document.querySelector(s),body=document.body,svg=api.svg,media=matchMedia('(max-width:600px) and (pointer:coarse), (max-width:1000px) and (max-height:600px) and (pointer:coarse)'),storageKey='leitwerk.phone.mode';
  let preference='auto';try{preference=localStorage.getItem(storageKey)||'auto';}catch{}if(!['auto','viewer','editor'].includes(preference))preference='auto';
  let enabled=false,previousView=null,previousBox=null,frame=null,drawer=false,lastProject=null,viewportHeight=null;
  // Keep the initial device size: an on-screen keyboard must not turn a
  // tablet into a phone viewer while the user is editing a form.
  const deviceShortSide=Math.min(screen.width||innerWidth,screen.height||innerHeight),phoneScreen=()=>deviceShortSide<=600;
  const bar=document.createElement('div');bar.id='phoneViewerBar';bar.className='phone-view-controls';bar.innerHTML='<div class="phone-document"><strong id="phoneDocumentTitle"></strong><small id="phoneSheetTitle"></small><span>Leitwerk v'+api.version+'</span></div><div class="phone-actions"></div>';$('header').append(bar);
  const actions=bar.querySelector('.phone-actions');
  function button(id,label,parent,action){const b=document.createElement('button');b.type='button';b.id=id;b.className='tool-button';b.textContent=label;b.onclick=action;parent.append(b);return b;}
  function proxy(selector){menu.open=false;$(selector)?.click();}
  const projects=button('phoneProjectsBtn','Projects',actions,()=>proxy('#cloudProjectsBtn'));
  button('phoneOpenBtn','Open',actions,()=>proxy('#openBtn'));
  const sheets=button('phoneSheetsBtn','Sheets',actions,()=>showDrawer(!drawer));sheets.setAttribute('aria-expanded','false');sheets.setAttribute('aria-controls','sheetPanel');
  button('phoneEditorBtn','Editor',actions,()=>choose('editor'));
  const menu=document.createElement('details');menu.id='phoneViewerMenu';const menuTitle=document.createElement('summary');menuTitle.textContent='More';menuTitle.setAttribute('aria-label','More viewing actions');menu.append(menuTitle);actions.append(menu);const menuItems=document.createElement('div');menu.append(menuItems);
  button('phoneSaveBtn','Save JSON',menuItems,()=>proxy('#saveBtn'));button('phoneExportBtn','Export PDF',menuItems,()=>proxy('#exportBtn'));button('phoneFullscreenBtn','Full screen',menuItems,()=>proxy('#fullscreenBtn'));
  const toggle=button('phoneViewerToggle','Viewer',$('.tools'),()=>choose('viewer'));toggle.classList.add('phone-view-toggle');toggle.setAttribute('aria-pressed','false');toggle.title='Open the phone viewer; return with Editor';
  const read=button('phoneReadBtn','Read',$('.zoom-controls'),()=>fit(2));read.title='Enlarge the page for reading; drag to pan';
  const backdrop=document.createElement('button');backdrop.id='phoneSheetBackdrop';backdrop.className='phone-view-controls';backdrop.setAttribute('aria-label','Close sheet list');backdrop.onclick=()=>showDrawer(false);body.append(backdrop);
  const close=button('phoneCloseSheets','Close sheets',body,()=>showDrawer(false));close.classList.add('phone-view-controls');
  function showDrawer(open){drawer=enabled&&open;if(drawer)api.showSheets();body.classList.toggle('phone-sheets-open',drawer);sheets.setAttribute('aria-expanded',String(drawer));if(drawer)close.focus({preventScroll:true});}
  function choose(value){preference=value;try{localStorage.setItem(storageKey,value);}catch{}setEnabled(value==='viewer');}
  function viewport(preserve=true){
    if(!enabled)return;const r=svg.getBoundingClientRect();if(r.width<=0||r.height<=0)return;const height=1128*r.height/r.width,old=viewportHeight,view=api.view();viewportHeight=height;svg.setAttribute('viewBox','0 0 1128 '+height);
    if(preserve&&old!==null&&Math.abs(old-height)>.001){let y=(old/2-399*(1-view.zoom)-view.pan.y)/view.zoom;if(y<0||y>798)y=399;api.setView({zoom:view.zoom,pan:{x:view.pan.x,y:height/2-399*(1-view.zoom)-y*view.zoom}});}
  }
  function fit(zoom=1){if(!enabled)return;viewport(false);const r=svg.getBoundingClientRect(),top=api.svgPoint({clientX:r.left,clientY:r.top+64}).y;api.setView({zoom,pan:{x:zoom===1?0:564*(zoom-1)+16,y:399*(zoom-1)+top}});}
  function setEnabled(value){
    if(enabled===value){refresh();return;}api.cancel();api.cancelInput();menu.open=false;showDrawer(false);
    if(value){previousView=api.view();previousBox=svg.getAttribute('viewBox');}viewportHeight=null;enabled=value;body.classList.toggle('phone-viewer',enabled);toggle.setAttribute('aria-pressed',String(enabled));
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(enabled)fit();else{svg.setAttribute('viewBox',previousBox||'0 0 1128 798');if(previousView)api.setView(previousView);}api.refresh();});refresh();
  }
  function refresh(){const info=api.info();$('#phoneDocumentTitle').textContent=info.title||'Leitwerk';$('#phoneSheetTitle').textContent=info.number+' · '+(info.sheetTitle||'Schematic');projects.title=$('#cloudStatus')?.textContent||'Cloud projects';bar.hidden=!enabled;read.hidden=!enabled;if(enabled&&lastProject!==info.projectId){lastProject=info.projectId;if(info.projectId)requestAnimationFrame(()=>{if(enabled)fit();});}}
  const oldFit=$('#fitBtn').onclick;$('#fitBtn').onclick=()=>{if(enabled)fit();else oldFit?.();};
  const oldLoad=$('#fileInput').onchange;$('#fileInput').onchange=async e=>{await oldLoad(e);if(enabled&&$('#toast').textContent==='Project loaded')fit();};
  const linkSelector='.page-reference,.device-list-link,.terminal-list-link,.cable-list-link,.connection-list-link,#deviceListContent [role="button"],#a4Previous,#a4Next';
  function follow(target){const link=target.closest?.(linkSelector);if(link){const view=api.view();if(view.zoom<2)api.setView({...view,zoom:2});link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return;}api.followPart(target);}
  function guard(e){
    if(!enabled)return;const target=e.target;if(!(target instanceof Element))return;
    if(e.type==='keydown'){
      if(target.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(e.key==='Escape'){if(drawer){e.preventDefault();e.stopImmediatePropagation();showDrawer(false);}menu.open=false;return;}
      if(['PageUp','PageDown','Tab','Enter',' ','Shift','Control','Meta','Alt','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','+','-'].includes(e.key)||(e.ctrlKey||e.metaKey)&&['c','f','p'].includes(e.key.toLowerCase()))return;
      e.preventDefault();e.stopImmediatePropagation();return;
    }
    if((e.type==='drop'||e.type==='dragstart'||e.type==='dragover')&&target.closest('#sheet,#sheetPanel,#library')||(e.type==='dblclick'||e.type==='contextmenu')&&target.closest('#sheet,#sheetPanel')){e.preventDefault();e.stopImmediatePropagation();return;}
    if(e.type==='click'&&target.closest('#sheet')&&!target.closest(linkSelector)){e.preventDefault();e.stopImmediatePropagation();}
  }
  for(const name of ['keydown','click','dblclick','contextmenu','dragstart','dragover','drop'])window.addEventListener(name,guard,{capture:true,passive:false});
  document.addEventListener('click',e=>{if(enabled&&e.target.closest('[data-right-sheet]'))showDrawer(false);},true);
  media.addEventListener('change',()=>{if(preference==='auto')setEnabled(media.matches&&phoneScreen());else if(enabled)requestAnimationFrame(viewport);});
  new ResizeObserver(()=>{if(enabled)viewport();}).observe(svg);
  window.addEventListener('resize',()=>{if(enabled)requestAnimationFrame(viewport);});
  setEnabled(preference==='viewer'||preference==='auto'&&media.matches&&phoneScreen());refresh();
  return{active:()=>enabled,refresh,follow,fit,showSheets:()=>showDrawer(true)};
}};
