/* Optional 3DconnexionJS adapter. The installed driver supplies its own SDK;
   no device model, raw HID report or application document is sent to a server. */
globalThis.CabelSpaceMouse={
  init(api){
    const SDK='https://127.51.68.120:8181/3dconnexion/3dconnexion.js';
    const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
    const button=document.createElement('button');button.id='spaceMouseBtn';button.type='button';button.textContent='3D';api.controls.append(button);
    let driver=null,attempt=0,timer=null,scriptPromise=null,frame=null,moving=false,transaction=false,pending=null,state='disconnected',message='Not connected.',lastPointer=null,lastFocus=null;
    const constructor=()=>typeof _3Dconnexion==='function'?_3Dconnexion:globalThis.TDx?._3Dconnexion;
    function allowed(){return state==='connected'&&document.hasFocus()&&!document.hidden&&api.canNavigate()&&!document.activeElement?.closest('input,textarea,select,[contenteditable="true"]');}
    function update(){
      button.dataset.state=state;button.setAttribute('aria-label','SpaceMouse settings · '+state);button.title='SpaceMouse · '+state;
      const form=document.querySelector('#spaceMouseSettings');if(!form)return;
      form.querySelector('[role=status]').textContent=message;form.querySelector('#spaceMouseConnect').disabled=state==='connecting'||state==='connected';form.querySelector('#spaceMouseDisconnect').disabled=state!=='connecting'&&state!=='connected';
    }
    function setState(value,text){state=value;message=text;update();}
    function stopMotion(){moving=false;cancelAnimationFrame(frame);frame=null;transaction=false;pending=null;}
    function syncFocus(force=false){
      const focus=allowed();if(!force&&focus===lastFocus)return;lastFocus=focus;
      if(!focus)stopMotion();if(driver&&state==='connected')try{focus?driver.focus():driver.blur();}catch{/* A disconnected driver is reported by onDisconnect. */}
    }
    function dispose(){
      const old=driver;driver=null;clearTimeout(timer);timer=null;stopMotion();lastFocus=null;
      if(old){try{old.blur();old.delete3dmouse();}catch{/* Driver may already have gone away. */}try{old.close();}catch{}}
    }
    function disconnect(){attempt++;dispose();setState('disconnected','Not connected.');}
    function fail(token){if(token!==attempt)return;attempt++;dispose();setState('error','Cannot reach the 3Dconnexion driver. Install/update 3DxWare, ensure its Navigation Library Server is running, and allow local-network access for this site if your browser asks. Then retry.');}
    function loadSDK(){
      if(constructor())return Promise.resolve();if(scriptPromise)return scriptPromise;
      scriptPromise=new Promise((resolve,reject)=>{
        const script=document.createElement('script'),timeout=setTimeout(()=>finish(false),8000);
        function finish(ok){clearTimeout(timeout);script.onload=script.onerror=null;if(ok&&constructor())resolve();else{script.remove();scriptPromise=null;reject(Error('Driver SDK unavailable'));}}
        script.src=SDK;script.referrerPolicy='no-referrer';script.onload=()=>finish(true);script.onerror=()=>finish(false);document.head.append(script);
      });return scriptPromise;
    }
    // The driver's world is X-right/Y-up. The SVG uses X-right/Y-down.
    // These are camera-to-world matrices (column major), as required by the SDK.
    function viewport(){
      const r=api.svg.getBoundingClientRect(),a=api.svgPoint({clientX:r.left,clientY:r.top}),b=api.svgPoint({clientX:r.right,clientY:r.bottom});
      return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,width:b.x-a.x,height:b.y-a.y};
    }
    function camera(){
      if(pending)return{...pending};const v=api.view(),c=viewport();
      return{x:(c.x-v.pan.x-564*(1-v.zoom))/v.zoom,y:-(c.y-v.pan.y-399*(1-v.zoom))/v.zoom,zoom:v.zoom};
    }
    function flush(){
      const p=pending;pending=null;if(!p||!allowed())return;const c=viewport(),z=Math.max(.5,Math.min(4,p.zoom));
      api.setView({zoom:z,pan:{x:c.x-564*(1-z)-p.x*z,y:c.y-399*(1-z)+p.y*z}});
    }
    function change(fn){if(!allowed())return;pending=fn(camera());if(!transaction)flush();}
    function tick(time){frame=null;if(!moving||!allowed()){syncFocus();return;}try{driver.update3dcontroller({frame:{time}});}catch{fail(attempt);return;}frame=requestAnimationFrame(tick);}
    function settings(){
      api.panel('<h2>SpaceMouse</h2><div id="spaceMouseSettings"><p>Use a 3Dconnexion SpaceMouse to pan and zoom the sheet. Rotation stays locked for the 2D drawing. This connection uses the installed 3DxWare driver and supports its SpaceMouse models without model-specific configuration.</p><p>Install/update 3DxWare with its Navigation Library Server on a supported desktop system. Allow local-network access for Leitwerk if your browser asks. Close this dialog to navigate. Mouse/trackpad scrolling works independently of the driver.</p><p role="status"></p><div class="actions"><button id="spaceMouseConnect">Connect</button><button id="spaceMouseDisconnect">Disconnect</button></div></div>');
      document.querySelector('#spaceMouseConnect').onclick=connect;document.querySelector('#spaceMouseDisconnect').onclick=disconnect;update();
    }
    async function connect(){
      if(state==='connected'||state==='connecting')return;const token=++attempt;dispose();setState('connecting','Connecting to the local 3Dconnexion driver…');
      try{
        await loadSDK();if(token!==attempt)return;timer=setTimeout(()=>fail(token),10000);
        const current=()=>token===attempt&&driver===instance;
        const client={
          onConnect(){if(!current()){instance.close();return;}instance.create3dmouse(api.svg,'Leitwerk');},
          on3dmouseCreated(){
            if(!current()){instance.close();return;}clearTimeout(timer);setState('connected','Connected. Close this dialog to pan and zoom.');
            instance.update3dcontroller({frame:{timingSource:1}});
            const C=constructor();if(C.ActionTree&&C.ActionSet&&C.Action){const tree=new C.ActionTree(),set=tree.push(new C.ActionSet('Default','Leitwerk'));set.push(new C.Action('LEITWERK_FIT','Fit sheet','Fit and centre the current sheet'));instance.update3dcontroller({commands:{activeSet:'Default',tree}});}
            lastFocus=null;syncFocus();
          },
          onDisconnect(){if(current())fail(token);},
          getCoordinateSystem:identity,getFrontView:identity,getPerspective:()=>false,getViewRotatable:()=>false,getSelectionEmpty:()=>true,
          getUnitsToMeters:()=>.297/1128,getModelExtents:()=>[0,-798,-.1,1128,0,.1],getConstructionPlane:()=>[0,0,1,0],
          getViewMatrix(){const c=camera(),m=identity();m[12]=c.x;m[13]=c.y;m[14]=1000;return m;},
          getViewExtents(){const c=camera(),v=viewport();return[-v.width/c.zoom/2,-v.height/c.zoom/2,-1000,v.width/c.zoom/2,v.height/c.zoom/2,1000];},
          getViewTarget(){const c=camera();return[c.x,c.y,0];},
          getPointerPosition(){if(lastPointer){const p=api.world({clientX:lastPointer.x,clientY:lastPointer.y});return[p.x,-p.y,0];}return this.getViewTarget();},
          getPivotPosition(){return this.getPointerPosition();},getFrameTime:()=>performance.now(),
          setViewMatrix(m){if(!current()||!Array.isArray(m)||m.length!==16||!m.every(Number.isFinite))return;change(c=>({...c,x:m[12],y:m[13]}));},
          setViewExtents(e){if(!current()||!Array.isArray(e)||e.length!==6||!e.every(Number.isFinite)||e[3]<=e[0]||e[4]<=e[1])return;change(c=>({...c,x:c.x+(e[0]+e[3])/2,y:c.y+(e[1]+e[4])/2,zoom:viewport().width/(e[3]-e[0])}));},
          setTarget(p){if(current()&&Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))change(c=>({...c,x:p[0],y:p[1]}));},
          setTransaction(value){if(!current())return;if(value>0){transaction=true;pending=null;}else{transaction=false;flush();}},
          setActiveCommand(id){if(current()&&allowed()&&id==='LEITWERK_FIT')api.fit();},
          onStartMotion(){if(!current()||!allowed())return;moving=true;if(frame===null)frame=requestAnimationFrame(tick);},
          onStopMotion(){if(current())stopMotion();}
        };
        const instance=new (constructor())(client);driver=instance;if(!instance.connect())fail(token);
      }catch{fail(token);}
    }
    button.onclick=settings;
    api.svg.setAttribute('tabindex','0');
    // Selection tools prevent the pointer's default focus change. Transfer it
    // explicitly before those handlers so clicking the drawing leaves inputs.
    document.addEventListener('pointerdown',e=>{if(state==='connected'&&e.target instanceof Element&&api.svg.contains(e.target)&&api.canNavigate())api.svg.focus({preventScroll:true});},true);
    api.svg.addEventListener('pointermove',e=>{lastPointer={x:e.clientX,y:e.clientY};});
    for(const name of ['focus','blur'])window.addEventListener(name,syncFocus);
    for(const name of ['focusin','focusout','visibilitychange','pointerup','pointercancel'])document.addEventListener(name,()=>queueMicrotask(()=>syncFocus(true)));
    const observer=new MutationObserver(syncFocus);for(const node of document.querySelectorAll('#simpleModal,#cloudDialog'))observer.observe(node,{attributes:true,attributeFilter:['style','open']});
    window.addEventListener('pagehide',disconnect);update();
    return{refresh:syncFocus};
  }
};
