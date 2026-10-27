// Freehand annotations, whole-stroke erasing and ordinary tablet tool semantics.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium,devices}=require('playwright'),ROOT=path.resolve(__dirname,'..');
const near=(a,b,t=.06)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`),drawings=p=>p.sheets.filter(s=>!s.kind);
const fixture={title:'Red pen review',sheets:[{id:'power',title:'Power',parts:[{id:'p1',type:'resistor',label:'R1',deviceCode:'R1',x:300,y:300},{id:'p2',type:'lamp',label:'H1',deviceCode:'H1',x:600,y:300}],wires:[]},{id:'control',title:'Control',parts:[],wires:[]}]};
(async()=>{
  const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/json');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    const url=`http://127.0.0.1:${server.address().port}/`,errors=[];
    async function setup(page){
      page.setDefaultTimeout(10000);page.on('pageerror',e=>{errors.push(e.message);console.error('Browser:',e.message);});await page.goto(url);
      const download=async id=>{const[d]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.locator('#'+id).click()]);const chunks=[];for await(const c of await d.createReadStream())chunks.push(c);return Buffer.concat(chunks);};
      const save=async()=>JSON.parse((await download('saveBtn')).toString());
      const load=async data=>{await page.locator('#fileInput').setInputFiles({name:'redlines.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Project loaded');await page.locator('#selectTool').click();await page.locator('#fitBtn').click();};
      const screen=(x,y)=>page.locator('#pageContent').evaluate((g,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(g.getScreenCTM());return{x:q.x,y:q.y};},{x,y});
      const world=p=>page.locator('#pageContent').evaluate((g,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(g.getScreenCTM().inverse());return{x:q.x,y:q.y};},p);
      const view=()=>page.locator('#pageContent').getAttribute('transform');
      const point=async locator=>{const b=await locator.boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2};};
      await load(fixture);return{save,load,screen,world,view,point,download};
    }
    const page=await browser.newPage({viewport:{width:1500,height:1000}}),a=await setup(page);
    const mouseStroke=async points=>{const first=await a.screen(...points[0]);await page.mouse.move(first.x,first.y);await page.mouse.down();for(const p of points.slice(1)){const q=await a.screen(...p);await page.mouse.move(q.x,q.y,{steps:4});}await page.mouse.up();};
    const clickWorld=async p=>{const q=await a.screen(p.x,p.y);await page.mouse.click(q.x,q.y);};
    const baseline=await a.save();await page.locator('#redPenTool').click();assert.equal(await page.locator('#redPenTool').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#selectTool').getAttribute('aria-pressed'),'false');
    await mouseStroke([[220,180],[240,150],[280,180],[320,160],[350,200]]);let project=await a.save();assert.equal(drawings(project)[0].redlines.length,1);assert.ok(drawings(project)[0].redlines[0].points.length>5);
    assert.deepEqual(drawings(project)[0].parts,drawings(baseline)[0].parts);assert.deepEqual(drawings(project)[0].wires,[]);
    await page.locator('#undoBtn').click();assert.deepEqual(await a.save(),baseline);await page.locator('#redoBtn').click();assert.deepEqual(await a.save(),project);
    await mouseStroke([[450,180],[520,180]]);await mouseStroke([[700,500],[700,550]]);const annotated=await a.save();assert.equal(drawings(annotated)[0].redlines.length,3);
    await page.locator('#redPenSelect').click();await clickWorld({x:280,y:180});assert.equal(await page.locator('[data-red-pen-handle]').count(),4);
    await mouseStroke([[280,180],[320,210]]);project=await a.save();let original=drawings(annotated)[0].redlines[0],moved=drawings(project)[0].redlines[0];for(let i=0;i<original.points.length;i++){near(moved.points[i].x,original.points[i].x+40);near(moved.points[i].y,original.points[i].y+30);}
    await page.locator('#undoBtn').click();assert.deepEqual(await a.save(),annotated);await page.locator('#redoBtn').click();assert.deepEqual(await a.save(),project);
    await clickWorld(moved.points[0]);await page.locator('#redPenLarger').click();let scaled=drawings(await a.save())[0].redlines[0];near((Math.max(...scaled.points.map(p=>p.x))-Math.min(...scaled.points.map(p=>p.x)))/(Math.max(...moved.points.map(p=>p.x))-Math.min(...moved.points.map(p=>p.x))),1.25,.002);
    await page.locator('#redPenSmaller').click();assert.deepEqual(drawings(await a.save())[0].redlines,drawings(project)[0].redlines);
    const handle=await a.point(page.locator('[data-red-pen-handle="se"]')),start=await a.world(handle),anchor={x:Math.min(...moved.points.map(p=>p.x)),y:Math.min(...moved.points.map(p=>p.y))},end=await a.screen(anchor.x+2*(start.x-anchor.x),anchor.y+2*(start.y-anchor.y));
    await page.mouse.move(handle.x,handle.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:6});await page.mouse.up();scaled=drawings(await a.save())[0].redlines[0];for(let i=0;i<moved.points.length;i++){near(scaled.points[i].x,anchor.x+2*(moved.points[i].x-anchor.x));near(scaled.points[i].y,anchor.y+2*(moved.points[i].y-anchor.y));}
    await page.locator('#undoBtn').click();assert.deepEqual(drawings(await a.save())[0].redlines,drawings(project)[0].redlines);
    await clickWorld(moved.points[0]);const cancelHandle=await a.point(page.locator('[data-red-pen-handle="se"]'));await page.mouse.move(cancelHandle.x,cancelHandle.y);await page.mouse.down();await page.mouse.move(cancelHandle.x+35,cancelHandle.y+25,{steps:4});await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(drawings(await a.save())[0].redlines,drawings(project)[0].redlines);
    await mouseStroke([[200,120],[550,260]]);const third=drawings(await a.save())[0].redlines[2];await page.locator('#redPenLarger').click();const group=await a.save();assert.deepEqual(drawings(group)[0].redlines[2],third);assert.notDeepEqual(drawings(group)[0].redlines[1],drawings(project)[0].redlines[1]);
    await page.keyboard.press('Control+a');assert.equal(await page.locator('#parts > g.selected').count(),0);await page.locator('#redPenDelete').click();assert.equal(drawings(await a.save())[0].redlines.length,0);await page.locator('#undoBtn').click();assert.deepEqual(await a.save(),group);
    await page.locator('#redPenErase').click();const second=drawings(group)[0].redlines[1];await clickWorld(second.points[1]);let erased=await a.save();assert.equal(drawings(erased)[0].redlines.length,2);assert.ok(!drawings(erased)[0].redlines.some(s=>s.id===second.id));assert.deepEqual(drawings(erased)[0].parts,drawings(baseline)[0].parts);await page.locator('#undoBtn').click();assert.deepEqual(await a.save(),group);
    await mouseStroke([[650,525],[750,525]]);erased=await a.save();assert.equal(drawings(erased)[0].redlines.length,2);assert.ok(!drawings(erased)[0].redlines.some(s=>s.id===third.id));await page.locator('#undoBtn').click();assert.deepEqual(await a.save(),group);
    console.log('PASS desktop freehand, individual/group selection, movement, exact uniform handle/button scaling, cancellation, whole-stroke erasing and single-action undo/redo without changing electrical objects');
    await page.reload();await a.load(group);assert.deepEqual(drawings(await a.save()),drawings(group));assert.equal(await page.locator('[data-redline]').count(),3);
    await page.locator('#redPenTool').click();await page.locator('#redPenSelect').click();await clickWorld(drawings(group)[0].redlines[0].points[0]);const beforeExport=await a.save(),camera=await a.view();assert.equal(await page.locator('[data-red-pen-handle]').count(),4);
    await fs.writeFile('/tmp/Cabel-Studio-red-pen.pdf',await a.download('exportBtn'));await fs.writeFile('/tmp/Cabel-Studio-red-pen.expected.json',JSON.stringify({pages:beforeExport.sheets.length}));assert.deepEqual(await a.save(),beforeExport);assert.equal(await a.view(),camera);assert.equal(await page.locator('[data-red-pen-handle]').count(),4);await page.screenshot({path:'/tmp/Cabel-Studio-v1.33.1-red-pen-desktop.png'});
    await page.keyboard.press('PageDown');assert.equal(await page.locator('[data-redline]').count(),0);await page.locator('#redPenDraw').click();await mouseStroke([[250,400],[300,420]]);assert.equal(drawings(await a.save())[1].redlines.length,1);await page.locator('#undoBtn').click();assert.ok(!drawings(await a.save())[1].redlines);await page.keyboard.press('PageUp');assert.equal(await page.locator('[data-redline]').count(),3);
    console.log('PASS independent sheet annotations, legacy files without redlines, JSON roundtrip, PDF export and restored selection/view');

    const context=await browser.newContext(devices['iPad Pro 11 landscape']),tablet=await context.newPage(),t=await setup(tablet),client=await context.newCDPSession(tablet);
    const touch=(type,points)=>client.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,i)=>({...p,id:p.id??i+1}))});
    const tap=async id=>{await tablet.locator('#'+id).tap();await tablet.waitForTimeout(110);};
    const fingerStroke=async points=>{const first=await t.screen(...points[0]);await touch('touchStart',[first]);for(const p of points.slice(1))await touch('touchMove',[await t.screen(...p)]);await touch('touchEnd',[]);};
    const fingerTap=async p=>{await touch('touchStart',[p]);await touch('touchEnd',[]);};
    const pen=(type,p,down=true)=>client.send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,pointerType:'pen',button:type==='mouseMoved'?'none':'left',buttons:down?1:0,force:down?.6:0,clickCount:1});
    let oldView=await t.view();await fingerStroke([[250,250],[350,350]]);assert.equal(await t.view(),oldView);assert.equal(await tablet.locator('#parts > g[data-id="p1"].selected').count(),1);
    await tap('wireTool');const terminal=i=>tablet.locator(`[data-part="p${i}"][data-term="${i===1?1:0}"]`);await fingerTap(await t.point(terminal(1)));await fingerStroke([[400,380],[450,410]]);assert.equal(await t.view(),oldView);assert.equal(await tablet.locator('#wireTool').textContent(),'Wire');await fingerTap(await t.point(terminal(2)));assert.equal(drawings(await t.save())[0].wires.length,1);
    await tap('redPenTool');await fingerStroke([[250,180],[280,150],[330,190],[370,160]]);let tabletProject=await t.save();assert.equal(drawings(tabletProject)[0].redlines.length,1);assert.equal(await t.view(),oldView);
    const penStart=await t.screen(450,430),penEnd=await t.screen(530,460);await pen('mousePressed',penStart);await pen('mouseMoved',penEnd);const palm={x:penEnd.x+40,y:penEnd.y+35,id:41};await touch('touchStart',[palm]);await touch('touchMove',[{...palm,x:palm.x+25}]);await touch('touchEnd',[]);await pen('mouseReleased',penEnd,false);tabletProject=await t.save();assert.equal(drawings(tabletProject)[0].redlines.length,2);assert.equal(await t.view(),oldView);
    const first=await t.screen(420,230),secondPoint={x:first.x+70,y:first.y};await touch('touchStart',[first]);await touch('touchMove',[{x:first.x+12,y:first.y+8}]);await touch('touchStart',[{x:first.x+12,y:first.y+8},secondPoint]);await touch('touchMove',[{x:first.x-20,y:first.y+8},{x:secondPoint.x+30,y:secondPoint.y}]);await touch('touchEnd',[]);assert.deepEqual(await t.save(),tabletProject);assert.equal(await tablet.locator('[data-red-pen-draft]').count(),0);assert.notEqual(await t.view(),oldView);
    await tap('redPenErase');const inkPoint=await t.screen(450,430);await touch('touchStart',[inkPoint]);assert.equal(await tablet.locator('[data-redline]').count(),1);await touch('touchCancel',[]);assert.deepEqual(await t.save(),tabletProject);
    await fingerTap(inkPoint);assert.equal(drawings(await t.save())[0].redlines.length,1);await tap('undoBtn');assert.deepEqual(await t.save(),tabletProject);
    await tap('redPenSelect');await fingerTap(await t.screen(280,150));const selected=await t.save();await tap('redPenLarger');const resized=await t.save();assert.notDeepEqual(drawings(resized)[0].redlines[0],drawings(selected)[0].redlines[0]);assert.deepEqual(drawings(resized)[0].redlines[1],drawings(selected)[0].redlines[1]);await tap('undoBtn');assert.deepEqual(await t.save(),selected);
    await tablet.screenshot({path:'/tmp/Cabel-Studio-v1.33.1-red-pen-ipad.png'});await tablet.setViewportSize({width:834,height:1194});await tablet.screenshot({path:'/tmp/Cabel-Studio-v1.33.1-red-pen-ipad-portrait.png'});assert.deepEqual(errors,[]);
    console.log('PASS tablet Select/Connect without automatic single-finger pan, finger/Pencil drawing, palm rejection, pinch rollback, whole-stroke erase/cancel, selection/scaling and both orientations');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
