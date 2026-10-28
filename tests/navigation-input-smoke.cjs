// Navigation is camera-only: native wheel input and the documented
// 3DconnexionJS camera callbacks must never move electrical objects.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),ROOT=path.resolve(__dirname,'..');
const near=(a,b,t=.4)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const fixture={title:'Navigation devices',sheets:[{id:'drawing',title:'Control',parts:[{id:'p1',type:'resistor',deviceCode:'R1',x:520,y:380},{id:'p2',type:'lamp',deviceCode:'H1',x:650,y:380}],wires:[{id:'w1',a:'p1:1',b:'p2:0',points:[]}]}]};
(async()=>{
 const server=http.createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.resolve(ROOT,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/json');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1500,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let requests=0,sdkRequests=0,failService=false;
  await context.route('**/firebase-config.js*',r=>r.fulfill({contentType:'application/javascript',body:'globalThis.LEITWERK_FIREBASE_CONFIG=null;'}));
  await context.route('https://127.51.68.120:8181/**',r=>{requests++;assert.equal(new URL(r.request().url()).pathname,'/3dconnexion/nlproxy');if(failService)return r.abort('connectionrefused');assert.equal(r.request().headers().referer,undefined);return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"port":8182}'});});
  await context.route('**/vendor/3dconnexion-0.8.0.min.js',r=>{sdkRequests++;return r.fulfill({contentType:'application/javascript',body:`
   const _3Dconnexion=class {
    constructor(client){this.client=client;globalThis.testDriver=this;this.focused=false;this.frames=0;}
    connect(){queueMicrotask(()=>this.client.onConnect());return 1;}
    create3dmouse(viewport,name){this.viewport=viewport;this.name=name;this.onFocus=()=>this.focus();this.onBlur=()=>this.blur();viewport.addEventListener('focus',this.onFocus);viewport.addEventListener('blur',this.onBlur);queueMicrotask(()=>this.client.on3dmouseCreated());}
    update3dcontroller(v){if(v.frame?.time)this.frames++;if(v.commands)this.commands=v.commands;}
    focus(){this.focused=true;}blur(){this.focused=false;}
    delete3dmouse(){this.deleted=true;this.viewport?.removeEventListener('focus',this.onFocus);this.viewport?.removeEventListener('blur',this.onBlur);}close(){this.closed=true;}
   };
   _3Dconnexion.ActionTree=class {constructor(){this.nodes=[];}push(n){this.nodes.push(n);return n;}};
   _3Dconnexion.ActionSet=class extends _3Dconnexion.ActionTree {constructor(id,label){super();this.id=id;this.label=label;}};
   _3Dconnexion.Action=class {constructor(id,label){this.id=id;this.label=label;}};
  `});});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#fileInput').setInputFiles({name:'navigation.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Project loaded');await page.locator('#fitBtn').click();
  const save=async()=>{const[d]=await Promise.all([page.waitForEvent('download'),page.locator('#saveBtn').click()]);const chunks=[];for await(const c of await d.createReadStream())chunks.push(c);return JSON.parse(Buffer.concat(chunks));},baseline=await save();
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const camera=()=>page.locator('#pageContent').getAttribute('transform'),box=()=>page.locator('#parts>g[data-id=p1] .part-geometry').boundingBox();
  const screen=async(x,y)=>page.locator('#pageContent').evaluate((g,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(g.getScreenCTM());return{x:q.x,y:q.y};},{x,y});
  const wheel=async event=>{const accepted=await page.locator('#sheet').evaluate((n,e)=>n.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,...e})),event);assert.equal(accepted,false);await settle();};
  const hover=async()=>{const r=await page.locator('#sheet').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);return r;};
  assert.equal(requests,0);assert.equal(sdkRequests,0);assert.equal(await page.locator('#undoBtn').isEnabled(),false);
  let before=await box();await hover();await page.mouse.wheel(40,65);await settle();let after=await box();near(after.x-before.x,-40);near(after.y-before.y,-65);near(after.width,before.width);assert.equal(await page.locator('#zoomLabel').textContent(),'100%');
  await wheel({deltaY:35,shiftKey:true});let shifted=await box();near(shifted.x-after.x,-35);near(shifted.y,after.y);
  await wheel({deltaX:2,deltaY:-3,deltaMode:1});after=await box();near(after.x-shifted.x,-32);near(after.y-shifted.y,48);
  await page.locator('#fitBtn').click();const r=await hover();before=await box();await wheel({deltaX:.1,deltaY:.15,deltaMode:2});after=await box();near(after.x-before.x,-r.width*.1);near(after.y-before.y,-r.height*.15);
  // Ctrl/Command wheel stays anchored to the actual cursor. Horizontal-only
  // modified scroll must not accidentally zoom out.
  await page.locator('#fitBtn').click();const anchor=await screen(450,350),world=()=>page.locator('#pageContent').evaluate((n,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(n.getScreenCTM().inverse());return{x:q.x,y:q.y};},anchor),oldWorld=await world();before=await box();await wheel({clientX:anchor.x,clientY:anchor.y,deltaY:-100,ctrlKey:true});after=await box();near(after.width/before.width,1.1,.01);near((await world()).x,oldWorld.x,.2);near((await world()).y,oldWorld.y,.2);const unchanged=await camera();await wheel({deltaX:5,deltaY:0,metaKey:true});assert.equal(await camera(),unchanged);
  // Native sidebar scrolling remains independent of the paper camera.
  await page.locator('#catalogSearch').fill('');await page.locator('.sidebar').evaluate(n=>n.scrollTop=0);const sidebar=await page.locator('.sidebar').boundingBox();await page.mouse.move(sidebar.x+40,sidebar.y+sidebar.height/2);await page.mouse.wheel(0,180);await settle();assert.ok(await page.locator('.sidebar').evaluate(n=>n.scrollTop)>0);assert.equal(await camera(),unchanged);
  await page.locator('#spaceMouseBtn').click();assert.equal(requests,0);await wheel({deltaY:30});assert.equal(await camera(),unchanged);await page.locator('#simpleClose').click();
  // An object drag owns its coordinates until release, including if the user
  // simultaneously scrolls. This must not create a move or an Undo entry.
  await page.locator('#fitBtn').click();const hit=await screen(520,380);await page.mouse.move(hit.x,hit.y);await page.mouse.down();const duringDrag=await camera();await page.mouse.wheel(20,25);await settle();assert.equal(await camera(),duringDrag);await page.mouse.up();assert.deepEqual((await save()).sheets,baseline.sheets);assert.equal(await page.locator('#undoBtn').isEnabled(),false);
  await page.locator('[data-overview=sheets]').click();await page.locator('[data-right-sheet="0"]').click();const coverCamera=await camera();await hover();await page.mouse.wheel(15,25);await settle();assert.notEqual(await camera(),coverCamera);assert.deepEqual((await save()).projectInfo,baseline.projectInfo);await page.locator('.sheetItem[data-sheet-kind=drawing]').first().click();await page.locator('#fitBtn').click();
  // Failed service discovery is explicit and retryable; there is no background probe.
  failService=true;await page.locator('#spaceMouseBtn').click();await page.locator('#spaceMouseConnect').click();await page.waitForFunction(()=>document.querySelector('#spaceMouseBtn').dataset.state==='error');assert.match(await page.locator('#spaceMouseSettings [role=status]').textContent(),/Navigation Library Server/);failService=false;await page.locator('#spaceMouseConnect').click();await page.waitForFunction(()=>document.querySelector('#spaceMouseBtn').dataset.state==='connected');assert.equal(requests,2);assert.equal(await page.evaluate(()=>testDriver.commands.tree.nodes[0].nodes[0].id),'LEITWERK_FIT');assert.equal(await page.evaluate(()=>testDriver.name),'Leitwerk');assert.equal(await page.evaluate(()=>testDriver.viewport.id),'sheet');assert.equal(await page.evaluate(()=>testDriver.focused),false);await page.locator('#simpleClose').click();await page.waitForFunction(()=>testDriver.focused);
  const driverCall=(fn,...args)=>page.evaluate(({fn,args})=>testDriver.client[fn](...args),{fn,args});
  assert.equal(await driverCall('getPerspective'),false);assert.equal(await driverCall('getViewRotatable'),false);assert.equal(await driverCall('getSelectionEmpty'),true);near(await driverCall('getUnitsToMeters'),.297/1128,.000001);
  before=await box();let matrix=await driverCall('getViewMatrix');matrix[12]+=24;matrix[13]+=18;await driverCall('setViewMatrix',matrix);await settle();after=await box();assert.ok(after.x<before.x&&after.y>before.y);near(after.width,before.width);
  // Independent SVG measurements verify zoom and camera translation rather
  // than merely checking the reported percentage or mirroring adapter maths.
  const extents=await driverCall('getViewExtents');await driverCall('setViewExtents',extents.map((v,i)=>[0,1,3,4].includes(i)?v/2:v));await settle();const zoomed=await box();near(zoomed.width/after.width,2,.01);assert.equal(await page.locator('#zoomLabel').textContent(),'200%');
  const transactionBefore=await camera();await driverCall('setTransaction',1);matrix=await driverCall('getViewMatrix');matrix[12]-=15;await driverCall('setViewMatrix',matrix);assert.equal(await camera(),transactionBefore);await driverCall('setTransaction',0);assert.notEqual(await camera(),transactionBefore);
  // Rotation terms are ignored and the SVG remains axis-aligned.
  matrix=await driverCall('getViewMatrix');matrix[0]=0;matrix[1]=1;matrix[4]=-1;matrix[5]=0;await driverCall('setViewMatrix',matrix);assert.doesNotMatch(await camera(),/NaN|Infinity|rotate/);
  const valid=await camera();await driverCall('setViewMatrix',[1,2]);await driverCall('setViewExtents',[0,0,0,-1,1,1]);assert.equal(await camera(),valid);
  await driverCall('onStartMotion');await page.waitForFunction(()=>testDriver.frames>1);await driverCall('onStopMotion');const frames=await page.evaluate(()=>testDriver.frames);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>testDriver.frames),frames);
  // Any modal, editable control or inactive window suspends device navigation.
  await page.locator('#projectInfoBtn').click();await page.waitForFunction(()=>!testDriver.focused);const blocked=await camera();matrix[12]+=100;await driverCall('setViewMatrix',matrix);await driverCall('setActiveCommand','LEITWERK_FIT');assert.equal(await camera(),blocked);await page.locator('#simpleClose').click();await page.waitForFunction(()=>testDriver.focused);await page.locator('#cloudProjectsBtn').click();await page.waitForFunction(()=>!testDriver.focused);await driverCall('setViewMatrix',matrix);assert.equal(await camera(),blocked);await page.locator('#cloudClose').click();await page.waitForFunction(()=>testDriver.focused);
  await page.locator('#catalogSearch').focus();await page.waitForFunction(()=>!testDriver.focused);await driverCall('setViewMatrix',matrix);assert.equal(await camera(),blocked);await hover();await page.locator('#sheet').click({position:{x:25,y:25}});await page.waitForFunction(()=>testDriver.focused);
  await page.locator('#zoomIn').click();await page.waitForFunction(()=>testDriver.focused);await driverCall('setActiveCommand','LEITWERK_FIT');assert.equal(await page.locator('#zoomLabel').textContent(),'100%');assert.deepEqual((await save()).sheets,baseline.sheets);assert.deepEqual((await save()).projectInfo,baseline.projectInfo);assert.equal(await page.locator('#undoBtn').isEnabled(),false);
  const inactiveCamera=await camera();await page.evaluate(()=>{Object.defineProperty(document,'hasFocus',{configurable:true,value:()=>false});window.dispatchEvent(new Event('blur'));});await page.waitForFunction(()=>!testDriver.focused);matrix[12]+=20;await driverCall('setViewMatrix',matrix);assert.equal(await camera(),inactiveCamera);await page.evaluate(()=>{delete document.hasFocus;window.dispatchEvent(new Event('focus'));});await page.waitForFunction(()=>testDriver.focused);
  // A viewport change/fullscreen keeps driver-reported view extents consistent.
  await page.locator('#fullscreenBtn').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));await page.setViewportSize({width:1700,height:1100});await settle();const fitMatrix=await driverCall('getViewMatrix');await driverCall('setViewMatrix',fitMatrix);await driverCall('setViewExtents',await driverCall('getViewExtents'));assert.doesNotMatch(await camera(),/NaN|Infinity/);await page.evaluate(()=>document.exitFullscreen());
  await page.screenshot({path:'/tmp/Leitwerk-navigation-devices.png'});
  await page.locator('#spaceMouseBtn').click();await page.locator('#spaceMouseDisconnect').click();assert.equal(await page.locator('#spaceMouseBtn').getAttribute('data-state'),'disconnected');assert.equal(await page.evaluate(()=>testDriver.closed),true);const stopped=await camera();await driverCall('setViewMatrix',matrix);assert.equal(await camera(),stopped);await page.locator('#spaceMouseConnect').click();await page.waitForFunction(()=>document.querySelector('#spaceMouseBtn').dataset.state==='connected');assert.equal(requests,3);assert.equal(sdkRequests,1);await page.locator('#simpleClose').click();await driverCall('onDisconnect');assert.equal(await page.locator('#spaceMouseBtn').getAttribute('data-state'),'error');assert.deepEqual(errors,[]);
  console.log('PASS native vertical/horizontal/Shift wheel pan, line/page units, anchored modified-wheel zoom, sidebar/modal/drag isolation, generated sheets, unchanged document/history; optional 3DconnexionJS driver loading, error/retry/disconnect, orthographic pan/zoom/transactions, rotation lock, focus/modal guards, frame lifecycle, Fit and fullscreen (simulated driver; physical hardware not tested)');
  await context.close();
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
