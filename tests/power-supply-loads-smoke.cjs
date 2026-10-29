const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const{chromium,devices}=require('playwright'),ROOT=path.resolve(__dirname,'..');
(async()=>{
  const catalogs=await Promise.all(['phoenix-contact','beckhoff'].map(async id=>JSON.parse(await fs.readFile(path.join(ROOT,'libraries',id+'.json'))))),products=new Map(catalogs.flatMap(l=>l.families.flatMap(f=>f.products.map(p=>[l.id+':'+p.id,{l,p}]))));
  function product(key,id,code,x,y){const{l,p}=products.get(key),attributes=structuredClone(p.attributes);delete attributes.loadModel;return{id,type:p.symbol,deviceCode:code,deviceType:p.model,x,y,pinNumbers:p.pinNumbers,portKinds:p.portKinds,portSides:p.portSides,catalog:{libraryId:l.id,productId:p.id,model:p.model,manufacturer:l.manufacturer,attributes},manufacturerNumber:'KEEP-'+id,sapNumber:'SAP-'+id};}
  const G=4*1128/297,psu=product('phoenix-contact:uno-24dc-60w','psu','G1',Math.round(220/G)*G,Math.round(260/G)*G),io=product('beckhoff:el1008','io','A1',650,160);io.loadCalculation={assignment:'automatic',circuitId:'@auto',phase:'auto',input:'power',value:4.8,demandFactor:1,powerFactor:1,reactive:'lagging'};
  const fixture={title:'Detected PSU loads',projectInfo:{documentNumber:'PSU-001'},sheets:[{id:'drawing',title:'Outputs',parts:[psu,io,{id:'lamp',type:'lamp',deviceCode:'H1',x:650,y:420}],wires:[['psu:5','io:0'],['psu:6','io:1'],['psu:3','lamp:0'],['psu:4','lamp:1']].map(([a,b],i)=>({id:'w'+i,a,b,kind:'wire',points:[]}))}]};
  const errors=[],server=http.createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.resolve(ROOT,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    for(const tablet of [false,true]){
      const context=await browser.newContext(tablet?devices['iPad Pro 11 landscape']:{viewport:{width:1600,height:1100}}),page=await context.newPage(),act=selector=>page.locator(selector)[tablet?'tap':'click'](),field=name=>page.locator('#componentForm [name='+name+']');
      page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/');
      const download=async selector=>{const[d]=await Promise.all([page.waitForEvent('download',{timeout:90000}),act(selector)]),chunks=[];for await(const c of await d.createReadStream())chunks.push(c);return Buffer.concat(chunks);},save=async()=>JSON.parse(await download('#saveBtn'));
      const load=async data=>{await page.locator('#fileInput').setInputFiles({name:'psu.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Project loaded');await act('#selectTool');await act('#fitBtn');};
      const edit=async id=>{if(tablet){await act('#parts > g[data-id='+id+'] .part-body');await act('#propertiesBtn');}else await page.locator('#parts > g[data-id='+id+'] .part-body').click({button:'right'});await act('#componentTab-calculation');};
      const close=()=>act('#simpleClose'),open=()=>act('#calculationsBtn'),metrics=()=>page.locator('.electrical-metrics').textContent();
      await load(fixture);const base=await save();assert.equal(base.projectInfo.electricalCalculations,undefined);

      // Existing placements need no source setup and inspection creates no data.
      await edit('psu');assert.equal(await page.locator('#componentPanel-supply > fieldset').first().locator(':scope > legend').textContent(),'DC output loads');
      assert.match(await page.locator('.electrical-output-summary').textContent(),/2 detected load\(s\) · 1 calculated/);
      assert.match(await page.locator('[data-output-load=io]').textContent(),/A1.*4\.8 W/);assert.match(await page.locator('[data-output-load=lamp]').textContent(),/H1.*Not entered.*missing/);
      assert.match(await page.locator('#componentPanel-calculation').textContent(),/Input load \(upstream supply\)/);await act('#componentCancel');assert.deepEqual(await save(),base);
      await open();assert.equal(await page.locator('#electricalCircuit option').count(),1);assert.equal(await page.locator('#electricalCircuit').inputValue(),'@psu:psu');assert.match(await page.locator('#electricalCircuitResult').textContent(),/Partial load total/);assert.match(await metrics(),/4\.8 W/);await close();assert.deepEqual(await save(),base);

      // A blank lamp consumption is visible; entering it completes the total.
      await open();await page.locator('[name=addLoadDevice]').selectOption('lamp');await act('#electricalLoadEdit');assert.equal(await page.locator('#componentTab-calculation').getAttribute('aria-selected'),'true');await field('loadValue').fill('12');await act('#componentForm [type=submit]');
      let saved=await save();assert.equal(saved.projectInfo.electricalCalculations,undefined);await open();assert.match(await metrics(),/16\.8 W/);assert.match(await metrics(),/0\.7 A/);await close();await act('#undoBtn');await open();assert.match(await page.locator('#electricalCircuitResult').textContent(),/Partial load total/);await close();await act('#redoBtn');

      // The source tab exposes its detected output consumers and a direct view.
      await edit('psu');assert.match(await page.locator('.electrical-output-summary').textContent(),/2 detected load\(s\) · 2 calculated.*16\.8 W/);
      await page.screenshot({path:'/tmp/Leitwerk-psu-loads-'+(tablet?'tablet':'desktop')+'.png'});await act('#componentTab-supply');await act('.supply-loads');assert.equal(await page.locator('#electricalCircuit').inputValue(),'@psu:psu');assert.match(await metrics(),/16\.8 W/);
      await close();await act('#parts > g[data-id=psu] .part-body');await act('#deleteBtn');await open();await act('#electricalPlaceSupply');
      const autoPoint=await page.locator('#pageContent').evaluate((g,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(g.getScreenCTM());return{x:q.x,y:q.y};},{x:psu.x,y:psu.y});if(tablet)await page.touchscreen.tap(autoPoint.x,autoPoint.y);else await page.mouse.click(autoPoint.x,autoPoint.y);
      await open();assert.equal(await page.locator('#electricalCircuit').inputValue(),'@psu:psu');assert.match(await metrics(),/16\.8 W/);
      await act('#electricalEditSupply');assert.equal(await page.locator('[name=sourceOutput0]').inputValue(),'3');assert.equal(await page.locator('[name=sourceOutput1]').inputValue(),'4');await page.locator('[name=ratingA]').fill('2');await act('#electricalSupplyForm [type=submit]');assert.match(await page.locator('.electrical-margin').textContent(),/1\.16 A/);await close();
      saved=await save();assert.equal(saved.projectInfo.electricalCalculations.circuits.length,1);assert.equal(saved.projectInfo.electricalCalculations.circuits[0].id,'@psu:psu');assert.equal(saved.projectInfo.electricalCalculations.circuits[0].ratingA,2);await load(saved);await open();assert.equal(await page.locator('#electricalCircuit option').count(),1);await close();

      // Actual route deletion/reconnection updates assignment and history.
      await act('#wires [data-wire-label=w0]');await act('#deleteBtn');await open();assert.match(await page.locator('#electricalCircuitResult').textContent(),/Partial load total/);assert.equal(await page.locator('.electrical-margin').count(),0);assert.match(await metrics(),/12 W/);await close();
      await act('#wireTool');await act('[data-part=psu][data-term="5"]');await act('[data-part=io][data-term="0"]');await act('#selectTool');await open();assert.match(await metrics(),/16\.8 W/);await close();await act('#undoBtn');await open();assert.match(await page.locator('#electricalCircuitResult').textContent(),/Partial load total/);await close();await act('#redoBtn');

      // Automatic/custom source identities survive source unplacement/reuse.
      await act('#parts > g[data-id=psu] .part-body');await act('#deleteBtn');assert.equal((await save()).sheets.find(s=>s.id==='drawing').parts.find(p=>p.id==='psu').unplaced,true);await open();await act('#electricalPlaceSupply');
      const point=await page.locator('#pageContent').evaluate((g,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(g.getScreenCTM());return{x:q.x,y:q.y};},{x:psu.x,y:psu.y});if(tablet)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
      assert.equal((await save()).sheets.find(s=>s.id==='drawing').parts.find(p=>p.id==='psu').unplaced,undefined);await open();assert.match(await metrics(),/16\.8 W/);await act('#electricalReport');assert.match(await page.locator('#deviceListContent').textContent(),/Electrical calculations/);
      const reportState=await save(),pdf=await download('#exportBtn');await fs.writeFile('/tmp/Leitwerk-psu-loads-'+(tablet?'tablet':'desktop')+'.pdf',pdf);const{getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),task=getDocument({data:new Uint8Array(pdf),useSystemFonts:true}),doc=await task.promise;let text='',links=0;
      for(let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i);text+=(await p.getTextContent()).items.map(t=>t.str).join(' ');links+=(await p.getAnnotations()).filter(a=>a.dest).length;assert.ok(p.getViewport({scale:1}).width>p.getViewport({scale:1}).height);}assert.match(text,/16\.8 W/);assert.match(text,/Source setup/);assert.ok(links>0);await task.destroy();assert.deepEqual(await save(),reportState);

      // Remove is a durable opt-out, not a source that silently reappears.
      await open();await act('#electricalEditSupply');await act('#electricalRemove');assert.equal(await page.locator('#electricalCircuit').count(),0);await close();const disabled=await save();assert.deepEqual(disabled.projectInfo.electricalCalculations.disabledSourcePartIds,['psu']);await act('#undoBtn');await open();assert.match(await metrics(),/16\.8 W/);await close();await act('#redoBtn');await load(disabled);await open();assert.equal(await page.locator('#electricalCircuit').count(),0);await close();
      await edit('psu');assert.match(await page.locator('.supply-properties').textContent(),/enable output load detection/);await act('#componentTab-supply');await act('.supply-properties');await act('#electricalCancel');assert.equal(await page.locator('#electricalCircuit option').count(),1);assert.match(await metrics(),/16\.8 W/);await close();const enabled=await save();assert.deepEqual(enabled.projectInfo.electricalCalculations.disabledSourcePartIds,[]);assert.equal(enabled.projectInfo.electricalCalculations.circuits.length,1);
      const current=enabled.sheets.find(s=>s.id==='drawing').parts.find(p=>p.id==='psu');assert.equal(current.manufacturerNumber,'KEEP-psu');assert.equal(current.sapNumber,'SAP-psu');assert.equal(current.catalog.attributes.loadModel,undefined);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await context.close();
    }
    assert.deepEqual(errors,[]);console.log('PASS desktop/iPad automatic PSU source and Beckhoff/lamp loads without setup, output-tab summary, unknown consumption, stable/custom circuits, rating, actual rewiring/history, unplace/re-place, persisted opt-out/re-enable, unchanged inspection/material/JSON and linked vector PDF');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
