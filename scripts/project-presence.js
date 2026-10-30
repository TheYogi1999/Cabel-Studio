/* Presence is session metadata, separate from the drawing and access roles. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CabelProjectPresence=api;})(globalThis,()=>{
 'use strict';
 function users(sessions,members,now){
  return Object.entries(sessions||{}).filter(([uid])=>members?.[uid]).flatMap(([uid,devices])=>{
   const active=Object.entries(devices||{}).filter(([,s])=>s&&typeof s.name==='string'&&typeof s.sheet==='string'&&Number.isFinite(s.seenAt)&&now-s.seenAt<90000&&s.seenAt-now<60000).map(([id,s])=>({id,name:s.name,sheet:s.sheet}));
   if(!active.length)return[];active.sort((a,b)=>a.id.localeCompare(b.id));return[{uid,name:active[0].name||uid,role:members[uid],sessions:active}];
  }).sort((a,b)=>a.name.localeCompare(b.name)||a.uid.localeCompare(b.uid));
 }
 function init(api){
  const make=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text)n.textContent=text;return n;},desktop=make('div','workspace-account'),phone=make('div','phone-account-controls phone-view-controls');desktop.id='workspaceAccount';
  const control=(id,parent)=>{const b=make('button','tool-button');b.id=id;b.type='button';parent.append(b);return b;},account=control('cloudAccountBtn',desktop),people=control('cloudPeopleBtn',desktop),phoneAccount=control('phoneAccountBtn',phone),phonePeople=control('phonePeopleBtn',phone);
  const panel=make('section','project-presence-panel');panel.id='cloudPresencePanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','cloudPresenceHeading');panel.innerHTML='<div class="presence-heading"><strong id="cloudPresenceHeading">In this project</strong><button type="button" id="cloudPresenceClose" aria-label="Close people list">×</button></div><p id="cloudPresenceSummary"></p><div id="cloudPresenceUsers"></div>';
  document.body.append(panel);let opener=null,signature='';
  const $=s=>panel.querySelector(s),initials=name=>name.replace(/@.*/,'').split(/[\s._-]+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase()||'?';
  function close(restore=false){panel.hidden=true;for(const b of[people,phonePeople])b.setAttribute('aria-expanded','false');if(restore&&opener?.getClientRects().length)opener.focus({preventScroll:true});}
  function position(){if(panel.hidden)return;const r=opener.getBoundingClientRect();panel.style.top=Math.min(r.bottom+8,innerHeight-100)+'px';panel.style.maxHeight=Math.max(80,innerHeight-r.bottom-20)+'px';}
  function open(b){if(!panel.hidden&&opener===b){close();return;}opener=b;panel.hidden=false;for(const button of[people,phonePeople])button.setAttribute('aria-expanded','true');position();$('#cloudPresenceClose').focus({preventScroll:true});}
  for(const b of[account,phoneAccount]){b.onclick=()=>{close();api.account();};b.setAttribute('aria-haspopup','dialog');}
  for(const b of[people,phonePeople]){b.onclick=()=>open(b);b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls',panel.id);b.setAttribute('aria-haspopup','dialog');}
  $('#cloudPresenceClose').onclick=()=>close(true);
  document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&![people,phonePeople].some(b=>b.contains(e.target)))close();},true);
  document.addEventListener('focusin',e=>{if(!panel.hidden&&!panel.contains(e.target)&&![people,phonePeople].some(b=>b.contains(e.target)))close();});
  window.addEventListener('keydown',e=>{if(panel.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(true);}else if(panel.contains(e.target))e.stopImmediatePropagation();},true);
  window.addEventListener('resize',position);
  function update(value){
   const{name,email,uid}=value.user||{},display=name||email||uid||'Sign in',active=value.connected&&value.sessions!==null?users(value.sessions,value.project?.members,value.now):[],ordered=active.sort((a,b)=>(a.uid===uid?-1:b.uid===uid?1:0)||a.name.localeCompare(b.name));
   for(const b of[account,phoneAccount]){b.textContent=display;b.title=value.user?'Signed in as '+(email||uid)+' · Open account and projects':'Sign in to your cloud workspace';b.setAttribute('aria-label',b.title);b.dataset.signedIn=String(Boolean(uid));}
   const count=ordered.length,sessionCount=ordered.reduce((n,u)=>n+u.sessions.length,0),label=!value.connected?'Offline':value.sessions===null?'People':count+' online';
   for(const b of[people,phonePeople]){b.hidden=!value.project;b.textContent=label;b.title='Who has this project open';b.setAttribute('aria-label',value.connected&&value.sessions!==null?count+' '+(count===1?'person':'people')+' with '+sessionCount+' open sessions · Show people':label+' · Show people');}
   if(!value.project){close();signature='';return;}
   const sig=JSON.stringify([value.project.id,value.connected,value.sessions===null,uid,ordered]);if(sig===signature)return;signature=sig;
   $('#cloudPresenceSummary').textContent=!value.connected?'Offline · Live presence is unavailable.':value.sessions===null?'Connecting to live presence…':count+' '+(count===1?'person':'people')+' · '+sessionCount+' '+(sessionCount===1?'session':'sessions')+' · '+value.project.title;
   const list=$('#cloudPresenceUsers');list.replaceChildren();for(const u of ordered){const row=make('article','presence-person');row.dataset.presenceUid=u.uid;const avatar=make('span','presence-avatar',initials(u.name)),info=make('div','presence-person-info');avatar.setAttribute('aria-hidden','true');info.append(make('strong','',u.name+(u.uid===uid?' (you)':'')),make('small','',({owner:'Owner',editor:'Editor',viewer:'Viewer'})[u.role]||'Member'));for(const session of u.sessions)info.append(make('span','presence-sheet',session.sheet||'Project open'));row.append(avatar,info);list.append(row);}
   if(value.connected&&value.sessions!==null&&!count)list.append(make('p','presence-empty','No recent sessions. The list updates automatically.'));
   position();
  }
  return{desktop,phone,update,close};
 }
 return{users,init};
});
