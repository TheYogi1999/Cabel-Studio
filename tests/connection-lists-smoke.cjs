// Cable/connection tables share measured wrapping with the device directory.
// Validate actual screen/PDF bounds, complete continuation data and live links.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium,devices}=require('playwright'),ROOT=path.resolve(__dirname,'..');
const longName='REMOTE-'+Array.from({length:650},(_,i)=>'ID'+String(i).padStart(4,'0')).join('');
const cableNumber='W-CONTROL-CABLE-WITH-AN-EXTENDED-IDENTIFIER',coreName=i=>'CONDUCTOR-WITH-A-LONG-IDENTIFIER-'+String(i).padStart(2,'0');
const fixture={title:'Wrapped cable and connection lists',cables:[
 {id:'copper',number:cableNumber,type:'LiYY control cable · 500 V · extended technical designation',crossSection:'1.5',manufacturer:'Example manufacturer',manufacturerNumber:'MATERIAL-IDENTIFIER-WITHOUT-SPACES-'+('ABCD'.repeat(40)),sapNumber:'PROJECT-SPECIFIC-'+('1234'.repeat(40)),description:'Complete cable properties remain visible above the wrapped table.',cores:Array.from({length:11},(_,i)=>({id:'core'+i,masterId:'copper',designation:coreName(i)}))},
 {id:'optical',number:'WF1',medium:'fiber',fiberType:'OM3',cores:[{id:'fo-core',masterId:'optical',designation:'TX'},{id:'fo-unused',masterId:'optical',designation:'RX'}]},
 {id:'empty',number:'W-EMPTY',cores:[]}
],sheets:[{id:'drawing',title:'Power',number:10,parts:[
 {id:'a',type:'resistor',deviceCode:'R1',x:180,y:300},{id:'b',type:'lamp',deviceCode:'H1',x:650,y:300},
 {id:'long',type:'resistor',deviceCode:longName,x:180,y:500},
 {id:'fo-a',type:'fiber-device',deviceCode:'A1',x:400,y:200},{id:'fo-b',type:'fiber-device',deviceCode:'A2',x:650,y:200},
 {id:'strip',type:'terminal-strip',deviceCode:'X1',unplaced:true,x:100,y:600},
 {id:'terminal-a',type:'connector',deviceCode:'X1',masterId:'strip',terminalNumber:'1',pinNumbers:['1a','1b'],x:350,y:600},
 {id:'terminal-b',type:'connector',deviceCode:'X1',masterId:'strip',terminalNumber:'2',pinNumbers:['2a','2b'],x:650,y:600}
],wires:[
 ...Array.from({length:10},(_,i)=>({id:'w'+i,a:'a:1',b:'b:0',points:[],cableId:'copper',coreId:'core'+i})),
 {id:'w-long',a:'long:1',b:'b:0',points:[{x:400,y:500}],cableId:'copper',coreId:'core10'},
 {id:'fo',kind:'fiber',a:'fo-a:1',b:'fo-b:0',points:[],cableId:'optical',coreId:'fo-core'},
 {id:'bridge',kind:'bridge',a:'terminal-a:8',b:'terminal-b:8',points:[]}
]}]};
const columnSets={
 'cable-list':[{key:'conductor',x:46,width:80},{key:'from',x:136,width:340},{key:'to',x:486,width:340},{key:'data',x:836,width:110},{key:'reference',x:956,width:126}],
 'connection-list':[{key:'number',x:46,width:62},{key:'from',x:118,width:280},{key:'to',x:408,width:280},{key:'data',x:698,width:100},{key:'cable',x:808,width:145},{key:'reference',x:963,width:119}]
};
(async()=>{
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/json');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const tablet of [false,true]){
   const context=await browser.newContext(tablet?devices['iPad Pro 11 landscape']:{viewport:{width:1600,height:1100}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await context.route('**/firebase-config.js*',r=>r.fulfill({contentType:'application/javascript',body:'globalThis.LEITWERK_FIREBASE_CONFIG=null;'}));await page.goto('http://127.0.0.1:'+server.address().port);
   const act=async selector=>page.locator(selector)[tablet?'tap':'click'](),download=async selector=>{const [d]=await Promise.all([page.waitForEvent('download',{timeout:60000}),act(selector)]);const chunks=[];for await(const c of await d.createReadStream())chunks.push(c);return Buffer.concat(chunks);},save=async()=>JSON.parse((await download('#saveBtn')).toString());
   const load=async data=>{await page.locator('#fileInput').setInputFiles({name:'lists.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Project loaded');};
   await load(fixture);const before=await save(),indices=before.sheets.flatMap((s,i)=>columnSets[s.kind]?[i]:[]),screenText={'cable-list':[],'connection-list':[]};let continued=0;const pageTops=new Map();
   for(const kind of Object.keys(columnSets)){
    const count=await page.locator('.sheetItem[data-sheet-kind="'+kind+'"]').count();assert.ok(count>1);
    for(let i=0;i<count;i++){
     await page.locator('.sheetItem[data-sheet-kind="'+kind+'"]').nth(i)[tablet?'tap':'click']();const content=await page.locator('#deviceListContent').textContent();assert.ok(!content.includes('All wires, fiber optic connections and terminal bridges'));assert.equal(await page.locator('#deviceListContent text[font-size="22"]').count(),0);
     const rows=await page.locator('.list-table-row').evaluateAll(nodes=>nodes.map(row=>{const stripe=row.firstElementChild.getBBox();return{top:stripe.y,bottom:stripe.y+stripe.height,continued:row.dataset.continued,cells:[...row.querySelectorAll('.list-table-cell')].map(cell=>({key:cell.dataset.column,x:+cell.dataset.columnX,width:+cell.dataset.columnWidth,lines:[...cell.querySelectorAll('text')].map(t=>{const b=t.getBBox();return{text:t.textContent,x:b.x,y:b.y,width:b.width,height:b.height};})}))};}));
     pageTops.set(indices.filter(index=>before.sheets[index].kind===kind)[i],rows[0]?.top??Infinity);let bottom=0;for(const row of rows){assert.ok(row.top>=bottom-.01&&row.bottom<=690.01);bottom=row.bottom;if(row.continued==='true')continued++;for(const cell of row.cells)for(const line of cell.lines){assert.ok(line.x>=cell.x-2&&line.x+line.width<=cell.x+cell.width+2,JSON.stringify({kind,cell,line}));if(line.text)assert.ok(line.y>=row.top&&line.y+line.height<=row.bottom,JSON.stringify({kind,row,line}));if(cell.key==='from')screenText[kind].push(line.text);}}
     if(i===0)await page.screenshot({path:'/tmp/Leitwerk-'+kind+'-'+(tablet?'ipad':'desktop')+'.png'});
    }
   }
   assert.ok(continued>=2);for(const values of Object.values(screenText))assert.ok(values.join('').replace(/\s/g,'').includes(longName));
   await page.locator('.sheetItem[data-sheet-kind=connection-list]').first()[tablet?'tap':'click']();await page.locator('.connection-list-link').first()[tablet?'tap':'click']();assert.equal(await page.locator('path.wire.selected').getAttribute('data-id'),'w0');
   const bytes=await download('#exportBtn');await fs.writeFile('/tmp/Leitwerk-connection-lists-'+(tablet?'ipad':'desktop')+'.pdf',bytes);const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:false}),pdf=await task.promise;assert.equal(pdf.numPages,before.sheets.length);const printed={'cable-list':[],'connection-list':[]},all=[];
   for(const index of indices){const kind=before.sheets[index].kind,p=await pdf.getPage(index+1),content=await p.getTextContent(),ops=await p.getOperatorList();assert.ok(!ops.fnArray.includes(OPS.paintImageXObject));let links=0;for(const a of await p.getAnnotations())if(a.subtype==='Link'){assert.ok(Array.isArray(a.dest));const target=await pdf.getPageIndex(a.dest[0]);assert.ok(target>=0&&target<pdf.numPages);links++;}assert.ok(links>0);
    for(const item of content.items){if(!item.str)continue;all.push(item.str);const x=item.transform[4]*1128/841.89,y=(595.28-item.transform[5])*798/595.28;if(y<(pageTops.get(index)??86)-1||y>690)continue;const column=columnSets[kind].find(c=>Math.abs(c.x-x)<2);if(column){assert.ok(item.width*1128/841.89<=column.width+2,JSON.stringify({kind,text:item.str,column,width:item.width*1128/841.89}));if(column.key==='from')printed[kind].push(item.str);}}
   }
   for(const values of Object.values(printed))assert.ok(values.join('').replace(/\s/g,'').includes(longName));const text=all.join(' ');for(const expected of ['OM3','Bridge','Unassigned','No conductors in this cable.','Complete cable properties'])assert.ok(text.includes(expected),expected);await task.destroy();assert.deepEqual((await save()).sheets,before.sheets);assert.deepEqual((await save()).cables,before.cables);await context.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS compact cable/connection lists, preserved cable properties, shared wrapping, long conductor/cable IDs and multi-page endpoints, no screen/PDF column or page overflow, complete continuation text, copper/fiber/bridges, empty cables, clickable rows/PDF links and unchanged projects on desktop/iPad');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
