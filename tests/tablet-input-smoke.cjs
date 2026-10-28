// Exercise native browser touch/pen input and Safari's fixed-target Touch API.
// PLAYWRIGHT_BROWSER=webkit additionally runs this in an installed WebKit engine.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium,webkit,devices}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),GRID=4*1128/297;
const near=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`),drawings=p=>p.sheets.filter(s=>!s.kind);
(async()=>{
  const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.webmanifest')?'application/manifest+json':'application/json');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    const useWebkit=process.env.PLAYWRIGHT_BROWSER==='webkit';
    browser=await(useWebkit?webkit:chromium).launch(useWebkit?{headless:true}:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    const context=await browser.newContext(devices['iPad Pro 11 landscape']),page=await context.newPage(),errors=[];
    page.setDefaultTimeout(10000);page.on('pageerror',e=>{errors.push(e.message);console.error('Browser:',e.message);});
    const client=useWebkit?null:await context.newCDPSession(page),url=`http://127.0.0.1:${server.address().port}/`;
    await page.goto(url);
    const download=async selector=>{const[file]=await Promise.all([page.waitForEvent('download'),page.locator(selector).click()]);const chunks=[];for await(const c of await file.createReadStream())chunks.push(c);return Buffer.concat(chunks);};
    const save=async()=>JSON.parse((await download('#saveBtn')).toString());
    const load=async p=>{await page.locator('#fileInput').setInputFiles({name:'tablet.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Project loaded');await page.locator('#selectTool').click();await page.locator('#fitBtn').click();};
    const screen=(x,y)=>page.locator('#pageContent').evaluate((g,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(g.getScreenCTM());return{x:q.x,y:q.y};},{x,y});
    const view=()=>page.locator('#pageContent').getAttribute('transform');
    const tapControl=async id=>{await page.locator('#'+id).tap();await page.waitForTimeout(110);};
    const targetPoint=async locator=>{const r=await locator.boundingBox();assert.ok(r,'Target is visible');return{x:r.x+r.width/2,y:r.y+r.height/2};};
    const symbolBox=()=>page.locator('#parts > g[data-id="p1"] .part-geometry').boundingBox();
    const apiTouch=async(type,points)=>page.evaluate(({type,points})=>{
      window.testTouchTargets??=new Map();window.testTouchPoints??=new Map();
      const before=window.testTouchPoints,current=new Map(points.map((p,i)=>[p.id??i+1,p]));
      for(const[id,p]of current)if(!window.testTouchTargets.has(id))window.testTouchTargets.set(id,document.elementFromPoint(p.x,p.y));
      const make=(id,p)=>new Touch({identifier:id,target:window.testTouchTargets.get(id),clientX:p.x,clientY:p.y,screenX:p.x,screenY:p.y,pageX:p.x,pageY:p.y,radiusX:1,radiusY:1,force:.5});
      const active=[...current].map(([id,p])=>make(id,p));
      const changed=type==='touchend'||type==='touchcancel'?[...before].filter(([id])=>!current.has(id)).map(([id,p])=>make(id,p)):type==='touchstart'?[...current].filter(([id])=>!before.has(id)).map(([id,p])=>make(id,p)):active;
      const target=changed[0]?.target||document.querySelector('#sheet'),event=new TouchEvent(type,{bubbles:true,cancelable:true,touches:active,targetTouches:active,changedTouches:changed});
      target.dispatchEvent(event);window.testTouchPoints=current;
      for(const[id]of before)if(!current.has(id))window.testTouchTargets.delete(id);
      return{prevented:event.defaultPrevented,connected:target.isConnected};
    },{type,points});
    const touch=(type,points)=>client?client.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,i)=>({...p,id:p.id??i+1}))}):apiTouch(type.toLowerCase(),points);
    const pen=async(type,p,down=true)=>{
      if(client)return client.send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,pointerType:'pen',button:type==='mouseMoved'?'none':'left',buttons:down?1:0,force:down?.6:0,clickCount:type==='mouseMoved'?0:1});
      return page.evaluate(({type,p,down})=>{const target=document.elementFromPoint(p.x,p.y)||document.querySelector('#sheet');target.dispatchEvent(new PointerEvent({mousePressed:'pointerdown',mouseMoved:'pointermove',mouseReleased:'pointerup'}[type],{bubbles:true,cancelable:true,pointerId:71,pointerType:'pen',button:0,buttons:down?1:0,clientX:p.x,clientY:p.y}));},{type,p,down});
    };
    const penTap=async p=>{await pen('mousePressed',p);await pen('mouseReleased',p,false);};
    const penDrag=async(a,b)=>{await pen('mousePressed',a);for(let i=1;i<=8;i++)await pen('mouseMoved',{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8});await pen('mouseReleased',b,false);};
    const fingerDrag=async(a,b)=>{await touch('touchStart',[a]);for(let i=1;i<=8;i++)await touch('touchMove',[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8}]);await touch('touchEnd',[]);};
    const assertLayout=async()=>{
      const l=await page.locator('.sidebar').boundingBox(),r=await page.locator('#sheetPanel').boundingBox(),c=await page.locator('#sheet').boundingBox(),h=await page.locator('header').boundingBox();
      assert.ok(l&&r&&c);assert.ok(c.x>=l.x+l.width-1);assert.ok(c.x+c.width<=r.x+1);assert.ok(c.y>=h.y+h.height);assert.ok(c.width>300);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.locator('#bridgeTool').isVisible(),false);assert.equal(await page.locator('#touchEditToggle').count(),0);
      assert.equal(await page.locator('#mirrorYBtn svg').count(),1);assert.doesNotMatch(await page.locator('#mirrorYBtn').textContent(),/↕/);
      for(const id of['selectTool','wireTool','panTool','propertiesBtn','fullscreenBtn'])assert.ok((await page.locator('#'+id).boundingBox()).height>=44);
    };
    const fixture={title:'iPad input',sheets:[{id:'ipad-main',title:'Power distribution',parts:[
      {id:'p1',type:'resistor',deviceCode:'R1',label:'R1',x:20*GRID,y:20*GRID},
      {id:'p2',type:'lamp',deviceCode:'H1',label:'H1',x:40*GRID,y:20*GRID},
      {id:'p3',type:'coil',deviceCode:'K1',label:'K1',x:25*GRID,y:25*GRID,unplaced:true}
    ],wires:[],aksAreas:[{id:'ipad-field',title:'Control',x:6*GRID,y:6*GRID,width:5*GRID,height:4*GRID,functionCode:'F1'}]}]};
    await load(fixture);await assertLayout();const untouched=await save();
    let a=await screen(15*GRID,30*GRID),b={x:a.x+55,y:a.y+25},oldView=await view(),beforeBox=await symbolBox();
    await tapControl('panTool');
    await fingerDrag(a,b);assert.notEqual(await view(),oldView);let afterBox=await symbolBox();near(afterBox.x-beforeBox.x,55,.3);near(afterBox.y-beforeBox.y,25,.3);assert.deepEqual(await save(),untouched);assert.equal(await page.locator('#undoBtn').isEnabled(),false);
    await tapControl('selectTool');await page.locator('#fitBtn').click();const center=await screen(30*GRID,22*GRID);
    const worldAt=p=>page.locator('#pageContent').evaluate((g,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(g.getScreenCTM().inverse());return{x:q.x,y:q.y};},p),anchor=await worldAt(center);
    beforeBox=await symbolBox();await touch('touchStart',[{x:center.x-45,y:center.y},{x:center.x+45,y:center.y}]);
    await touch('touchMove',[{x:center.x-80,y:center.y},{x:center.x+80,y:center.y}]);await touch('touchEnd',[]);
    assert.ok(parseInt(await page.locator('#zoomLabel').textContent())>160);afterBox=await symbolBox();near(afterBox.width/beforeBox.width,160/90,.01);near(afterBox.height/beforeBox.height,160/90,.01);assert.doesNotMatch(await view(),/NaN|Infinity/);const afterAnchor=await worldAt(center);near(anchor.x,afterAnchor.x,.3);near(anchor.y,afterAnchor.y,.3);assert.deepEqual(await save(),untouched);
    // Check pixels and placement in the SAME view: an invalid gesture transform
    // used to change only the percentage, then silently reject every drop.
    beforeBox=await symbolBox();await tapControl('zoomIn');afterBox=await symbolBox();near(afterBox.width/beforeBox.width,1.15,.01);
    await tapControl('zoomOut');near((await symbolBox()).width/beforeBox.width,1,.01);
    {
      await page.locator('#catalogSearch').fill('Resistor');const source=page.locator('.part[data-type="resistor"]');
      a=await targetPoint(source);b=await screen(27*GRID,25*GRID);
      await touch('touchStart',[a]);await touch('touchMove',[{x:a.x+24,y:a.y}]);await touch('touchMove',[b]);assert.equal(await page.locator('#sheet').getAttribute('data-drop-valid'),'true');await touch('touchEnd',[]);
      let saved=await save(),added=drawings(saved)[0].parts.find(p=>!['p1','p2','p3'].includes(p.id));assert.ok(added,'Finger drop after pinch creates a component');near(added.x,27*GRID);near(added.y,25*GRID);
      let visible=await targetPoint(page.locator(`#parts > g[data-id="${added.id}"] .part-body`));near(visible.x,b.x,.3);near(visible.y,b.y,.3);
      await tapControl('undoBtn');assert.deepEqual(await save(),untouched);await tapControl('redoBtn');assert.deepEqual(await save(),saved);await tapControl('undoBtn');
      // Pencil Pan must visibly move the paper; dropping afterwards uses that
      // new position rather than stale or non-finite document coordinates.
      await tapControl('panTool');beforeBox=await symbolBox();a=await screen(30*GRID,28*GRID);b={x:a.x+20,y:a.y-12};await penDrag(a,b);afterBox=await symbolBox();near(afterBox.x-beforeBox.x,20,.3);near(afterBox.y-beforeBox.y,-12,.3);
      await tapControl('selectTool');a=await targetPoint(source);b=await screen(25*GRID,23*GRID);await penDrag(a,b);
      saved=await save();added=drawings(saved)[0].parts.find(p=>!['p1','p2','p3'].includes(p.id));assert.ok(added,'Pencil drop after pinch and pan creates a component');near(added.x,25*GRID);near(added.y,23*GRID);
      visible=await targetPoint(page.locator(`#parts > g[data-id="${added.id}"] .part-body`));near(visible.x,b.x,.3);near(visible.y,b.y,.3);await tapControl('undoBtn');assert.deepEqual(await save(),untouched);
    }
    console.log('PASS visible symbol scaling/translation, +/- controls and actual finger/Pencil drops after pinch and pan without Fit/reload, exact placement and undo/redo');
    await page.locator('#fitBtn').click();await tapControl('panTool');oldView=await view();
    await penDrag(await screen(20*GRID,20*GRID),await screen(24*GRID,23*GRID));assert.notEqual(await view(),oldView);assert.deepEqual(await save(),untouched);await tapControl('selectTool');await page.locator('#fitBtn').click();
    console.log('PASS permanently visible panels, stable mirror SVGs, single-finger pan, anchored pinch and Pencil Pan without changing the document');

    await fingerDrag(await screen(20*GRID,20*GRID),await screen(23*GRID,22*GRID));let p=drawings(await save())[0].parts.find(p=>p.id==='p1');near(p.x,23*GRID);near(p.y,22*GRID);
    await tapControl('undoBtn');near(drawings(await save())[0].parts[0].x,20*GRID);await tapControl('redoBtn');near(drawings(await save())[0].parts[0].x,23*GRID);
    await penDrag(await screen(23*GRID,22*GRID),await screen(26*GRID,23*GRID));p=drawings(await save())[0].parts[0];near(p.x,26*GRID);near(p.y,23*GRID);
    await load(fixture);
    // The second finger cancels an initial object drag, then owns navigation.
    a=await screen(20*GRID,20*GRID);b={x:a.x+18,y:a.y+10};
    await touch('touchStart',[a]);await touch('touchMove',[b]);await touch('touchStart',[b,{x:b.x+65,y:b.y}]);await touch('touchMove',[{x:b.x-15,y:b.y},{x:b.x+90,y:b.y}]);await touch('touchEnd',[]);
    assert.deepEqual(await save(),untouched);assert.equal(await page.locator('#undoBtn').isEnabled(),false);
    await page.locator('#fitBtn').click();
    // Dispatch against the original Touch.target, even after the app redraws it.
    a=await screen(20*GRID,20*GRID);b=await screen(24*GRID,24*GRID);
    await apiTouch('touchstart',[a]);const move=await apiTouch('touchmove',[{x:(a.x+b.x)/2,y:(a.y+b.y)/2}]);assert.equal(move.prevented,true);assert.equal(move.connected,true);
    await apiTouch('touchmove',[b]);await apiTouch('touchend',[]);p=drawings(await save())[0].parts[0];near(p.x,24*GRID);near(p.y,24*GRID);
    assert.equal(await page.locator('.input-target-keeper > *').count(),0);
    const beforePenCancel=await save();a=await screen(24*GRID,24*GRID);b=await screen(28*GRID,26*GRID);
    await page.evaluate(()=>window.addEventListener('pointerdown',e=>{window.testPenId=e.pointerId;},{once:true,capture:true}));
    await pen('mousePressed',a);await pen('mouseMoved',b);
    await page.locator('#sheet').dispatchEvent('pointercancel',{pointerId:await page.evaluate(()=>window.testPenId),pointerType:'pen',bubbles:true,cancelable:true});
    await pen('mouseReleased',b,false);assert.deepEqual(await save(),beforePenCancel);
    const beforePalm=await view();a=await screen(24*GRID,24*GRID);await pen('mousePressed',a);
    const palm={x:a.x+70,y:a.y+30,id:51};await apiTouch('touchstart',[palm]);await apiTouch('touchmove',[{...palm,x:palm.x+35}]);await apiTouch('touchend',[]);
    assert.equal(await view(),beforePalm);await pen('mouseReleased',a,false);
    assert.deepEqual(await save(),beforePenCancel);
    console.log('PASS direct finger/Pencil editing, single-step history, drag-to-pinch rollback and Safari fixed-target Touch Events across redraws');

    await page.locator('#catalogSearch').fill('Resistor');let source=page.locator('.part[data-type="resistor"]');a=await targetPoint(source);b=await screen(12*GRID,30*GRID);
    await touch('touchStart',[a]);await touch('touchMove',[{x:a.x+24,y:a.y}]);assert.equal(await page.locator('.library-drag-ghost').count(),1);
    await touch('touchMove',[b]);await touch('touchEnd',[]);let project=await save(),added=drawings(project)[0].parts.find(p=>!['p1','p2','p3'].includes(p.id));assert.ok(added);near(added.x,12*GRID);near(added.y,30*GRID);
    await page.locator('#catalogSearch').fill('Lamp');source=page.locator('.part[data-type="lamp"]');await penDrag(await targetPoint(source),await screen(34*GRID,30*GRID));
    project=await save();assert.equal(drawings(project)[0].parts.filter(p=>p.type==='lamp').length,2);assert.equal(await page.locator('.library-drag-ghost').count(),0);
    await tapControl('selectTool');await page.locator('[data-overview="devices"]').tap();source=page.locator('[data-device-id="p3"] > summary .device-jump');await source.scrollIntoViewIfNeeded();
    await penDrag(await targetPoint(source),await screen(30*GRID,32*GRID));p=drawings(await save())[0].parts.find(p=>p.id==='p3');assert.ok(!p.unplaced);near(p.x,30*GRID);near(p.y,32*GRID);
    await page.locator('[data-library-mode="products"]').tap();await page.locator('#catalogSearch').fill('S201');source=page.locator('.catalog-part').first();
    await penDrag(await targetPoint(source),await screen(16*GRID,35*GRID));assert.ok(drawings(await save())[0].parts.some(p=>p.catalog?.libraryId==='abb'));
    const beforeCancel=await save();source=page.locator('.catalog-part').first();a=await targetPoint(source);
    await touch('touchStart',[a]);await touch('touchMove',[{x:a.x+25,y:a.y}]);await touch('touchCancel',[]);assert.deepEqual(await save(),beforeCancel);assert.equal(await page.locator('.library-drag-ghost').count(),0);
    console.log('PASS actual finger/Pencil drag-and-drop from generic/product libraries and device overview, exact grid positions and cancelled drops');

    await load(fixture);a=await screen(20*GRID,20*GRID);await pen('mousePressed',a);await page.waitForTimeout(650);await pen('mouseReleased',a,false);
    assert.equal(await page.locator('#componentForm').isVisible(),true);await page.locator('#componentCancel').tap();
    await page.locator('#catalogSearch').fill('Resistor');await page.locator('[data-library-mode="generic"]').tap();await page.locator('.part[data-type="resistor"]').tap();
    await penTap(await screen(14*GRID,32*GRID));assert.equal(drawings(await save())[0].parts.filter(p=>p.type==='resistor').length,2);
    const field=page.locator('[data-aks-area="ipad-field"] [data-field-resize="se"]');await penDrag(await targetPoint(field),await screen(13*GRID,12*GRID));near(drawings(await save())[0].aksAreas[0].width,7*GRID);
    console.log('PASS tap-then-place, Pencil properties and Field resizing without Touch edit');

    const routing={title:'Automatic connection',sheets:[{id:'routing',title:'Terminals',parts:[
      {id:'x1',type:'terminal-strip',deviceCode:'X1',label:'X1',x:6*GRID,y:6*GRID,unplaced:true},
      {id:'x2',type:'terminal-strip',deviceCode:'X2',label:'X2',x:6*GRID,y:6*GRID,unplaced:true},
      {id:'c1',type:'connector',masterId:'x1',deviceCode:'X1',label:'X1',pinNumbers:['1a','1b'],terminalNumber:'1',x:20*GRID,y:20*GRID},
      {id:'c2',type:'connector',masterId:'x1',deviceCode:'X1',label:'X1',pinNumbers:['2a','2b'],terminalNumber:'2',x:30*GRID,y:20*GRID},
      {id:'c3',type:'connector',masterId:'x2',deviceCode:'X2',label:'X2',pinNumbers:['1a','1b'],terminalNumber:'1',x:40*GRID,y:20*GRID},
      {id:'h1',type:'lamp',deviceCode:'H1',label:'H1',x:40*GRID,y:30*GRID}
    ],wires:[]}]};
    await load(routing);await tapControl('wireTool');const term=(id,i)=>page.locator(`[data-part="${id}"][data-term="${i}"]`).evaluate(n=>{const p=new DOMPoint(n.cx.baseVal.value,n.cy.baseVal.value).matrixTransform(n.getScreenCTM());return{x:p.x,y:p.y};});
    await penTap(await term('c1',8));assert.equal(await page.locator('#wireTool').textContent(),'Bridge');
    await penTap(await term('h1',0));assert.match(await page.locator('#toast').textContent(),/matching ports/);assert.equal(drawings(await save())[0].wires.length,0);
    await penTap(await term('c2',8));let wires=drawings(await save())[0].wires;assert.equal(wires.length,1);assert.equal(wires[0].kind,'bridge');assert.equal(wires[0].a,'c1:8');assert.equal(wires[0].b,'c2:8');
    assert.equal(await page.locator('#wireTool').textContent(),'Connect');await penTap(await term('c1',1));assert.equal(await page.locator('#wireTool').textContent(),'Wire');await penTap(await term('h1',0));
    wires=drawings(await save())[0].wires;assert.equal(wires.length,2);assert.equal(wires.filter(w=>w.kind==='bridge').length,1);
    await penTap(await term('c1',8));await penTap(await term('c3',8));assert.equal(await page.locator('#toast').textContent(),'Bridges must stay within the same terminal strip');assert.equal(drawings(await save())[0].wires.length,2);await page.keyboard.press('Escape');
    console.log('PASS one automatic Connect/Wire/Bridge button, dedicated bridge endpoints, ordinary wires, incompatible ports and cross-strip rejection');

    await page.locator('[data-overview="sheets"]').tap();await tapControl('fullscreenBtn');await page.waitForFunction(()=>document.querySelector('.app.focus-mode'));
    await assertLayout();const inFocus=await save();
    if(await page.evaluate(()=>Boolean(document.fullscreenElement)))await page.evaluate(()=>document.exitFullscreen());
    assert.equal(await page.locator('.app.focus-mode').count(),1);assert.deepEqual(await save(),inFocus);
    const gesturePrevented=await page.locator('#sheet').evaluate(n=>{const e=new Event('gesturechange',{bubbles:true,cancelable:true});n.dispatchEvent(e);return e.defaultPrevented;});assert.equal(gesturePrevented,true);
    await tapControl('fullscreenBtn');assert.equal(await page.locator('.app.focus-mode').count(),1);
    await tapControl('exitFullscreenBtn');assert.equal(await page.locator('#fullscreenKeep').isVisible(),true);await page.locator('#fullscreenKeep').tap();assert.equal(await page.locator('.app.focus-mode').count(),1);
    await tapControl('exitFullscreenBtn');await page.locator('#fullscreenLeave').tap();await page.waitForFunction(()=>!document.querySelector('.app.focus-mode'));
    await page.setViewportSize({width:834,height:1194});await assertLayout();await page.screenshot({path:'/tmp/Cabel-Studio-v1.38.0-ipad-portrait.png'});
    await page.setViewportSize({width:1194,height:834});await page.screenshot({path:'/tmp/Cabel-Studio-v1.38.0-ipad-landscape.png'});
    project=await save();const pdf=await download('#exportBtn');assert.match(pdf.toString('latin1',0,8),/^%PDF-1.4/);await fs.writeFile('/tmp/Cabel-Studio-tablet.pdf',pdf);await fs.writeFile('/tmp/Cabel-Studio-tablet.expected.json',JSON.stringify({pages:project.sheets.length}));
    await page.reload();await load(project);assert.deepEqual(drawings(await save()),drawings(project));
    const manifest=await(await page.request.get(url+'manifest.webmanifest')).json();assert.equal(manifest.display,'standalone');assert.equal(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content'),'yes');
    assert.equal((await page.request.get(url+'icons/apple-touch-icon.png')).status(),200);
    const fallback=await browser.newPage({viewport:{width:1280,height:800}});await fallback.addInitScript(()=>{Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:undefined});Object.defineProperty(Element.prototype,'webkitRequestFullscreen',{configurable:true,value:undefined});});
    await fallback.goto(url);await fallback.locator('#panTool').click();await fallback.keyboard.press('c');assert.equal(await fallback.locator('#panTool').getAttribute('aria-pressed'),'false');
    await fallback.locator('#fullscreenBtn').click();await fallback.keyboard.press('Escape');assert.equal(await fallback.locator('.app.focus-mode').count(),1);await fallback.locator('#exitFullscreenBtn').click();await fallback.locator('#fullscreenLeave').click();assert.equal(await fallback.locator('.app.focus-mode').count(),0);await fallback.close();
    assert.deepEqual(errors,[]);
    console.log('PASS preserved focus after browser fullscreen exit, Safari gesture prevention, explicit exit confirmation, permanent panels in both orientations, home-screen manifest, JSON/PDF and desktop shortcuts');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
