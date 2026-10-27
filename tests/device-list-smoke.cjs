// Check rendered cell/page bounds and independently inspect the generated PDF.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium,devices}=require('playwright'),ROOT=path.resolve(__dirname,'..');
const huge=Array.from({length:250},(_,i)=>'VALUE'+String(i).padStart(3,'0')).join('');
const fixture={title:'Wrapped device directory',sheets:[{id:'drawing',title:'Devices',parts:[
 ...Array.from({length:25},(_,i)=>({id:'p'+i,type:'resistor',deviceCode:'R'+(i+1),x:180+(i%5)*170,y:200+Math.floor(i/5)*80,deviceType:'Precision monitoring resistor with extended operating specifications '+i,value:'24 V DC / 230 V AC; 16 A; resistance 4.7 kΩ; extended electrical operating range '+i,manufacturerNumber:'MATERIAL-IDENTIFIER-WITHOUT-SPACES-'+i,sapNumber:'PROJECT-SPECIFIC-LONG-MATERIAL-NUMBER-'+i})),
 {id:'huge',type:'resistor',deviceCode:'R99',unplaced:true,x:100,y:100,value:huge},
 {id:'single',type:'resistor',deviceCode:'Z',x:100,y:600,value:'5',manufacturerNumber:'7',sapNumber:'9'}
],wires:[]}]};
(async()=>{
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/json');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const tablet of [false,true]){
   const context=await browser.newContext(tablet?devices['iPad Pro 11 landscape']:{viewport:{width:1600,height:1100}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await context.route('**/firebase-config.js*',r=>r.fulfill({contentType:'application/javascript',body:'globalThis.LEITWERK_FIREBASE_CONFIG=null;'}));await page.goto('http://127.0.0.1:'+server.address().port);
   const act=async selector=>page.locator(selector)[tablet?'tap':'click']();
   const load=async data=>{await page.locator('#fileInput').setInputFiles({name:'devices.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Project loaded');};
   const download=async selector=>{const [d]=await Promise.all([page.waitForEvent('download',{timeout:60000}),act(selector)]);const chunks=[];for await(const c of await d.createReadStream())chunks.push(c);return Buffer.concat(chunks);},save=async()=>JSON.parse((await download('#saveBtn')).toString());
   // Compact rows retain the existing 22-row pagination.
   await load({title:'Short rows',sheets:[{id:'short',title:'Short rows',parts:Array.from({length:45},(_,i)=>({id:'short'+i,type:'resistor',deviceCode:'R'+i,x:100,y:100})),wires:[]}]});assert.equal(await page.locator('.sheetItem[data-sheet-kind=device-list]').count(),3);
   await load(fixture);const before=await save(),listIndices=before.sheets.flatMap((s,i)=>s.kind==='device-list'?[i]:[]);assert.ok(listIndices.length>3);const fragments=[];
   for(let i=0;i<listIndices.length;i++){
    await page.locator('.sheetItem[data-sheet-kind=device-list]').nth(i)[tablet?'tap':'click']();const heading=await page.locator('#deviceListContent').textContent();for(const removed of ['Automatic device directory','Master devices · generated','Generated automatically from project'])assert.ok(!heading.includes(removed));
    const rows=await page.locator('.device-list-row').evaluateAll(nodes=>nodes.map(row=>{const stripe=row.firstElementChild.getBBox(),cells=[...row.querySelectorAll('.device-list-cell')].map(cell=>({key:cell.dataset.column,x:+cell.dataset.columnX,width:+cell.dataset.columnWidth,lines:[...cell.querySelectorAll('text')].map(t=>{const b=t.getBBox();return{text:t.textContent,x:b.x,y:b.y,width:b.width,height:b.height};})}));return{id:row.dataset.partId,continued:row.dataset.continued,top:stripe.y,bottom:stripe.y+stripe.height,height:stripe.height,cells};}));
    let bottom=86;for(const row of rows){assert.ok(row.top>=bottom-.001);assert.ok(row.bottom<=690.001);assert.ok(row.height>=25);bottom=row.bottom;for(const cell of row.cells)for(const line of cell.lines){assert.ok(line.x>=cell.x-2&&line.x+line.width<=cell.x+cell.width+2,JSON.stringify({row:row.id,cell,line}));if(line.text)assert.ok(line.y>=row.top&&line.y+line.height<=row.bottom,JSON.stringify({row,line}));}}fragments.push(...rows);
    if(i===0){assert.ok(rows[0].height>25);assert.ok(rows[0].cells.find(c=>c.key==='type').lines.length>1);assert.ok(rows[0].cells.find(c=>c.key==='value').lines.length>1);await page.screenshot({path:'/tmp/Leitwerk-device-list-'+(tablet?'ipad':'desktop')+'.png'});}
   }
   for(const part of fixture.sheets[0].parts){const rows=fragments.filter(r=>r.id===part.id);assert.ok(rows.length);const value=rows.flatMap(r=>r.cells.find(c=>c.key==='value').lines.map(l=>l.text)).join('').replace(/\s/g,'');assert.equal(value,part.value.replace(/\s/g,''));}assert.ok(fragments.some(r=>r.id==='huge'&&r.continued==='true'));
   // Full row hit areas still navigate to the original placed device.
   await page.locator('.sheetItem[data-sheet-kind=device-list]').first()[tablet?'tap':'click']();await act('.device-list-link[data-part-id=p0]');assert.ok(await page.locator('#parts > g[data-id=p0]').isVisible());
   const bytes=await download('#exportBtn');await fs.writeFile('/tmp/Leitwerk-device-list-'+(tablet?'ipad':'desktop')+'.pdf',bytes);const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:false}),pdf=await task.promise;assert.equal(pdf.numPages,before.sheets.length);const printed=[],printedValues=[];
   for(const index of listIndices){const p=await pdf.getPage(index+1),content=await p.getTextContent(),items=content.items.filter(item=>item.str);let links=0;for(const annotation of await p.getAnnotations())if(annotation.subtype==='Link')links++;assert.ok(links>0);for(const item of items){const x=item.transform[4]*1128/841.89,y=(595.28-item.transform[5])*798/595.28;if(y<86||y>690)continue;const cell=CabelColumns().filter(c=>Math.abs(c.x-x)<2).at(0);if(cell){const width=item.width*1128/841.89;assert.ok(width<=cell.width+2,JSON.stringify({text:item.str,column:cell.key,width}));}printed.push(item.str);if(x>=539&&x<676)printedValues.push(item.str);}assert.ok(!items.some(item=>/Automatic device directory|Master devices · generated/.test(item.str)));}
   const allText=printedValues.join('').replace(/\s/g,'');assert.ok(allText.includes(huge));await task.destroy();assert.deepEqual((await save()).sheets,before.sheets);await context.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS compact device directory without automatic/master headings, measured multi-line cells, unbroken material IDs, dynamic row heights, 22 short rows/page, long-row continuation, no lost values or page/column overflow, working device/PDF links and unchanged JSON on desktop/iPad');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
function CabelColumns(){return[{key:'aks',x:46,width:194},{key:'designation',x:250,width:165},{key:'type',x:425,width:105},{key:'value',x:540,width:135},{key:'manufacturer',x:685,width:155},{key:'sap',x:850,width:155},{key:'reference',x:1015,width:67}];}
