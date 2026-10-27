/* Firebase is optional. Local JSON/PDF workflows remain available without it. */
globalThis.CabelCloudProjects={
  init(api){
    'use strict';
    const Core=CabelCloudCore,$=s=>document.querySelector(s),sessionId=crypto.randomUUID();
    let F,auth,db,user=null,connected=false,project=null,sync=null,readOnly=false,revisionView=null,head=null,seenSequence=0,status='local',backupFailed=false,initializing=null;
    let indexOff=null,projectOff=[],projectRows=new Map(),projectQuery='',backupLast='',backupPromise=Promise.resolve(),cloudGeneration=0,overviewMode='projects',lastPresence=0,lastError='',lastBackupAt=0;
    const memberUpdates=new Map();
    const button=document.createElement('button');button.id='cloudProjectsBtn';button.className='tool-button';button.textContent='Projects';button.title='Cloud projects, sharing and revision history';$('#saveBtn').before(button);
    const badge=document.createElement('button');badge.id='cloudStatus';badge.className='cloud-status';badge.title='Open cloud projects';$('footer .right').replaceChildren(badge);
    const dialog=document.createElement('dialog');dialog.id='cloudDialog';dialog.setAttribute('aria-labelledby','cloudHeading');dialog.innerHTML='<div class="cloud-dialog-bar"><div class="cloud-brand"><span class="cloud-brand-mark" aria-hidden="true">L</span><div><strong>Leitwerk</strong><h2 id="cloudHeading">Project space</h2></div></div><button type="button" id="cloudClose" class="cloud-close" aria-label="Close projects">Close <span aria-hidden="true">×</span></button></div><div id="cloudBody"></div><p id="cloudMessage" role="status" aria-live="polite"></p>';document.body.append(dialog);
    const style=document.createElement('link');style.rel='stylesheet';style.href='styles/cloud.css?v='+api.version;document.head.append(style);
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const date=v=>typeof v==='number'?new Date(v).toLocaleString():'—';
    const icon=name=>'<svg class="cloud-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+({sheet:'M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h5',arrow:'M5 12h14M13 6l6 6-6 6',share:'M9 7V3h12v12h-4M14 10l7-7M3 9h10v12H3z',search:'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',plus:'M12 5v14M5 12h14',folder:'M3 7V4h6l3 3h9v13H3z',devices:'M3 4h12v12H3zM6 20h6M9 16v4M18 8h4v13h-4z'}[name]||'')+'"/></svg>';
    const allowed=()=>project&&project.role!=='viewer'&&!revisionView;
    const root=path=>F.ref(db,path),path=child=>'projects/'+project.id+'/'+child;
    const labels={local:'Local project',saved:'Cloud · Saved',pending:'Cloud · Changes pending',syncing:'Cloud · Syncing…',offline:'Cloud · Offline', 'offline-pending':'Cloud · Offline · Changes on this device',conflict:'Cloud · Review conflict',error:'Cloud · Sync error',readonly:'Cloud · Read only',revision:'Released / saved revision · Read only'};
    function state(value){status=value;badge.textContent=labels[value]||value;badge.dataset.state=value;badge.title=(project?project.title+' · '+(revisionView?'Revision '+revisionView.name:project.role)+' · ':'')+badge.textContent;if(backupFailed)badge.textContent+=' · Recovery storage unavailable';}
    function message(value,error=false){$('#cloudMessage').textContent=value;$('#cloudMessage').classList.toggle('error',error);if(!error)delete $('#cloudMessage').dataset.errorCode;}
    function fail(error){const value=({'auth/invalid-credential':'The email or password is incorrect. Please try again.','auth/invalid-login-credentials':'The email or password is incorrect. Please try again.','auth/wrong-password':'The email or password is incorrect. Please try again.','auth/user-not-found':'The email or password is incorrect. Please try again.','auth/email-already-in-use':'An account with this email already exists. Sign in or reset your password.','auth/weak-password':'Choose a stronger password with at least 8 characters.','auth/invalid-email':'Enter a valid email address.','auth/too-many-requests':'Too many attempts. Please wait a moment and try again.','auth/network-request-failed':'Could not connect. Check your internet connection and try again.','auth/operation-not-allowed':'Email/password sign-in is unavailable. Please contact the app owner.'}[error?.code])||String(error?.message||error);state('error');if(value!==lastError){lastError=value;api.toast('Cloud: '+value);}if(dialog.open){message(value,true);$('#cloudMessage').dataset.errorCode=error?.code||'';}}
    async function action(fn){try{message('');await fn();}catch(e){fail(e);}}
    function show(){if(!dialog.open)dialog.showModal();}
    function body(html){dialog.dataset.view=overviewMode;$('#cloudHeading').textContent=({login:'Project space',projects:'Projects',details:'Project',history:'Revision history',setup:'Cloud setup',create:'New cloud project',join:'Shared project',conflict:'Resolve changes',recovery:'Device recovery',welcome:'Project space'})[overviewMode]||'Projects';$('#cloudBody').innerHTML=html;message('');show();}
    const on=(id,fn)=>{$('#'+id)?.addEventListener('click',()=>action(fn));};
    function setReadOnly(value){readOnly=value;document.body.dataset.cloudReadOnly=String(value);}

    // IndexedDB recovery is separate from the SDK's in-memory offline queue.
    const recoveryDB=new Promise((resolve,reject)=>{const request=indexedDB.open('leitwerk-cloud-recovery',1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts',{keyPath:'key'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    recoveryDB.catch(()=>{backupFailed=true;state(status);});
    async function recovery(mode,fn){const database=await recoveryDB;return new Promise((resolve,reject)=>{const tx=database.transaction('drafts',mode),request=fn(tx.objectStore('drafts'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Recovery write aborted'));});}
    const backupKey=()=>user&&project?user.uid+'/'+project.id+'/'+sessionId:null;
    async function backup(force=false){
      const key=backupKey();if(!key||revisionView)return;
      const document=Core.documentOf(api.capture()),synced=sync?!sync.dirty()&&!sync.pending&&!sync.sending&&!sync.conflict:true,text=Core.stable({document,synced});if(!force&&text===backupLast)return;
      const value={key,uid:user.uid,projectId:project.id,sessionId,title:document.title,document,base:sync?.base||document,savedAt:Date.now(),synced};
      backupPromise=backupPromise.catch(()=>{}).then(()=>recovery('readwrite',store=>store.put(value)));
      try{await backupPromise;backupLast=text;lastBackupAt=Date.now();}catch(e){backupFailed=true;state(status);throw Error('Local recovery storage is unavailable. Download a JSON backup before closing this tab.');}
    }
    async function recoveryList(){const rows=await recovery('readonly',store=>store.getAll());return rows.filter(x=>x.uid===user?.uid).sort((a,b)=>b.savedAt-a.savedAt);}
    function serialize(doc){const text=JSON.stringify(Core.documentOf(doc));if(text.length>4000000)throw Error('This project exceeds the 4 MB cloud document limit. Save a JSON file.');return text;}
    function configure(){
      overviewMode='setup';body('<p>Connect a Firebase Web App. Use the same configuration on iPad and PC. The setup guide is in <a href="firebase/SETUP.md" target="_blank" rel="noopener">firebase/SETUP.md</a>.</p><form id="cloudSetupForm"><label>Public firebaseConfig JSON<textarea id="cloudConfig" rows="9" placeholder=\'{"apiKey":"…","authDomain":"…","databaseURL":"…","projectId":"…","appId":"…"}\' required></textarea></label><p>Only public Web App settings belong here. Passwords and service-account keys do not.</p><div class="cloud-actions"><button type="submit">Connect Firebase</button><button type="button" id="cloudSetupBack">Back</button></div></form>');
      try{$('#cloudConfig').value=JSON.stringify(JSON.parse(localStorage.getItem('leitwerk.firebase.config')||'null')||globalThis.LEITWERK_FIREBASE_CONFIG||{},null,2);}catch{/* Leave the editable field available. */}
      on('cloudSetupBack',overview);$('#cloudSetupForm').onsubmit=e=>{e.preventDefault();action(async()=>{const config=JSON.parse($('#cloudConfig').value);validateConfig(config);if(auth){await safeDetach();await F.signOut(auth);localStorage.setItem('leitwerk.firebase.config',JSON.stringify(config));location.reload();return;}localStorage.setItem('leitwerk.firebase.config',JSON.stringify(config));await initialize(config);overview();});};
    }
    function validateConfig(config){for(const key of ['apiKey','authDomain','databaseURL','projectId','appId'])if(typeof config?.[key]!=='string'||!config[key].trim())throw Error('Missing Firebase setting: '+key);const url=new URL(config.databaseURL);if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw Error('databaseURL must use HTTPS');}
    async function initialize(config){
      if(auth)return;if(initializing)return initializing;
      validateConfig(config);
      initializing=(async()=>{
        if(!globalThis.CabelFirebase)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/firebase.js?v='+api.version;script.onload=resolve;script.onerror=()=>reject(Error('Could not load the Firebase SDK'));document.head.append(script);});
        F=CabelFirebase;const app=F.initializeApp(config);auth=F.getAuth(app);db=F.getDatabase(app);
        const emulators=globalThis.LEITWERK_FIREBASE_EMULATORS;
        if(emulators&&['localhost','127.0.0.1'].includes(location.hostname)){F.connectAuthEmulator(auth,'http://127.0.0.1:'+emulators.auth,{disableWarnings:true});F.connectDatabaseEmulator(db,'127.0.0.1',emulators.database);}
        F.onValue(root('.info/connected'),snapshot=>{connected=snapshot.val()===true;const indicator=dialog.querySelector('.cloud-connection');if(indicator){indicator.classList.toggle('is-connected',connected);indicator.innerHTML='<i aria-hidden="true"></i>'+(connected?'Connected':'Offline');}if(project&&!revisionView){state(!connected?(sync?.dirty()?'offline-pending':'offline'):readOnly?'readonly':'pending');if(connected)presence();}},fail);
        F.onAuthStateChanged(auth,async value=>{if(value?.uid!==user?.uid)projectQuery='';if(user&&value?.uid!==user.uid)await detach();user=value;projectRows.clear();indexOff?.();indexOff=null;if(user){indexOff=F.onValue(root('userProjects/'+user.uid),snapshot=>{const previous=projectRows;projectRows=new Map(Object.keys(snapshot.val()||{}).map(id=>[id,previous.get(id)||null]));if(dialog.open&&overviewMode==='projects')renderProjects();loadProjectRows();},fail);}if(dialog.open&&overviewMode!=='setup'&&!(overviewMode==='login'&&!value))overview();});
      })();
      try{await initializing;}finally{initializing=null;}
    }
    async function loadProjectRows(){
      const uid=user?.uid;if(!uid)return;
      await Promise.all([...projectRows.keys()].map(async id=>{try{const snap=await F.get(root('projects/'+id+'/meta'));if(user?.uid===uid&&projectRows.has(id))projectRows.set(id,snap.val());}catch{if(user?.uid===uid)projectRows.set(id,{title:'Access removed',removed:true});}}));
      if(dialog.open&&overviewMode==='projects')renderProjects();
    }
    function login(){
      overviewMode='login';
      body('<div class="cloud-auth-layout"><aside class="cloud-auth-intro"><span class="cloud-eyebrow">YOUR PROJECT SPACE</span><h3>One project.<br>Every device.</h3><p>Pick up your drawings wherever you work.</p><div class="cloud-schematic-art" aria-hidden="true"><svg viewBox="0 0 300 160"><path d="M22 42h65v72h58V42h62v72h70M22 114h65M145 114V72h62"/><rect x="72" y="28" width="30" height="28"/><rect x="130" y="100" width="30" height="28"/><rect x="192" y="28" width="30" height="28"/><circle cx="22" cy="42" r="4"/><circle cx="87" cy="114" r="4"/><circle cx="207" cy="72" r="4"/><circle cx="277" cy="114" r="4"/></svg></div><div class="cloud-auth-feature">'+icon('devices')+'<span>Continue on iPad and desktop</span></div><div class="cloud-auth-feature">'+icon('folder')+'<span>Keep projects and revisions together</span></div><small>Local JSON and PDF are always available.</small></aside><section class="cloud-auth-form"><span class="cloud-eyebrow">WELCOME BACK</span><h3>Sign in to Leitwerk</h3><p>Open your projects and continue drawing.</p><form id="cloudLoginForm"><label for="cloudEmail">Email address</label><input id="cloudEmail" type="email" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" placeholder="you@example.com" required><label for="cloudPassword">Password</label><div class="cloud-password"><input id="cloudPassword" type="password" autocomplete="current-password" minlength="8" placeholder="Your password" required><button type="button" id="cloudPasswordToggle" aria-label="Show password" aria-pressed="false">'+icon('eye')+'</button></div><div class="cloud-auth-forgot"><button type="button" id="cloudReset" class="cloud-link-button">Forgot password?</button></div><button type="submit" class="cloud-primary cloud-auth-submit">Sign in '+icon('arrow')+'</button><div class="cloud-auth-divider"><span>New to Leitwerk?</span></div><button type="button" id="cloudRegister" class="cloud-auth-register">Create account</button></form><div class="cloud-auth-footer"><span>Your drawing stays local until you open or save a cloud project.</span><button type="button" id="cloudLoginSetup" class="cloud-link-button">Cloud setup</button></div></section></div>');
      on('cloudLoginSetup',configure);
      const form=$('#cloudLoginForm'),email=$('#cloudEmail'),password=$('#cloudPassword'),toggle=$('#cloudPasswordToggle');
      toggle.onclick=()=>{const show=password.type==='password';password.type=show?'text':'password';toggle.setAttribute('aria-pressed',String(show));toggle.setAttribute('aria-label',show?'Hide password':'Show password');password.focus({preventScroll:true});};
      async function authenticate(kind){
        if(form.getAttribute('aria-busy')==='true'||!(kind==='reset'?email.reportValidity():form.reportValidity()))return;
        const address=email.value.trim(),secret=password.value,buttons=[...form.querySelectorAll('button')],target=kind==='signin'?form.querySelector('[type=submit]'):kind==='register'?$('#cloudRegister'):$('#cloudReset'),label=target.innerHTML;
        form.setAttribute('aria-busy','true');buttons.forEach(b=>b.disabled=true);target.textContent=kind==='signin'?'Signing in…':kind==='register'?'Creating account…':'Sending…';
        try{if(kind==='reset'){await F.sendPasswordResetEmail(auth,address);message('Password reset requested. Check your email.');}else{await (kind==='signin'?F.signInWithEmailAndPassword:F.createUserWithEmailAndPassword)(auth,address,secret);overview();}}
        finally{form.removeAttribute('aria-busy');buttons.forEach(b=>b.disabled=false);target.innerHTML=label;}
      }
      form.onsubmit=e=>{e.preventDefault();action(()=>authenticate('signin'));};on('cloudRegister',()=>authenticate('register'));on('cloudReset',()=>authenticate('reset'));
    }
    function overview(){if(!auth){overviewMode='welcome';body('<p>Work on the same project on iPad and PC. Cloud projects support automatic synchronization, project roles and immutable released revisions.</p><button id="cloudSetup">Cloud setup</button><p>Local JSON and PDF remain available.</p>');on('cloudSetup',configure);return;}if(!user){login();return;}overviewMode='projects';renderProjects();loadProjectRows();}
    function renderProjects(){
      const searchFocused=document.activeElement?.id==='cloudProjectSearch',selection=searchFocused?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:null;
      const rows=[...projectRows].sort(([a,pa],[b,pb])=>Number(b===project?.id)-Number(a===project?.id)||(pb?.createdAt||0)-(pa?.createdAt||0)||a.localeCompare(b)).map(([id,p])=>{
        const current=id===project?.id,title=current?project.title:p?.title||'Loading…';
        return '<article class="cloud-card cloud-project-card'+(current?' is-current':'')+'" data-cloud-project="'+esc(id)+'" data-cloud-search="'+esc((title+' '+id).toLocaleLowerCase())+'"><div class="cloud-card-top"><span class="cloud-project-glyph">'+icon('sheet')+'</span>'+(current?'<span class="cloud-pill">Current project</span>':p?.removed?'<span class="cloud-pill cloud-pill-muted">Access removed</span>':'<span class="cloud-card-type">Cloud project</span>')+'</div><div class="cloud-card-content"><h4>'+esc(title)+'</h4><small>'+(p?.removed?'Contact the project owner to restore access.':p?.createdAt?'Created '+esc(date(p.createdAt)):'Project details are loading…')+'</small></div><div class="cloud-card-bottom"><span class="cloud-card-id" title="Project ID: '+esc(id)+'">'+esc(id)+'</span><button data-cloud-open="'+esc(id)+'" aria-label="Open '+esc(title)+'" '+(p?.removed?'disabled':'')+'>Open '+icon('arrow')+'</button></div></article>';
      }).join('');
      body('<div class="cloud-account"><div class="cloud-avatar" aria-hidden="true">'+esc((user.email||'L').charAt(0).toUpperCase())+'</div><div class="cloud-account-identity"><strong>Your workspace</strong><span>'+esc(user.email||user.uid)+'</span></div><div class="cloud-account-tools"><button id="cloudCopyUid" class="cloud-link-button">Copy my user ID</button><button id="cloudAccountSetup" class="cloud-link-button">Cloud setup</button><button id="cloudSignOut">Sign out</button></div></div><div class="cloud-dashboard-heading"><div><span class="cloud-eyebrow">PICK UP WHERE YOU LEFT OFF</span><h3>Your projects</h3><p>Drawings, devices and revisions, together in one place.</p></div><span class="cloud-connection '+(connected?'is-connected':'')+'"><i aria-hidden="true"></i>'+(connected?'Connected':'Offline')+'</span></div><div class="cloud-actions cloud-dashboard-actions"><button id="cloudCreate" class="cloud-primary">'+icon('plus')+'Save current project to cloud</button><button id="cloudJoin">'+icon('share')+'Open shared project</button></div>'+(project?'<div class="cloud-current-project"><div><span class="cloud-eyebrow">OPEN IN THE EDITOR</span><strong>'+esc(project.title)+'</strong></div><button id="cloudDetails">Project / revisions '+icon('arrow')+'</button><button id="cloudLocal" class="cloud-link-button">Continue locally</button></div>':'')+'<div class="cloud-project-toolbar"><label class="cloud-search" for="cloudProjectSearch">'+icon('search')+'<input id="cloudProjectSearch" type="search" placeholder="Search projects" aria-label="Search projects" value="'+esc(projectQuery)+'"></label><span id="cloudResultCount" aria-live="polite"></span></div><div class="cloud-projects">'+rows+'</div><div id="cloudEmpty" class="cloud-empty" '+(rows?'hidden':'')+'><span class="cloud-empty-icon">'+icon('folder')+'</span><h4>Your first cloud project starts here</h4><p>Save the drawing open in the editor, or open a project shared with you.</p></div><div id="cloudNoResults" class="cloud-empty" hidden><span class="cloud-empty-icon">'+icon('search')+'</span><h4>No matching projects</h4><p>Try another name or project ID.</p><button id="cloudSearchClear">Clear search</button></div><div class="cloud-dashboard-footer"><span>Open the same project on iPad and desktop to sync your work.</span><button id="cloudRecovery" class="cloud-link-button">Device recovery</button></div>');
      on('cloudCopyUid',async()=>{try{await navigator.clipboard.writeText(user.uid);}catch{/* The visible ID can be selected manually. */}message('User ID: '+user.uid);});on('cloudAccountSetup',configure);
      on('cloudSignOut',async()=>{await safeDetach();await F.signOut(auth);overview();});on('cloudCreate',createForm);on('cloudJoin',joinForm);on('cloudRecovery',recoveryView);on('cloudDetails',details);on('cloudLocal',async()=>{await backup(true);await detach();dialog.close();});
      for(const node of dialog.querySelectorAll('[data-cloud-open]'))node.onclick=()=>action(()=>openProject(node.dataset.cloudOpen));
      function filter(){const q=projectQuery.trim().toLocaleLowerCase(),cards=[...dialog.querySelectorAll('[data-cloud-project]')];let shown=0;for(const card of cards){card.hidden=!card.dataset.cloudSearch.includes(q);if(!card.hidden)shown++;}$('#cloudNoResults').hidden=!cards.length||shown>0;$('#cloudResultCount').textContent=q?shown+' of '+cards.length+' projects':cards.length+' '+(cards.length===1?'project':'projects');}
      const search=$('#cloudProjectSearch');search.oninput=()=>{projectQuery=search.value;filter();};on('cloudSearchClear',()=>{projectQuery='';search.value='';filter();search.focus();});filter();if(searchFocused){search.focus({preventScroll:true});search.setSelectionRange(...selection);}
    }
    function createForm(){overviewMode='create';body('<form id="cloudCreateForm"><label>Project name<input id="cloudProjectName" maxlength="200" value="'+esc(api.capture().title)+'" required></label><p>The current drawing, devices, cables and annotations will become a new cloud project. You are its owner.</p><button type="submit">Create cloud project</button></form>');$('#cloudCreateForm').onsubmit=e=>{e.preventDefault();const name=$('#cloudProjectName').value.trim();action(async()=>{await safeDetach();const doc=Core.documentOf(api.capture());doc.title=name;const id=F.push(root('projects')).key;await F.set(root('projects/'+id),{owner:user.uid,members:{[user.uid]:'owner'},meta:{title:name,createdAt:F.serverTimestamp()},head:{document:serialize(doc),sequence:1,updatedAt:F.serverTimestamp(),updatedBy:user.uid}});await F.set(root('userProjects/'+user.uid+'/'+id),true);await openProject(id);});};}
    function joinForm(){overviewMode='join';body('<form id="cloudJoinForm"><label>Project ID<input id="cloudJoinId" required pattern="[A-Za-z0-9_-]+"></label><p>Ask the owner to add your user ID to this project first.</p><button type="submit">Open project</button></form>');$('#cloudJoinForm').onsubmit=e=>{e.preventDefault();action(()=>openProject($('#cloudJoinId').value.trim()));};}
    async function safeDetach(){if(sync&&(sync.dirty()||sync.sending||sync.pending||sync.conflict)){await backup(true);throw Error('This project has unsynchronized changes. Wait for Saved, resolve its conflict, or download a backup and use Device recovery before switching.');}await detach();}
    async function detach(){
      cloudGeneration++;if(project){await backup(true);if(connected&&user)F.set(root(path('presence/'+user.uid+'/'+sessionId)),null).catch(()=>{});}
      sync?.stop();sync=null;projectOff.forEach(off=>off());projectOff=[];project=null;head=null;revisionView=null;seenSequence=0;backupLast='';api.useCloudIds(false);setReadOnly(false);state('local');
    }
    async function openProject(id){
      if(!/^[A-Za-z0-9_-]+$/.test(id))throw Error('Invalid project ID');if(!connected)throw Error('Connect to the internet to open a cloud project');
      if(project?.id===id&&!revisionView){details();return;}await safeDetach();
      const generation=cloudGeneration,snap=await F.get(root('projects/'+id)),value=snap.val();if(generation!==cloudGeneration)return;if(!value||!value.members?.[user.uid])throw Error('No access to this project');
      const previous=Core.documentOf(api.capture());if(previous.sheets.some(s=>s.parts.length||s.wires.length||s.redlines?.length))await recovery('readwrite',store=>store.put({key:user.uid+'/local/'+sessionId,uid:user.uid,projectId:'local',sessionId,title:previous.title,document:previous,base:previous,savedAt:Date.now(),synced:false}));
      const doc=Core.documentOf(JSON.parse(value.head.document));project={id,owner:value.owner,role:value.members[user.uid],title:doc.title,members:value.members};head=value.head;seenSequence=head.sequence;backupLast='';revisionView=null;api.useCloudIds(true);api.apply(doc);setReadOnly(project.role==='viewer');
      startSession(doc);await F.set(root('userProjects/'+user.uid+'/'+id),true);
      projectOff.push(F.onValue(root(path('head')),snapshot=>{if(project?.id!==id)return;const value=snapshot.val();if(value){head=value;if(!revisionView&&!readOnly&&head.sequence!==seenSequence)state('pending');}},accessLost));
      projectOff.push(F.onValue(root(path('members')),snapshot=>{if(project?.id!==id)return;const previousRole=project.role;project.members=snapshot.val()||{};project.role=project.members[user.uid];if(!project.role){accessLost(Error('Project access removed'));return;}setReadOnly(project.role==='viewer'||Boolean(revisionView));if(readOnly&&!revisionView)state('readonly');else if(previousRole!==project.role&&!revisionView)state(connected?'pending':'offline');if(dialog.open&&overviewMode==='details'){if(previousRole!==project.role)details().catch(fail);else renderProjectMembers();}},accessLost));
      await presence();details();
      const recoveries=(await recoveryList()).filter(r=>r.projectId===id&&r.sessionId!==sessionId&&!r.synced&&!Core.equal(r.document,doc));if(recoveries.length)message('This device has an unsynchronized recovery copy. Open Device recovery before discarding it.');
    }
    function accessLost(error){sync?.stop();setReadOnly(true);state('error');backup(true).catch(()=>{});api.toast('Cloud access lost. The document stays on this device; download a JSON backup.');if(dialog.open)message('Project access lost: '+error.message,true);}
    function startSession(initial){
      sync?.stop();seenSequence=head.sequence;
      sync=new Core.Session({initial,capture:api.capture,apply:doc=>{api.apply(doc);project.title=doc.title;},busy:()=>api.busy(),connected:()=>connected,changed:()=>head.sequence!==seenSequence,status:value=>state(readOnly?'readonly':value),error:fail,conflict:()=>{backup(true).catch(fail);api.toast('Cloud edits overlap. Open Projects to review both versions.');if(dialog.open)conflictView();},
        transact:async(base,local)=>{
          if(readOnly){seenSequence=head.sequence;return{document:JSON.parse(head.document)};}
          const currentId=project.id;let conflicts=[],remote=null;
          const result=await F.runTransaction(root(path('head')),current=>{
            conflicts=[];if(!current)return;remote=Core.documentOf(JSON.parse(current.document));const result=Core.merge(base,local,remote);conflicts=result.conflicts;if(conflicts.length||Core.equal(result.document,remote))return;
            return{document:serialize(result.document),sequence:current.sequence+1,updatedAt:F.serverTimestamp(),updatedBy:user.uid};
          },{applyLocally:false});
          const current=result.snapshot.val();if(!current)throw Error('Cloud project could not be read. Check access and reconnect.');
          if(project?.id!==currentId)throw Error('Project changed during synchronization');head=current;if(conflicts.length)return{document:Core.documentOf(JSON.parse(current.document)),conflicts};seenSequence=current.sequence;
          const document=Core.documentOf(JSON.parse(current.document));if(result.committed)F.update(root(path('meta')),{title:document.title.slice(0,200)}).catch(fail);return{document};
        }
      });
      state(readOnly?'readonly':connected?'saved':'offline');
    }
    async function flush(){
      if(!sync||revisionView||!connected)throw Error('Open the online working copy first');if(api.busy())throw Error('Finish the current edit or close its properties first');
      if(sync.sending)throw Error('Synchronization is still in progress. Try again when Saved is shown.');
      for(let i=0;i<3;i++){await sync.tick();if(sync.conflict)throw Error('Resolve the synchronization conflict first');}
      if(sync.dirty()||sync.pending||sync.sending)throw Error('Wait until all changes are saved');await backup(true);
    }
    async function presence(){
      if(!project||!connected||!user)return;lastPresence=Date.now();const r=root(path('presence/'+user.uid+'/'+sessionId));await F.onDisconnect(r).remove();await F.set(r,{name:(user.email||user.uid).slice(0,120),sheet:api.sheet().slice(0,120),seenAt:F.serverTimestamp()});
    }
    function renderProjectMembers(){
      const container=dialog.querySelector('.cloud-members');if(!container||!project||overviewMode!=='details')return;
      const projectId=project.id,canManage=project.owner===user?.uid&&project.role==='owner',focused=document.activeElement?.dataset.cloudRole;
      container.innerHTML=Object.entries(project.members).map(([uid,role])=>{
        const owner=uid===project.owner||role==='owner',update=memberUpdates.get(projectId+'/'+uid),chosen=update?.pending?update.role:role;
        return '<div class="cloud-member-row" data-cloud-member="'+esc(uid)+'"><div class="cloud-member-identity"><code>'+esc(uid)+'</code>'+(owner?'<small>Project owner</small>':'')+'</div>'+(canManage&&!owner?'<label class="cloud-role-control"><span class="cloud-sr-only">Role for '+esc(uid)+'</span><select data-cloud-role="'+esc(uid)+'" aria-label="Role for '+esc(uid)+'" '+(update?.pending?'disabled aria-busy="true"':'')+'><option value="editor"'+(chosen==='editor'?' selected':'')+'>Editor</option><option value="viewer"'+(chosen==='viewer'?' selected':'')+'>Viewer</option></select></label><button data-cloud-revoke="'+esc(uid)+'" '+(update?.pending?'disabled':'')+'>Remove</button>':'<span class="cloud-role-badge">'+esc(owner?'Owner':role==='editor'?'Editor':'Viewer')+'</span>')+'<span class="cloud-member-save'+(update?.error?' error':'')+'" role="status" aria-live="polite">'+esc(update?.message||'')+'</span></div>';
      }).join('');
      for(const select of container.querySelectorAll('[data-cloud-role]'))select.onchange=()=>action(()=>changeMemberRole(select.dataset.cloudRole,select.value));
      for(const b of container.querySelectorAll('[data-cloud-revoke]'))b.onclick=()=>action(async()=>{const uid=b.dataset.cloudRevoke;b.disabled=true;try{await F.set(root('projects/'+projectId+'/members/'+uid),null);await F.set(root('userProjects/'+uid+'/'+projectId),null);}finally{if(project?.id===projectId)renderProjectMembers();}});
      if(focused)for(const select of container.querySelectorAll('[data-cloud-role]'))if(select.dataset.cloudRole===focused&&!select.disabled)select.focus({preventScroll:true});
    }
    async function changeMemberRole(uid,role){
      const current=project,projectId=current?.id,key=projectId+'/'+uid;if(memberUpdates.get(key)?.pending)return;
      memberUpdates.set(key,{pending:true,role,message:'Saving…'});renderProjectMembers();
      try{
        if(!current||current.owner!==user?.uid||current.role!=='owner')throw Error('Only the project owner can change member roles.');
        if(uid===current.owner||!['editor','viewer'].includes(role))throw Error('The project owner cannot be changed here.');
        if(!connected)throw Error('Connect to the internet to change project access.');
        // Abort when a stale row refers to a removed member or an owner. A role
        // switch must never recreate access or alter the owner identity/index.
        const result=await F.runTransaction(root('projects/'+projectId+'/members/'+uid),value=>['editor','viewer'].includes(value)?role:undefined,{applyLocally:false});
        if(!result.committed)throw Error('This member was removed or its role changed. Reopen Project access.');
        if(project?.id===projectId)project.members[uid]=result.snapshot.val();
        memberUpdates.set(key,{message:'Saved'});
      }catch(error){memberUpdates.set(key,{message:'Could not save. Try again.',error:true});throw error;}
      finally{if(project?.id===projectId)renderProjectMembers();}
    }
    async function details(){
      if(!project){overview();return;}if(sync?.conflict){conflictView();return;}overviewMode='details';
      body('<div class="cloud-project-heading"><strong>'+esc(project.title)+'</strong><span>'+esc(project.role)+(revisionView?' · Revision '+esc(revisionView.name):' · Working copy')+'</span><small>Project ID: '+esc(project.id)+'</small></div><div class="cloud-actions"><button id="cloudAllProjects">All projects</button><button id="cloudHistory">Revision history</button>'+(project.role!=='viewer'?'<button id="cloudCheckpoint">Save revision / release</button>':'')+'<button id="cloudWorking">Open working copy</button><button id="cloudDownload">Download JSON backup</button><button id="cloudRecovery">Device recovery</button></div><h3>Project access</h3><p>Share the project ID and add the other person’s user ID. An owner can release revisions and manage members. Change Editor / Viewer beside a user ID; changes save automatically. Editors work on the drawing; viewers have read-only access.</p><div class="cloud-members"></div>'+(project.role==='owner'?'<form id="cloudMemberForm" class="cloud-inline-form"><label>User ID<input id="cloudMemberUid" required pattern="[A-Za-z0-9_-]+"></label><label>Role<select id="cloudMemberRole"><option value="editor">Editor</option><option value="viewer">Viewer</option></select></label><button type="submit">Add / update member</button></form>':'')+'<h3>Connected sessions</h3><div id="cloudPresence">Loading…</div>');
      on('cloudAllProjects',overview);on('cloudHistory',history);on('cloudCheckpoint',revisionForm);on('cloudWorking',working);on('cloudDownload',()=>api.download(api.capture()));on('cloudRecovery',recoveryView);
      renderProjectMembers();
      const form=$('#cloudMemberForm');if(form)form.onsubmit=e=>{
        e.preventDefault();if(form.getAttribute('aria-busy')==='true')return;
        const uid=$('#cloudMemberUid').value.trim(),role=$('#cloudMemberRole').value,projectId=project.id,owner=project.owner,submit=form.querySelector('[type=submit]');
        form.setAttribute('aria-busy','true');submit.disabled=true;
        action(async()=>{try{if(uid===owner)throw Error('The project owner cannot be changed here');await F.set(root('projects/'+projectId+'/members/'+uid),role);await F.set(root('userProjects/'+uid+'/'+projectId),true);if(project?.id===projectId&&dialog.open&&overviewMode==='details'){renderProjectMembers();form.reset();message('Member access saved.');}}finally{form.removeAttribute('aria-busy');submit.disabled=false;}});
      };
      const snap=await F.get(root(path('presence')));if(overviewMode==='details'&&$('#cloudPresence'))$('#cloudPresence').innerHTML=Object.values(snap.val()||{}).flatMap(sessions=>Object.values(sessions)).filter(s=>Date.now()-s.seenAt<90000).map(s=>'<p>'+esc(s.name)+' · '+esc(s.sheet)+'</p>').join('')||'No other active sessions';
    }
    async function history(){
      overviewMode='history';body('<p>Loading revision history…</p>');const id=project.id,snapshot=await F.get(root(path('revisions')));if(project?.id!==id||overviewMode!=='history')return;
      const rows=Object.entries(snapshot.val()||{}).sort((a,b)=>b[1].createdAt-a[1].createdAt);
      body('<div class="cloud-actions"><button id="cloudDetails">Project</button><button id="cloudWorking">Open working copy</button>'+(project.role!=='viewer'?'<button id="cloudCheckpoint">Save revision / release</button>':'')+'</div><p>Saved revisions are immutable. Opening one is read only; restoring creates a new working state. Released revisions can only be created by the owner.</p>'+rows.map(([id,r])=>'<article class="cloud-card"><div><strong>'+esc(r.name)+'</strong><span class="cloud-revision-status">'+esc(r.status.toUpperCase())+'</span><small>'+esc(date(r.createdAt))+' · '+esc(r.createdBy)+' · Working state '+r.sourceSequence+'</small></div><button data-cloud-revision="'+esc(id)+'">Open</button>'+(project.role!=='viewer'?'<button data-cloud-restore="'+esc(id)+'">Restore as working copy</button>':'')+'</article>').join(''));
      on('cloudDetails',details);on('cloudWorking',working);on('cloudCheckpoint',revisionForm);
      for(const node of dialog.querySelectorAll('[data-cloud-revision]'))node.onclick=()=>action(async()=>{await flushIfWorking();const r=rows.find(([id])=>id===node.dataset.cloudRevision)[1];sync?.stop();sync=null;revisionView=r;api.apply(JSON.parse(r.document));setReadOnly(true);state('revision');dialog.close();});
      for(const node of dialog.querySelectorAll('[data-cloud-restore]'))node.onclick=()=>action(async()=>{const r=rows.find(([id])=>id===node.dataset.cloudRestore)[1];await working(false);await flush();await saveRevision('Before restoring '+r.name,'draft');api.apply(JSON.parse(r.document));state('pending');dialog.close();});
    }
    const flushIfWorking=async()=>{if(!revisionView)await flush();};
    async function working(close=true){
      if(!project)throw Error('Open a cloud project first');if(!revisionView){if(close)dialog.close();return;}
      const value=(await F.get(root(path('head')))).val();if(!value)throw Error('Project unavailable');head=value;revisionView=null;setReadOnly(project.role==='viewer');const doc=Core.documentOf(JSON.parse(head.document));api.apply(doc);startSession(doc);if(close)dialog.close();
    }
    function revisionForm(){if(revisionView)throw Error('Open the working copy before saving a revision');body('<form id="cloudRevisionForm"><label>Revision name<input id="cloudRevisionName" maxlength="120" placeholder="e.g. A — issued for review" required></label><label>Status<select id="cloudRevisionStatus"><option value="draft">Saved draft</option>'+(project.role==='owner'?'<option value="released">Released</option>':'')+'</select></label><p>A released revision is an immutable project snapshot, including every drawing, device, cable and annotation. Further edits stay in the working copy.</p><button type="submit">Save revision</button></form>');$('#cloudRevisionForm').onsubmit=e=>{e.preventDefault();const name=$('#cloudRevisionName').value.trim(),status=$('#cloudRevisionStatus').value;action(async()=>{await flush();await saveRevision(name,status);await history();});};}
    async function saveRevision(name,status){if(!allowed())throw Error('Only owners and editors can save revisions');if(status==='released'&&project.role!=='owner')throw Error('Only the owner can release a revision');const r=F.push(root(path('revisions')));await F.set(r,{name:name.slice(0,120),status,document:serialize(sync.base),sourceSequence:seenSequence,createdAt:F.serverTimestamp(),createdBy:user.uid});}
    function conflictView(){
      overviewMode='conflict';sync?.refreshConflict();const c=sync?.conflict;if(!c){details();return;}const conflicts=c.conflicts.some(c=>c.key==='document')?c.conflicts.filter(c=>c.key==='document'):c.conflicts;
      body('<p>Both devices changed the same content. Review each overlap. Download both versions before choosing if you need to combine them manually. Your local recovery copy is retained.</p><div class="cloud-actions"><button id="cloudConflictLocal">Download this device’s version</button><button id="cloudConflictRemote">Download cloud version</button></div><form id="cloudConflictForm">'+conflicts.map(c=>'<label>'+esc(c.label)+'<select data-cloud-choice="'+esc(c.key)+'" required><option value="">Choose…</option><option value="local">Keep this device’s version</option><option value="remote">Keep cloud version</option></select></label>').join('')+'<button type="submit">Apply choices and synchronize</button></form>');
      on('cloudConflictLocal',()=>api.download(c.local));on('cloudConflictRemote',()=>api.download(c.remote));$('#cloudConflictForm').onsubmit=e=>{e.preventDefault();action(async()=>{await backup(true);const choices=Object.fromEntries([...dialog.querySelectorAll('[data-cloud-choice]')].map(n=>[n.dataset.cloudChoice,n.value]));sync.resolve(choices);dialog.close();});};
    }
    async function recoveryView(){
      overviewMode='recovery';const rows=await recoveryList();body('<p>Recovery copies are stored in this browser on this device, separately from Firebase. An unsynchronized copy can be downloaded or restored. Restore into a local project, then review before saving it to the cloud.</p><button id="cloudAllProjects">All projects</button>'+rows.map((r,i)=>'<article class="cloud-card"><div><strong>'+esc(r.title)+'</strong><small>'+esc(date(r.savedAt))+' · '+(r.synced?'Synchronized':'Unsynchronized')+'</small></div><button data-recovery-download="'+i+'">Download</button><button data-recovery-local="'+i+'">Restore locally</button></article>').join(''));
      on('cloudAllProjects',overview);for(const b of dialog.querySelectorAll('[data-recovery-download]'))b.onclick=()=>api.download(rows[+b.dataset.recoveryDownload].document);
      for(const b of dialog.querySelectorAll('[data-recovery-local]'))b.onclick=()=>action(async()=>{const doc=rows[+b.dataset.recoveryLocal].document;await backup(true);await detach();api.apply(doc);dialog.close();api.toast('Recovery copy restored locally. Save it as JSON or create a new cloud project.');});
    }

    // Read-only sessions cannot invoke drawing/library/property actions. Pan,
    // zoom, sheet navigation, JSON/PDF and the cloud dialog remain accessible.
    function block(event){
      if(!readOnly||dialog.contains(event.target)||event.target.closest?.('.zoom-controls,.newnav,#cloudProjectsBtn,#cloudStatus,#openBtn,#saveBtn,#exportBtn,#fullscreenBtn,#exitFullscreenBtn,#panTool,[data-overview="sheets"],.sheetItem,#simpleClose'))return;
      if(event.type==='keydown'){if(['Escape','PageUp','PageDown','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(event.key))return;}
      else if(event.target.closest?.('#sheet')){if(event.type==='wheel'||event.button===1||$('#panTool')?.getAttribute('aria-pressed')==='true'||event.touches?.length>1)return;}
      else if(!event.target.closest?.('button,form,input,select,textarea,[draggable],#library,#sheetPanel'))return;
      event.preventDefault();event.stopImmediatePropagation();if(event.type==='click'||event.type==='keydown')api.toast('Read-only view. Open the working copy with editor access to make changes.');
    }
    for(const type of ['pointerdown','touchstart','click','dblclick','contextmenu','dragstart','drop','keydown','submit'])window.addEventListener(type,block,{capture:true,passive:false});
    $('#cloudClose').onclick=()=>dialog.close();button.onclick=()=>action(()=>sync?.conflict?conflictView():overview());badge.onclick=()=>action(()=>sync?.conflict?conflictView():project?details():overview());
    const originalLoad=$('#fileInput').onchange;$('#fileInput').onchange=async event=>{try{await safeDetach();await originalLoad(event);}catch(e){event.target.value='';fail(e);}};
    window.addEventListener('beforeunload',event=>{if(sync&&(sync.dirty()||sync.sending||sync.pending||sync.conflict)){event.preventDefault();event.returnValue='';}});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')backup(true).catch(fail);else if(project)presence().catch(fail);});
    // This timer also persists in-flight changes before any network write. Never
    // snapshot partial drags; final pointerup/history commit completes them first.
    setInterval(()=>{if(!project||api.busy()||revisionView)return;backup().then(()=>sync?.tick()).catch(fail);if(connected&&Date.now()-lastPresence>30000)presence().catch(fail);},1000);
    state('local');
    let config=globalThis.LEITWERK_FIREBASE_CONFIG;try{config=JSON.parse(localStorage.getItem('leitwerk.firebase.config')||'null')||config;}catch{/* Setup remains available when browser storage is blocked. */}
    if(config)initialize(config).catch(fail);
    // Expose state, not credentials or a testing backdoor. Useful when reporting
    // a connection problem from an iPad without developer tools.
    return{changed:()=>{if(sync&&!revisionView&&sync.dirty()){state(connected?'pending':'offline-pending');backup().catch(fail);}},state:()=>({status,projectId:project?.id,role:project?.role,readOnly,connected,lastBackupAt})};
  }
};
