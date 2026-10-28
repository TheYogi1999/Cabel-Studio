const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const{chromium,devices}=require('playwright'),ROOT=path.resolve(__dirname,'..');
const fixture={title:'Tabbed device settings',projectInfo:{electricalCalculations:{version:1,circuits:[{id:'dc',name:'Controls',sourcePartId:'g24',system:'dc',voltage:24,reservePct:20,ratingA:10}]}},sheets:[{id:'drawing',title:'Settings',parts:[
  {id:'g24',type:'supply',deviceCode:'G1',supplySystem:'dc',pinNumbers:['+','−','PE'],portSides:['right','right','right'],x:180,y:180},
  {id:'load',type:'resistor',deviceCode:'R1',deviceType:'Test load',manufacturerNumber:'M1',sapNumber:'SAP1',x:600,y:180,loadCalculation:{assignment:'automatic',circuitId:'@auto',phase:'auto',input:'power',value:24,demandFactor:1,powerFactor:1,reactive:'lagging'}},
  {id:'optical',type:'fiber-device',deviceCode:'FO1',pinNumbers:['Tx','Rx'],portKinds:['fiber','fiber'],portSides:['left','right'],x:600,y:400},
  {id:'note',type:'text',label:'Drawing note',x:800,y:400}
],wires:[{id:'w1',a:'g24:0',b:'load:0',kind:'wire',points:[]},{id:'w2',a:'g24:1',b:'load:1',kind:'wire',points:[]}]}]};
(async()=>{
  const server=http.createServer(async(req,res)=>{
    try{const name=new URL(req.url,'http://localhost').pathname,file=path.resolve(ROOT,'.'+(name==='/'?'/index.html':name));
      if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();
      res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css');res.end(await fs.readFile(file));
    }catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
  try{
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    for(const tablet of [false,true]){
      const context=await browser.newContext(tablet?devices['iPad Pro 11 landscape']:{viewport:{width:1440,height:1000}}),page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/');
      const act=selector=>page.locator(selector)[tablet?'tap':'click'](),field=name=>page.locator('#componentForm [name='+name+']');
      const save=async()=>{const[d]=await Promise.all([page.waitForEvent('download'),act('#saveBtn')]),chunks=[];for await(const c of await d.createReadStream())chunks.push(c);return JSON.parse(Buffer.concat(chunks));};
      const edit=async id=>{if(tablet){await act('#parts > g[data-id='+id+'] .part-body');await act('#propertiesBtn');}else await page.locator('#parts > g[data-id='+id+'] .part-body').click({button:'right'});};
      const selected=async name=>assert.equal(await page.locator('#componentTab-'+name).getAttribute('aria-selected'),'true');
      await page.locator('#fileInput').setInputFiles({name:'tabs.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
      await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Project loaded');await act('#selectTool');await act('#fitBtn');const base=await save();

      // A tab change keeps the same live controls and cannot commit a draft.
      await edit('load');await selected('device');assert.equal(await field('deviceType').isVisible(),true);assert.equal(await field('loadValue').isVisible(),false);
      assert.equal(await page.locator('#componentForm [type=submit]').count(),1);
      await field('deviceCode').fill('R99');await act('#componentTab-calculation');await selected('calculation');
      assert.equal(await field('deviceType').isVisible(),false);await field('loadValue').fill('48');await field('loadDemand').fill('0.75');
      await act('#componentPanel-calculation summary');await field('calculationPathMode').selectOption('open');
      await act('#componentTab-device');assert.equal(await field('deviceCode').inputValue(),'R99');await act('#componentTab-calculation');assert.equal(await field('loadValue').inputValue(),'48');
      await act('#componentCancel');assert.deepEqual(await save(),base);

      // Apply from Device commits values from both tabs in one history step.
      await edit('load');await field('deviceCode').fill('R2');await field('manufacturerNumber').fill('M2');await field('sapNumber').fill('SAP2');
      const tabBounds=await page.getByRole('tablist',{name:'Component settings'}).boundingBox(),firstLabel=await field('functionCode').locator('..').boundingBox();
      assert.ok(firstLabel.y>=tabBounds.y+tabBounds.height,'Tabs must not obscure the first field label');
      await page.screenshot({path:'/tmp/Leitwerk-component-tabs-'+(tablet?'tablet':'desktop')+'-device.png'});
      await act('#componentTab-calculation');await field('loadValue').fill('48');await field('loadDemand').fill('0.75');
      await act('#componentPanel-calculation summary');await field('calculationPathMode').selectOption('open');
      await page.screenshot({path:'/tmp/Leitwerk-component-tabs-'+(tablet?'tablet':'desktop')+'-calculation.png'});
      await act('#componentTab-device');await act('#componentForm [type=submit]');assert.equal(await page.locator('#componentForm').isVisible(),false);
      const saved=await save(),p=saved.sheets.find(s=>s.id==='drawing').parts.find(p=>p.id==='load');
      assert.equal(p.deviceCode,'R2');assert.equal(p.manufacturerNumber,'M2');assert.equal(p.sapNumber,'SAP2');assert.equal(p.loadCalculation.value,48);assert.equal(p.loadCalculation.demandFactor,.75);assert.deepEqual(p.calculationLinks,[]);
      assert.deepEqual(saved.sheets.find(s=>s.id==='drawing').wires,base.sheets.find(s=>s.id==='drawing').wires);
      await act('#undoBtn');assert.deepEqual((await save()).sheets,base.sheets);await act('#redoBtn');assert.deepEqual((await save()).sheets,saved.sheets);

      // Native invalid events expose hidden calculation fields before focus.
      await edit('load');await act('#componentTab-calculation');await field('loadDemand').fill('2');await act('#componentTab-device');await act('#componentForm [type=submit]');
      await selected('calculation');assert.equal(await field('loadDemand').evaluate(n=>n===document.activeElement),true);await field('loadDemand').fill('.75');
      // A custom-path error also opens the collapsed details containing it.
      await act('#componentPanel-calculation summary');await field('calculationPathMode').selectOption('custom');await act('.electrical-add-path');
      await page.locator('.electrical-path-row select').nth(1).selectOption('0');await act('#componentPanel-calculation summary');await act('#componentTab-device');await act('#componentForm [type=submit]');
      await selected('calculation');assert.equal(await page.locator('#componentPanel-calculation details').evaluate(n=>n.open),true);
      assert.equal(await page.locator('#componentForm').isVisible(),true);await act('#componentCancel');assert.deepEqual(await save(),saved);

      // Non-native load/device rules must reveal the tab that needs correction.
      await edit('load');await act('#componentTab-calculation');await field('loadCircuit').selectOption('dc');await field('loadValue').fill('');await act('#componentTab-device');await act('#componentForm [type=submit]');
      await selected('calculation');assert.match(await page.locator('#toast').textContent(),/Enter the load input value/);await act('#componentCancel');assert.deepEqual(await save(),saved);
      await edit('g24');assert.equal(await page.locator('.supply-properties').isVisible(),false);await field('portSides').fill('X; X; X');await act('#componentTab-calculation');await act('#componentForm [type=submit]');
      await selected('device');assert.match(await page.locator('#toast').textContent(),/Enter one L or R/);await act('#componentCancel');assert.deepEqual(await save(),saved);

      // Calculation edit routes open directly on Calculation; keyboard tab
      // navigation changes only presentation, including on a narrow viewport.
      await act('#calculationsBtn');await page.locator('[name=addLoadDevice]').selectOption('load');await act('#electricalLoadEdit');await selected('calculation');
      await page.locator('#componentTab-calculation').focus();await page.keyboard.press('ArrowLeft');await selected('device');
      await page.keyboard.press('End');await selected('calculation');await page.keyboard.press('Home');await selected('device');await page.keyboard.press('ArrowRight');await selected('calculation');
      if(tablet){
        await page.setViewportSize({width:600,height:900});await act('#componentTab-device');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        assert.equal(await page.locator('#componentPanel-device').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),1);
        for(const name of ['device','calculation'])assert.ok((await page.locator('#componentTab-'+name).boundingBox()).height>=44);
        await page.setViewportSize(devices['iPad Pro 11 landscape'].viewport);
      }
      await page.keyboard.press('Escape');assert.equal(await page.locator('#simpleModal').isVisible(),false);assert.deepEqual(await save(),saved);

      // Non-electrical annotations and optical-only devices have no empty tab.
      for(const id of ['note','optical']){await edit(id);assert.equal(await page.getByRole('tablist',{name:'Component settings'}).count(),0);await act('#componentCancel');}
      assert.deepEqual(await save(),saved);await context.close();
    }
    assert.deepEqual(errors,[]);console.log('PASS desktop/iPad Device and Calculation tabs, retained drafts, atomic apply/cancel and history, hidden/native/custom validation, supply settings, direct calculation entry, keyboard navigation and narrow layout');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
