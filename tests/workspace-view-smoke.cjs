// Verify rendered desktop drawings through fullscreen/viewport transitions.
// CHROMIUM_PATH can point at Brave or another Chromium browser.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),ROOT=path.resolve(__dirname,'..');
const near=(a,b,t=.3)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
(async()=>{
  const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/json');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:process.env.PLAYWRIGHT_HEADED!=='1',executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const fixture={title:'Desktop view',parts:[{id:'p1',type:'resistor',deviceCode:'R1',label:'R1',x:520,y:380},{id:'p2',type:'lamp',deviceCode:'H1',label:'H1',x:650,y:380}],wires:[{id:'w1',a:'p1:1',b:'p2:0',points:[]}]};
    await page.locator('#fileInput').setInputFiles({name:'desktop.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
    await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Project loaded');
    const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const save=async()=>{const[d]=await Promise.all([page.waitForEvent('download'),page.locator('#saveBtn').click()]);const chunks=[];for await(const c of await d.createReadStream())chunks.push(c);return JSON.parse(Buffer.concat(chunks).toString());};
    const camera=()=>page.locator('#pageContent').evaluate(g=>{const s=document.querySelector('#sheet').getBoundingClientRect(),p=new DOMPoint(s.x+s.width/2,s.y+s.height/2).matrixTransform(g.getScreenCTM().inverse());return{x:p.x,y:p.y,zoom:document.querySelector('#zoomLabel').textContent};});
    const assertCamera=async expected=>{const actual=await camera();near(actual.x,expected.x);near(actual.y,expected.y);assert.equal(actual.zoom,expected.zoom);assert.doesNotMatch(await page.locator('#pageContent').getAttribute('transform'),/NaN|Infinity/);};
    const assertPainted=async label=>{
      await settle();const box=await page.locator('#parts > g[data-id="p1"] .part-geometry').boundingBox(),sheet=await page.locator('#sheet').boundingBox();
      assert.ok(box&&box.width>5&&box.height>3,`${label}: symbol has a visible size`);
      assert.ok(box.x>sheet.x&&box.y>sheet.y&&box.x+box.width<sheet.x+sheet.width&&box.y+box.height<sheet.y+sheet.height,`${label}: drawing remains on screen`);
      // Read screenshot pixels, not just SVG attributes: both terminals must
      // actually paint in the viewport, including after native fullscreen.
      const png=await page.screenshot({clip:{x:Math.floor(box.x)-2,y:Math.floor(box.y)-2,width:Math.ceil(box.width)+4,height:Math.ceil(box.height)+4}});
      const green=await page.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let green=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+1]>80&&pixels[i+1]>pixels[i]+35&&pixels[i+1]>pixels[i+2]+10)green++;return green;},'data:image/png;base64,'+png.toString('base64'));
      assert.ok(green>=2,`${label}: terminals actually painted (${green} green pixels)`);
    };
    await page.locator('#zoomIn').click();await page.locator('#zoomIn').click();await page.locator('#panTool').click();
    const rect=await page.locator('#sheet').boundingBox(),start={x:rect.x+rect.width/2,y:rect.y+rect.height/2};
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+45,start.y-25,{steps:8});await page.mouse.up();await page.locator('#selectTool').click();
    const before=await save(),view=await camera();await assertPainted('windowed');
    await page.locator('#fullscreenBtn').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));await assertPainted('native fullscreen');await assertCamera(view);
    await page.setViewportSize({width:1600,height:1000});await assertPainted('resized fullscreen');await assertCamera(view);
    await page.screenshot({path:'/tmp/Cabel-Studio-v1.29.0-desktop-fullscreen.png'});
    await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>!document.fullscreenElement);assert.equal(await page.locator('.app.focus-mode').count(),1);await assertPainted('browser exited fullscreen');await assertCamera(view);
    await page.locator('#fullscreenBtn').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));await assertPainted('resumed fullscreen');await assertCamera(view);
    await page.locator('#exitFullscreenBtn').click();await page.locator('#fullscreenLeave').click();await page.waitForFunction(()=>!document.fullscreenElement);await assertPainted('explicit exit');await assertCamera(view);
    await page.setViewportSize({width:1280,height:800});await assertPainted('restored window size');await assertCamera(view);assert.deepEqual(await save(),before);assert.deepEqual(errors,[]);
    console.log('PASS painted desktop symbols after zoom/pan, native fullscreen, viewport resize, browser exit, resume and explicit exit; stable camera/document without a corrective zoom');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
