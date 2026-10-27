// Rendered regression: long port names must stay outside the device frame,
// including reflected/rotated devices, zoom, touch editing and PDF export.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium,devices}=require('playwright'),ROOT=path.resolve(__dirname,'..');
const motorNames=['U1','V1','W1','PROTECTIVE_EARTH_RETURN'];
const names=['INPUT_SUPPLY_POSITIVE','INPUT_SUPPLY_RETURN','OUTPUT_CHANNEL_ACTIVE','OUTPUT_CHANNEL_RETURN'];
function fixture(rotation){return{title:'Long pin labels',sheets:[{id:'drawing',title:'Port names',parts:Array.from({length:4},(_,i)=>({id:'p'+i,type:'io-module',deviceCode:'A'+(i+1),x:i%2?780:300,y:i<2?250:550,rotation,flipX:Boolean(i&1),flipY:Boolean(i&2),pinNumbers:names,portSides:['left','left','right','right']})).concat({id:'motor-center',type:'motor-ac-3p',deviceCode:'M1',x:550,y:400,rotation,pinNumbers:motorNames}),wires:[{id:'w1',a:'p0:2',b:'p1:0',points:[]}]}]};}
(async()=>{
 const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/json');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const tablet of [false,true]){
   const context=await browser.newContext(tablet?devices['iPad Pro 11 landscape']:{viewport:{width:1600,height:1100}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/firebase-config.js*',r=>r.fulfill({contentType:'application/javascript',body:'globalThis.LEITWERK_FIREBASE_CONFIG=null;'}));
   await page.goto('http://127.0.0.1:'+server.address().port);
   const act=async selector=>page.locator(selector)[tablet?'tap':'click']();
   const download=async selector=>{const [d]=await Promise.all([page.waitForEvent('download',{timeout:60000}),act(selector)]);const chunks=[];for await(const c of await d.createReadStream())chunks.push(c);return Buffer.concat(chunks);};
   const save=async()=>JSON.parse((await download('#saveBtn')).toString());
   async function check(rotation){
    const rows=await page.locator('#parts > g[data-id]').evaluateAll(roots=>roots.filter(root=>root.querySelector('.port-block-frame')).flatMap(root=>{
     const frame=root.querySelector('.port-block-frame').getBoundingClientRect(),ports=[...root.querySelectorAll('.terminal')];
     return [...root.querySelectorAll('.pin-label')].map((label,i)=>{const box=label.getBoundingClientRect(),port=ports[i].getBoundingClientRect(),m=label.getCTM();return{id:root.dataset.id,text:label.textContent,frame:{left:frame.left,right:frame.right,top:frame.top,bottom:frame.bottom},label:{left:box.left,right:box.right,top:box.top,bottom:box.bottom},pin:{x:(port.left+port.right)/2,y:(port.top+port.bottom)/2},determinant:m.a*m.d-m.b*m.c};});
    }));
    const motor=await page.locator('#parts > g[data-id=\"motor-center\"]').evaluate(root=>{const circle=root.querySelector('circle.symbol').getBoundingClientRect();return [...root.querySelectorAll('.pin-label')].map(n=>{const b=n.getBoundingClientRect();return{label:n.textContent,overlap:b.left<circle.right&&b.right>circle.left&&b.top<circle.bottom&&b.bottom>circle.top};});});for(const row of motor)assert.equal(row.overlap,false,'Pin label must clear the motor body: '+JSON.stringify(row));
    assert.equal(rows.length,16);
    for(const row of rows){const {frame:f,label:b,pin:p}=row;assert.ok(row.determinant>0,'Pin text must not inherit reflection');
     if(rotation%180===0){if(p.x<(f.left+f.right)/2){assert.ok(b.right<f.left,JSON.stringify(row));assert.ok(b.right<p.x,JSON.stringify(row));}else{assert.ok(b.left>f.right,JSON.stringify(row));assert.ok(b.left>p.x,JSON.stringify(row));}}
     else if(p.y<(f.top+f.bottom)/2)assert.ok(b.bottom<f.top,JSON.stringify(row));else assert.ok(b.top>f.bottom,JSON.stringify(row));
    }
   }
   for(const rotation of [0,90,180,270]){
    const data=fixture(rotation);await page.locator('#fileInput').setInputFiles({name:'pins.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Project loaded');await act('#selectTool');await act('#fitBtn');await check(rotation);
    const doc=await save(),drawing=doc.sheets.find(s=>s.id==='drawing');for(const p of drawing.parts)assert.deepEqual(p.pinNumbers,p.id==='motor-center'?motorNames:names);assert.equal(drawing.wires[0].a,'p0:2');assert.equal(drawing.wires[0].b,'p1:0');
    await act('#zoomIn');await check(rotation);await act('#fitBtn');
    if(rotation===0)await page.screenshot({path:'/tmp/Leitwerk-pin-labels-'+(tablet?'ipad':'desktop')+'.png'});
   }
   // Renaming through properties takes effect immediately and participates in history.
   if(tablet){await page.locator('#parts > g[data-id=p0] .part-body').tap();await act('#propertiesBtn');}else await page.locator('#parts > g[data-id=p0] .part-body').click({button:'right'});
   const renamed=names.map(n=>n+'_LONG_EXTENSION');await page.locator('#componentForm [name=pinNumbers]').fill(renamed.join('; '));await act('#componentForm [type=submit]');await check(270);assert.deepEqual(await page.locator('#parts > g[data-id=p0] .pin-label').allTextContents(),renamed.map(n=>':'+n));await act('#undoBtn');assert.deepEqual(await page.locator('#parts > g[data-id=p0] .pin-label').allTextContents(),names.map(n=>':'+n));await act('#redoBtn');await check(270);
   const before=await save(),pdf=await download('#exportBtn');assert.equal(pdf.subarray(0,5).toString(),'%PDF-');await check(270);assert.deepEqual((await save()).sheets,before.sheets);
   await context.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS long left/right pin labels outside device frames for all quarter-turns and reflections, unchanged pin IDs/connections, zoom, desktop/iPad properties, undo/redo and PDF');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
