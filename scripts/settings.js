/* Preferences belong to this browser; they never change the project or roles.
   Loaded in <head> so a saved light theme is applied before the first paint. */
(()=>{
 'use strict';
 const root=document.documentElement,key='leitwerk.theme';
 function apply(theme,persist=false){
  theme=theme==='light'?'light':'dark';root.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#eef3f7':'#101923');
  if(persist)try{localStorage.setItem(key,theme);}catch{}
  document.querySelectorAll('[name="settingsTheme"]').forEach(n=>{n.checked=n.value===theme;});
 }
 let saved;try{saved=localStorage.getItem(key);}catch{}apply(saved);
 window.addEventListener('storage',e=>{if(e.key===key)apply(e.newValue);});
 globalThis.CabelSettings={init(api){
  const $=s=>document.querySelector(s),dialog=document.createElement('dialog');dialog.id='settingsDialog';dialog.setAttribute('aria-labelledby','settingsTitle');
  dialog.innerHTML='<div class="settings-heading"><div><span class="settings-eyebrow">LEITWERK</span><h2 id="settingsTitle">Settings</h2></div><button type="button" id="settingsClose" aria-label="Close settings">Close ×</button></div><div class="settings-tabs" role="tablist" aria-label="Settings"><button type="button" id="settingsAppearanceTab" role="tab" aria-selected="true" aria-controls="settingsAppearance">Appearance</button><button type="button" id="settingsShortcutsTab" role="tab" aria-selected="false" tabindex="-1" aria-controls="settingsShortcuts">Shortcuts</button></div><div class="settings-body"><section id="settingsAppearance" role="tabpanel" aria-labelledby="settingsAppearanceTab"><h3>Make yourself at home</h3><p>Choose the look of your workspace. The drawing sheet stays white in both modes.</p><fieldset class="theme-options"><legend>Colour theme</legend><label class="theme-choice"><input type="radio" name="settingsTheme" value="light"><span class="theme-preview theme-light" aria-hidden="true"><i></i></span><span><strong>Light</strong><small>A bright workspace</small></span></label><label class="theme-choice"><input type="radio" name="settingsTheme" value="dark"><span class="theme-preview theme-dark" aria-hidden="true"><i></i></span><span><strong>Dark</strong><small>A quieter workspace</small></span></label></fieldset><p class="settings-local-note">Saved automatically in this browser. Project data, drawing colours and PDF export stay the same.</p></section><section id="settingsShortcuts" role="tabpanel" aria-labelledby="settingsShortcutsTab" hidden><h3>Shortcuts & gestures</h3><p>Ctrl/⌘ means Control on Windows/Linux or Command on Mac. Alt is Option on Mac. Editing commands require editor access; text fields keep their normal editing behaviour.</p><label class="shortcut-search-label" for="shortcutSearch">Find a shortcut<input id="shortcutSearch" type="search" placeholder="Search keys, actions or tools…" autocomplete="off"></label><output id="shortcutCount" aria-live="polite"></output><div id="shortcutSections"></div><p id="shortcutEmpty" hidden>No matching shortcuts.</p></section></div>';
  document.body.append(dialog);let opener=null;
  const button=document.createElement('button');button.type='button';button.id='settingsBtn';button.className='tool-button';button.textContent='Settings';button.title='Appearance and all shortcuts';(api.buttonHost||$('.tools')).append(button);
  function show(){if(api.blocked()||dialog.open||$('#cloudDialog')?.open||$('#simpleModal')?.style.display==='grid')return;api.beforeOpen?.();opener=document.activeElement;apply(root.dataset.theme);dialog.showModal();$('#settingsClose').focus({preventScroll:true});}
  button.onclick=show;$('#settingsClose').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{if(opener?.isConnected&&opener.getClientRects().length)opener.focus({preventScroll:true});else document.querySelector(document.body.classList.contains('phone-viewer')?'#phoneViewerMenu>summary':'#settingsBtn')?.focus({preventScroll:true});});
  for(const radio of dialog.querySelectorAll('[name="settingsTheme"]'))radio.onchange=()=>{if(radio.checked)apply(radio.value,true);};
  const tabs=[...dialog.querySelectorAll('[role=tab]')];
  function tab(index,focus=false){tabs.forEach((node,i)=>{node.setAttribute('aria-selected',String(i===index));node.tabIndex=i===index?0:-1;$('#'+node.getAttribute('aria-controls')).hidden=i!==index;});if(focus)tabs[index].focus();}
  tabs.forEach((node,i)=>node.onclick=()=>tab(i));
  if(api.appearanceNote)$('#settingsAppearance>p').textContent=api.appearanceNote;
  if(api.localNote)$('#settingsAppearance .settings-local-note').textContent=api.localNote;
  if(api.shortcutIntro)$('#settingsShortcuts>p').textContent=api.shortcutIntro;
  const data=globalThis.CABEL_SHORTCUTS,sections=[];
  for(const group of data.sections.filter(s=>!api.shortcutSections||api.shortcutSections.includes(s.title))){const section=document.createElement('section');section.className='shortcut-group';const title=document.createElement('h4');title.textContent=group.title;section.append(title);const table=document.createElement('table'),body=document.createElement('tbody');table.append(body);section.append(table);const rows=group.rows.map(([keys,action])=>{const row=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');th.scope='row';th.textContent=keys;td.textContent=action;row.append(th,td);body.append(row);return{node:row,text:(group.title+' '+keys+' '+action).toLowerCase()};});for(const note of group.notes){const p=document.createElement('p');p.className='shortcut-note';p.textContent=note;section.append(p);}$('#shortcutSections').append(section);sections.push({node:section,rows});}
  function filter(){const words=$('#shortcutSearch').value.toLowerCase().trim().split(/\s+/).filter(Boolean);let count=0;for(const section of sections){let hits=0;for(const row of section.rows){row.node.hidden=!words.every(w=>row.text.includes(w));if(!row.node.hidden)hits++;}section.node.hidden=!hits;count+=hits;}$('#shortcutCount').textContent=count+' shortcuts / gestures';$('#shortcutEmpty').hidden=count>0;}
  $('#shortcutSearch').oninput=filter;filter();
  // Stop editor shortcuts while a preferences control or its text is focused.
  // Native typing, Tab, form controls and browser Find keep their default action.
  window.addEventListener('keydown',e=>{
   if(!dialog.open)return;
   if(e.key==='Escape'){e.preventDefault();dialog.close();}
   else if(tabs.includes(e.target)&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const i=tabs.indexOf(e.target);tab(e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length,true);}
   e.stopImmediatePropagation();
  },true);
  apply(root.dataset.theme);return{open:show,active:()=>dialog.open};
 }};
})();
