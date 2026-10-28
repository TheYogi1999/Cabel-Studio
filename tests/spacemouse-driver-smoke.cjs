// Exercise the unmodified shipped 3DconnexionJS client against a real TLS/WAMP
// fixture. The fixture is not a Windows driver and cannot verify hardware.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http'),https=require('node:https'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {WebSocketServer}=require('ws'),{chromium}=require('playwright'),ROOT=path.resolve(__dirname,'..'),HOST='127.51.68.120',SDK='3dconnexion-0.8.0.min.js';
const fixture={title:'Real SpaceMouse SDK',sheets:[{id:'drawing',title:'Control',parts:[{id:'r1',type:'resistor',deviceCode:'R1',x:480,y:350}],wires:[]}]};
const waitFor=async(fn,label)=>{const end=Date.now()+15000;while(!fn()){if(Date.now()>end)throw Error('Timeout: '+label);await new Promise(r=>setTimeout(r,20));}};
(async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'leitwerk-3dx-')),key=path.join(folder,'key.pem'),cert=path.join(folder,'cert.pem');let browser,app,proxy,socketServer,wss,page;
 const requests=[],messages=[],protocolErrors=[],pending=new Map();let mode='normal',blockLibrary=false,connection=null,topic=null,serial=0;
 try{
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN='+HOST,'-addext','subjectAltName=IP:'+HOST],{stdio:'ignore'});
  const tls={key:await fs.readFile(key),cert:await fs.readFile(cert)};
  socketServer=https.createServer(tls,(_req,res)=>res.writeHead(404).end());wss=new WebSocketServer({server:socketServer});await new Promise(r=>socketServer.listen(0,HOST,r));
  wss.on('connection',socket=>{
   connection=socket;topic=null;socket.prefixes=new Map();if(mode==='socket-stall')return;
   socket.send(JSON.stringify([0,'sdk-test',1,'Leitwerk WAMP fixture']));
   const resolve=v=>{if(typeof v!=='string')return v;const i=v.indexOf(':');return socket.prefixes.has(v.slice(0,i))?socket.prefixes.get(v.slice(0,i))+v.slice(i+1):v;};
   socket.on('message',bytes=>{try{
    const m=JSON.parse(bytes.toString());messages.push(m);
    if(m[0]===1){socket.prefixes.set(m[1],m[2]);return;}
    if(m[0]===5){topic=resolve(m[1]);return;}
    if(m[0]===3||m[0]===4){const p=pending.get(m[1]);if(p){pending.delete(m[1]);m[0]===3?p.resolve(m[2]):p.reject(Error(String(m[3])));}return;}
    if(m[0]!==2)return;
    const procedure=resolve(m[2]),type=resolve(m[3]);let result=null;
    if(procedure.endsWith('#create')&&type.endsWith('3dmouse'))result={connexion:'mouse-test'};
    else if(procedure.endsWith('#create')&&type.endsWith('3dcontroller')){if(mode==='controller-stall')return;assert.equal(m[5].name,'Leitwerk');assert.equal(m[5].rowMajorOrder,false);result={instance:'controller-test'};}
    else if(!procedure.endsWith('#update')&&!procedure.endsWith('#delete')&&!procedure.endsWith('#read'))throw Error('Unexpected SDK RPC '+JSON.stringify(m));
    socket.send(JSON.stringify([3,m[1],result]));
   }catch(error){protocolErrors.push(error.message);socket.close(1011,'Fixture protocol error');}});
  });
  proxy=https.createServer(tls,(req,res)=>{
   requests.push(req.url);res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Private-Network','true');res.setHeader('Content-Type','application/json');
   if(req.url!=='/3dconnexion/nlproxy'||req.headers.accept!=='application/json; charset=utf-8')return res.writeHead(400).end('Illegal request-target');
   if(mode==='service-fail')return res.writeHead(503).end('{}');
   res.end(JSON.stringify({port:mode==='invalid-port'?'wrong':String(socketServer.address().port)}));
  });await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(8181,HOST,resolve);});
  let libraryRequests=0;
  app=http.createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname;if(name.endsWith('/'+SDK)){libraryRequests++;if(blockLibrary)return res.writeHead(404).end();}const file=path.resolve(ROOT,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/json');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>app.listen(0,'127.0.0.1',r));
  assert.equal(crypto.createHash('sha256').update(await fs.readFile(path.join(ROOT,'vendor',SDK))).digest('hex'),'35bd5fc592b23c3d2ddbe3af1382611656c0db8cca60364d90f6d35589b4152d');
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:1500,height:1000},ignoreHTTPSErrors:true});page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await context.route('**/firebase-config.js*',r=>r.fulfill({contentType:'application/javascript',body:'globalThis.LEITWERK_FIREBASE_CONFIG=null;'}));await page.goto('http://127.0.0.1:'+app.address().port);
  const save=async()=>{const[d]=await Promise.all([page.waitForEvent('download'),page.locator('#saveBtn').click()]);const chunks=[];for await(const c of await d.createReadStream())chunks.push(c);return JSON.parse(Buffer.concat(chunks));};
  const state=async value=>page.waitForFunction(value=>document.querySelector('#spaceMouseBtn').dataset.state===value,value),phase=async value=>assert.equal(await page.locator('#spaceMouseBtn').getAttribute('data-phase'),value),connect=()=>page.locator('#spaceMouseConnect').click(),close=()=>page.locator('#simpleClose').click();
  const call=async(method,property,value)=>{await waitFor(()=>connection?.readyState===1&&topic,'SDK subscription');const id='fixture-'+(++serial);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('SDK callback timed out: '+property));},10000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});connection.send(JSON.stringify([8,topic,[2,id,'self:'+method,'controller-test',property,...(method==='update'?[value]:[])]]));});};
  const read=name=>call('read',name),write=(name,value)=>call('update',name,value),camera=()=>page.locator('#pageContent').getAttribute('transform');
  await page.locator('#fileInput').setInputFiles({name:'sdk.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Project loaded');const baseline=await save();assert.equal(libraryRequests,0);assert.equal(requests.length,0);
  await page.locator('#spaceMouseBtn').click();assert.equal(libraryRequests,0);assert.equal(requests.length,0);assert.ok((await page.locator('#spaceMouseSettings').textContent()).includes('provided under license from 3Dconnexion'));assert.ok((await page.locator('#spaceMouseSettings a').first().getAttribute('href')).endsWith('/3dconnexion/nlproxy'));
  // No JavaScript endpoint is provided by the local driver. Only the app serves
  // the real SDK; the previous implementation failed before any discovery RPC.
  blockLibrary=true;await connect();await state('error');await phase('library');assert.equal(requests.length,0);assert.match(await page.locator('#spaceMouseSettings [role=status]').textContent(),/browser library/);blockLibrary=false;
  mode='invalid-port';await connect();await state('error');await phase('service');assert.match(await page.locator('#spaceMouseSettings [role=status]').textContent(),/Invalid driver response/);
  mode='service-fail';await connect();await state('error');await phase('service');assert.match(await page.locator('#spaceMouseSettings [role=status]').textContent(),/HTTP 503/);
  mode='normal';const manual=await context.request.get('https://'+HOST+':8181/3dconnexion/nlproxy');assert.equal(manual.status(),400);assert.match(await manual.text(),/Illegal request-target/);await connect();await state('connected');await phase('connected');assert.equal(await page.evaluate(()=>typeof _3Dconnexion),'function');assert.ok(messages.some(m=>m[0]===2&&JSON.stringify(m).includes('LEITWERK_FIT')));assert.ok(requests.every(p=>p==='/3dconnexion/nlproxy'));await close();
  await waitFor(()=>messages.some(m=>m[0]===2&&m[4]?.focus===true),'driver focus');assert.equal(await read('view.perspective'),false);assert.ok((await read('view.fov'))>0);assert.equal(await read('view.rotatable'),false);assert.equal(await read('selection.empty'),true);assert.equal((await read('coordinateSystem')).length,16);await assert.rejects(()=>read('unknown.property'),/unknown property/);
  const before=await camera(),matrix=await read('view.affine');matrix[12]+=30;await write('transaction',1);await write('view.affine',matrix);assert.equal(await camera(),before);await write('transaction',0);assert.notEqual(await camera(),before);
  const extents=await read('view.extents');await write('view.extents',extents.map((v,i)=>[0,1,3,4].includes(i)?v/2:v));assert.equal(await page.locator('#zoomLabel').textContent(),'200%');
  const frames=()=>messages.filter(m=>m[0]===2&&m[4]?.frame?.time).length,oldFrames=frames();await write('motion',true);await waitFor(()=>frames()>oldFrames+1,'SDK animation frames');await write('motion',false);await write('commands.activeCommand','LEITWERK_FIT');assert.equal(await page.locator('#zoomLabel').textContent(),'100%');assert.deepEqual((await save()).sheets,baseline.sheets);assert.equal(await page.locator('#undoBtn').isEnabled(),false);
  await page.locator('#projectInfoBtn').click();const paused=await camera();matrix[12]+=20;await write('view.affine',matrix);assert.equal(await camera(),paused);await close();
  await page.locator('#spaceMouseBtn').click();await page.locator('#spaceMouseDisconnect').click();await state('disconnected');await waitFor(()=>messages.some(m=>m[0]===2&&String(m[2]).endsWith('delete')),'controller deletion');
  mode='controller-stall';await connect();await state('error');await phase('controller');assert.match(await page.locator('#spaceMouseSettings [role=status]').textContent(),/controller was not created/);
  mode='socket-stall';await connect();await state('error');await phase('socket');assert.match(await page.locator('#spaceMouseSettings [role=status]').textContent(),/secure navigation connection/);
  mode='normal';await connect();await state('connected');await page.screenshot({path:'/tmp/Leitwerk-spacemouse-driver.png'});await page.locator('#spaceMouseDisconnect').click();await state('disconnected');assert.deepEqual(errors,[]);assert.deepEqual(protocolErrors,[]);assert.equal(libraryRequests,2);await context.close();
  console.log('PASS unmodified bundled 3DconnexionJS 0.8.0 over real HTTPS discovery and WSS/WAMP: no startup probes or local SDK request, RPC/controller/subscription creation, orthographic navigation/transactions/frames/Fit, focus/modal and document/history preservation, explicit library/service/socket/controller failures and retry (simulated driver service; physical Windows hardware not tested)');
 }catch(e){if(page){console.error('SDK DIAGNOSTIC',await page.locator('#spaceMouseSettings [role=status]').textContent().catch(()=>''),'requests',requests,'fixture errors',protocolErrors,'RPC',messages.slice(-8));await page.screenshot({path:'/tmp/Leitwerk-spacemouse-driver-failure.png'}).catch(()=>{});}throw e;}
 finally{if(browser)await browser.close();for(const p of pending.values())p.reject(Error('Fixture stopped'));for(const s of wss?.clients||[])s.terminate();if(wss)await new Promise(r=>wss.close(r));for(const s of [app,proxy,socketServer])if(s?.listening)await new Promise(r=>s.close(r));await fs.rm(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
