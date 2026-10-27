// Inspect the actual PDF, independently of the SVG renderer: live text, vector
// operators, internal destinations, fonts, transparency and preserved app state.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium,devices}=require('playwright'),ROOT=path.resolve(__dirname,'..');
const fixture={title:'Vector PDF ÄÖÜ',projectInfo:{company:'Leitwerk test',documentNumber:'LW-PDF-042'},cables:[{id:'c1',number:'W1',type:'Test cable',crossSection:'1.5',cores:[{id:'core1',designation:'L1',masterId:'c1'}]}],sheets:[
 {id:'drawing-a',title:'Power',number:10,parts:[
  {id:'r1',type:'resistor',deviceCode:'R1',value:'4.7 kΩ',x:300,y:320},{id:'h1',type:'lamp',deviceCode:'H1',value:'24 V',x:600,y:320},
  {id:'source',type:'reference',deviceCode:'SRC',x:700,y:450,targetSheetId:'drawing-b',targetPartId:'destination'},
  {id:'relay',type:'relay',deviceCode:'K1',x:200,y:540,relayContactCount:1,pinNumbers:['A1','A2','11','12','14']},
  {id:'strip',type:'terminal-strip',deviceCode:'X1',unplaced:true,x:400,y:540},
  {id:'terminal',type:'connector',masterId:'strip',deviceCode:'X1',terminalNumber:'1',pinNumbers:['1a','1b'],x:400,y:540},
  {id:'terminal2',type:'connector',masterId:'strip',deviceCode:'X1',terminalNumber:'2',pinNumbers:['2a','2b'],x:550,y:540},
  {id:'fo1',type:'fiber-device',deviceCode:'A1',pinNumbers:['TX','RX'],portSides:['left','right'],portKinds:['fiber','fiber'],x:450,y:200},
  {id:'fo2',type:'fiber-device',deviceCode:'A2',pinNumbers:['TX','RX'],portSides:['left','right'],portKinds:['fiber','fiber'],x:650,y:200}
 ],wires:[{id:'w1',a:'r1:1',b:'h1:0',points:[],cableId:'c1',coreId:'core1'},{id:'bridge',kind:'bridge',a:'terminal:8',b:'terminal2:8',points:[]},{id:'fiber',kind:'fiber',a:'fo1:1',b:'fo2:0',points:[]}],redlines:[{id:'highlight',layer:'yellow',points:[{x:300,y:320},{x:600,y:320}]}]},
 {id:'drawing-b',title:'Control',number:30,parts:[
  {id:'destination',type:'destination',deviceCode:'DST',x:700,y:450,targetSheetId:'drawing-a',targetPartId:'source'},
  {id:'coil',type:'relay-coil',deviceCode:'K1',masterId:'relay',pinNumbers:['A1','A2'],x:300,y:250},
  {id:'pin',type:'terminal-pin',deviceCode:'X1',masterId:'terminal',pinIndex:0,value:'1a',pinNumbers:['1a'],x:500,y:350},
  {id:'note',type:'text',label:'Vector check ÄÖÜ — Ω µ mm²',x:500,y:500},
  {id:'broken',type:'reference',deviceCode:'MISSING',x:800,y:250,targetSheetId:'missing-sheet',targetPartId:'missing-part'}
 ],wires:[]}
]};
(async()=>{
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/json');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
 async function inspect(bytes,expected){
  assert.match(bytes.subarray(0,8).toString(),/^%PDF-1.4/);
  const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:false}),doc=await task.promise;assert.equal(doc.numPages,expected.sheets.length);
  const rows=[];for(let i=1;i<=doc.numPages;i++){
   const page=await doc.getPage(i),text=await page.getTextContent(),ops=await page.getOperatorList(),annotations=await page.getAnnotations(),links=[];
   for(const a of annotations)if(a.subtype==='Link'){assert.ok(!a.url,'References must remain internal');assert.ok(Array.isArray(a.dest));const target=await doc.getPageIndex(a.dest[0]);assert.ok(target>=0&&target<doc.numPages);assert.ok(a.rect[2]>a.rect[0]&&a.rect[3]>a.rect[1]);links.push({page:target+1,rect:a.rect,dest:a.dest});}
   const viewport=page.getViewport({scale:1});assert.ok(Math.abs(viewport.width-841.89)<.02);assert.ok(Math.abs(viewport.height-595.28)<.02);
   assert.ok(text.items.length>10,'Every page must contain selectable text');assert.ok(!ops.fnArray.some(n=>[OPS.paintImageXObject,OPS.paintInlineImageXObject,OPS.paintImageMaskXObject].includes(n)),'Pages must contain no raster images');
   rows.push({text:text.items.map(t=>t.str).join(' '),ops,links,textItems:text.items});
  }
  const a=expected.sheets.findIndex(s=>s.id==='drawing-a'),b=expected.sheets.findIndex(s=>s.id==='drawing-b');
  assert.ok(!rows[a].text.includes('Table of contents'),'Hidden generated pages must not leak into the drawing');assert.match(rows[a].text,/4.7 kΩ/);assert.match(rows[b].text,/Vector check ÄÖÜ — Ω μ mm²/);assert.match(rows[a].text,/\/0030\./);assert.match(rows[b].text,/\/0010\./);assert.ok(rows[a].ops.fnArray.includes(OPS.constructPath),'Schematic lines must be vector paths');
  const sourceLink=rows[a].links.find(l=>l.page===b+1&&l.dest[2]>400&&l.dest[2]<600);assert.ok(sourceLink,'Source must jump to the actual target on physical page '+(b+1));assert.ok(rows[b].links.some(l=>l.page===a+1&&l.dest[2]>400&&l.dest[2]<600),'Destination must link back to its source');
  assert.ok(rows[a].links.some(l=>l.page===b+1&&l.dest[2]<200),'Relay/terminal references must reach their separate symbols');assert.ok(rows[b].links.some(l=>l.page===a+1&&l.dest[2]<400),'Slave symbols must link back to their masters');
  for(const kind of ['toc','device-list','terminal-list','cable-list','connection-list']){const index=expected.sheets.findIndex(s=>s.kind===kind);assert.ok(index>=0);assert.ok(rows[index].links.some(l=>l.page===a+1||l.page===b+1),kind+' must link to drawings');}
  assert.ok(rows[a].ops.fnArray.includes(OPS.setDash),'Fiber dash patterns must survive');
  assert.ok(rows[a].ops.fnArray.some((op,i)=>op===OPS.setGState&&JSON.stringify(rows[a].ops.argsArray[i]).includes('0.32')),'Highlighter transparency must survive');
  const result=JSON.parse(JSON.stringify(rows.map(r=>({text:r.text,ops:r.ops,links:r.links}))).replace(/g_d\d+_/g,'g_doc_')); await task.destroy();return result;
 }
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const tablet of [false,true]){
   const context=await browser.newContext(tablet?devices['iPad Pro 11 landscape']:{viewport:{width:1600,height:1100}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/firebase-config.js*',r=>r.fulfill({contentType:'application/javascript',body:'globalThis.LEITWERK_FIREBASE_CONFIG=null;'}));await page.goto('http://127.0.0.1:'+server.address().port);
   const act=async selector=>page.locator(selector)[tablet?'tap':'click']();
   const download=async selector=>{const [d]=await Promise.all([page.waitForEvent('download',{timeout:60000}),act(selector)]);const chunks=[];for await(const c of await d.createReadStream())chunks.push(c);return Buffer.concat(chunks);};
   const save=async()=>JSON.parse((await download('#saveBtn')).toString());
   await page.locator('#fileInput').setInputFiles({name:'vector.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Project loaded');await act('#selectTool');await act('#zoomIn');await page.locator('#parts > g[data-id=r1] .part-body')[tablet?'tap':'click']();
   const before=await save(),view=await page.locator('#pageContent').getAttribute('transform'),grid=await page.locator('#gridToggle').getAttribute('aria-pressed'),selected=await page.locator('#parts > g.selected').getAttribute('data-id');
   // Failed lazy loading preserves the editor and can be retried.
   await context.route('**/vendor/pdf.js*',r=>r.abort());await act('#exportBtn');await page.waitForFunction(()=>document.querySelector('#toast').textContent.startsWith('PDF export failed:'));assert.ok(await page.locator('#exportBtn').isEnabled());assert.equal(await page.locator('#pageContent').getAttribute('transform'),view);assert.deepEqual(await save(),before);await context.unroute('**/vendor/pdf.js*');
   const bytes=await download('#exportBtn');await fs.writeFile('/tmp/Leitwerk-vector-'+(tablet?'ipad':'desktop')+'.pdf',bytes);const first=await inspect(bytes,before);assert.deepEqual(await save(),before);assert.equal(await page.locator('#gridToggle').getAttribute('aria-pressed'),grid);assert.equal(await page.locator('#pageContent').getAttribute('transform'),view);assert.equal(await page.locator('#parts > g.selected').getAttribute('data-id'),selected);
   // Export content is identical with the drawing grid on or off, at another zoom.
   await act('#gridToggle');await act('#zoomOut');const second=await inspect(await download('#exportBtn'),before);assert.deepEqual(second,first);assert.equal(await page.locator('#gridToggle').getAttribute('aria-pressed'),'false');
   await context.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS actual vector PDFs on desktop/iPad: selectable Unicode text, paths without images, A4 landscape, numbered source/destination links across gaps, TOC/device/terminal/cable/connection links, transparency/dashes, grid-free identical output, export retry and preserved drawing/view/selection');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
