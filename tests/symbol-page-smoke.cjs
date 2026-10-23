// Run: node tests/symbol-page-smoke.cjs (Playwright and Chromium required).
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const GRID = 4 * 1128 / 297;
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

(async () => {
  const server = http.createServer(async (req, res) => {
    try {
      const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(ROOT, '.' + (name === '/' ? '/index.html' : name));
      if (!file.startsWith(ROOT + path.sep)) return res.writeHead(403).end();
      res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'application/javascript' : 'application/json');
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && /\.(js|json)$/.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const screen = (x, y) => page.locator('#pageContent').evaluate((g, p) => {
      const q = new DOMPoint(p.x, p.y).matrixTransform(g.getScreenCTM()); return { x: q.x, y: q.y };
    }, { x, y });
    const download = async selector => {
      const [file] = await Promise.all([page.waitForEvent('download'), page.locator(selector).click()]);
      const chunks = []; for await (const chunk of await file.createReadStream()) chunks.push(chunk);
      return Buffer.concat(chunks);
    };
    const save = async () => JSON.parse((await download('#saveBtn')).toString());
    const drawings = project => project.sheets.filter(s => !s.kind);
    const parts = project => drawings(project).flatMap(s => s.parts);
    const load = async project => {
      await page.locator('#fileInput').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
      await page.waitForFunction(() => document.querySelector('#toast').textContent === 'Project loaded');
      await page.locator('#selectTool').click();
      await page.locator('[data-library-mode="generic"]').click();
      await page.locator('#catalogSearch').fill('');
    };
    const dragPart = async (id, x, y) => {
      const body = await page.locator(`#parts > g[data-id="${id}"] .part-body`).boundingBox(), target = await screen(x, y);
      await page.mouse.move(body.x + body.width / 2, body.y + body.height / 2); await page.mouse.down();
      await page.mouse.move(target.x, target.y, { steps: 8 }); await page.mouse.up();
    };
    const placeProduct = async (key, x, y) => {
      // Search by the manufacturer's model, including its original punctuation.
      const model = await page.evaluate(key => {
        const [library, id] = key.split(':'); return CABEL_CATALOGS.find(l => l.id === library).families.flatMap(f => f.products).find(p => p.id === id).model;
      }, key);
      await page.locator('[data-library-mode="products"]').click();
      await page.locator('#catalogSearch').fill(model);
      const target = await screen(x, y), sheet = await page.locator('#sheet').boundingBox();
      await page.locator(`[data-catalog-product="${key}"]`).dragTo(page.locator('#sheet'), { targetPosition: { x: target.x - sheet.x, y: target.y - sheet.y } });
      return parts(await save()).findLast(p => p.catalog?.libraryId + ':' + p.catalog?.productId === key && !p.catalogAssemblyPart);
    };
    const assertAttached = async () => {
      const distances = await page.locator('#wires path.wire').evaluateAll(paths => paths.flatMap(path => {
        const n = path.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
        return [[n[0], n[1]], n.slice(-2)].map(([x, y]) => {
          const q = new DOMPoint(x, y).matrixTransform(path.getScreenCTM());
          return Math.min(...Array.from(document.querySelectorAll('.terminal'), t => {
            const p = new DOMPoint(t.cx.baseVal.value, t.cy.baseVal.value).matrixTransform(t.getScreenCTM()); return Math.hypot(p.x - q.x, p.y - q.y);
          }));
        });
      }));
      for (const d of distances) assert.ok(d < .001, `Detached wire: ${d}px`);
    };

    const clickWorld=async(x,y)=>{const p=await screen(x,y);await page.mouse.click(p.x,p.y)};
    const assertOrthogonal=async()=>{for(const values of await page.locator('#wires .wire').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number))))for(let i=2;i<values.length;i+=2)assert.ok(Math.abs(values[i]-values[i-2])<1e-5||Math.abs(values[i+1]-values[i-1])<1e-5)};
    const editor=await browser.newPage({viewport:{width:1600,height:1100}});editor.setDefaultTimeout(10000);editor.on('pageerror',e=>errors.push(e.message));
    await editor.goto(`http://127.0.0.1:${server.address().port}/symbol-editor.html`);
    assert.equal(await editor.locator('#editorVersion').textContent(),'v1.19.1');
    const editorPoint=(x,y)=>editor.locator('#editorCanvas').evaluate((svg,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(svg.getScreenCTM());return{x:q.x,y:q.y}},{x,y});
    const draw=async(tool,a,b)=>{await editor.locator(`[data-tool="${tool}"]`).click();const p=await editorPoint(...a);await editor.mouse.move(p.x,p.y);await editor.mouse.down();if(b){const q=await editorPoint(...b);await editor.mouse.move(q.x,q.y,{steps:6})}await editor.mouse.up()};
    const editorDownload=async selector=>{const [file]=await Promise.all([editor.waitForEvent('download'),editor.locator(selector).click()]);const chunks=[];for await(const chunk of await file.createReadStream())chunks.push(chunk);return{name:file.suggestedFilename(),text:Buffer.concat(chunks).toString()}};
    await editor.locator('#symbolName').fill('Proposed <supply>');await editor.locator('#symbolId').fill('proposal-supply');await editor.locator('#symbolGroup').selectOption('Loads');await editor.locator('#tagPrefix').fill('G');await editor.locator('#defaultValue').fill('24 V');
    await draw('rect',[-2,-2],[2,2]);await draw('line',[-2,2],[2,-2]);await draw('line',[-4,0],[-2,0]);await draw('line',[2,0],[4,0]);await draw('text',[-1,-1]);
    await draw('terminal',[-4,0]);await draw('terminal',[4,0]);
    assert.equal(await editor.locator('#editorCanvas circle[data-object-id]').count(),2);
    await editor.keyboard.press('Control+z');assert.equal(await editor.locator('#editorCanvas circle[data-object-id]').count(),1);await editor.keyboard.press('Control+y');assert.equal(await editor.locator('#editorCanvas circle[data-object-id]').count(),2);
    await editor.locator('#objectList .object').filter({hasText:'Terminal: 1'}).click();await editor.locator('#inspector [name="x"]').fill('-8');await editor.locator('#inspector button').click();
    assert.equal(await editor.locator('#editorCanvas circle[data-object-id]').first().getAttribute('cx'),'-8');await editor.keyboard.press('Control+z');assert.equal(await editor.locator('#editorCanvas circle[data-object-id]').first().getAttribute('cx'),'-4');
    const json=await editorDownload('#saveProposal'),proposal=JSON.parse(json.text);assert.match(json.name,/\.cabel-symbol\.json$/);assert.equal(proposal.geometry.length,5);assert.equal(proposal.terminals.length,2);assert.equal(proposal.name,'Proposed <supply>');assert.equal(proposal.units,'mm');
    const preview=await editorDownload('#savePreview');assert.match(preview.name,/\.svg$/);assert.ok(await editor.evaluate(text=>!new DOMParser().parseFromString(text,'image/svg+xml').querySelector('parsererror'),preview.text));assert.ok(!preview.text.includes('<script'));
    await editor.locator('#clearSymbol').click();assert.equal(await editor.locator('#objectList .object').count(),0);
    await editor.locator('#proposalFile').setInputFiles({name:json.name,mimeType:'application/json',buffer:Buffer.from(json.text)});await editor.waitForFunction(()=>document.querySelector('#editorStatus').textContent==='Symbol proposal opened');assert.equal(await editor.locator('#objectList .object').count(),7);
    const bad=structuredClone(proposal);bad.geometry.push({id:'bad',type:'script',text:'alert(1)'});await editor.locator('#proposalFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await editor.waitForFunction(()=>document.querySelector('#editorStatus').textContent.includes('Invalid shape'));assert.equal(await editor.locator('#objectList .object').count(),7);
    await editor.locator('[data-tool="select"]').click();await editor.screenshot({path:'/tmp/Cabel-Studio-v1.19.1-symbol-editor.png'});await editor.close();
    console.log('PASS separate symbol editor: drawing, 4 mm terminals, exact properties, undo/redo, safe JSON/SVG export, reopening and invalid-input preservation');

    await load({title:'Custom proposals',parts:[],wires:[]});
    assert.equal(await page.locator('#symbolEditorLink').getAttribute('href'),'symbol-editor.html');
    const importProposal=async data=>{await page.locator('#symbolProposalInput').setInputFiles({name:'proposal.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Symbol proposal imported')};
    await importProposal(proposal);
    const dropCustom=async(x,y)=>{const p=await screen(x,y),box=await page.locator('#sheet').boundingBox();await page.locator('[data-custom-symbol="proposal-supply"]').dragTo(page.locator('#sheet'),{targetPosition:{x:p.x-box.x,y:p.y-box.y}})};
    await dropCustom(14*GRID,18*GRID);let custom=parts(await save()).find(p=>p.type==='custom-symbol');assert.ok(custom);assert.deepEqual(custom.symbolDefinition,proposal);assert.equal(custom.deviceCode,'G1');
    await page.locator('.part[data-type="resistor"]').click();const resistor=parts(await save()).find(p=>p.type==='resistor');await dragPart(resistor.id,35*GRID,18*GRID);
    await page.keyboard.press('c');await page.locator(`[data-part="${custom.id}"][data-term="1"]`).click();await clickWorld(24*GRID,14*GRID);await page.locator(`[data-part="${resistor.id}"][data-term="0"]`).click();await page.keyboard.press('Escape');
    await dragPart(custom.id,16*GRID,20*GRID);await page.keyboard.press('r');await page.keyboard.press('x');await assertAttached();await assertOrthogonal();
    const textMatrix=await page.locator(`#parts > g[data-id="${custom.id}"] .custom-symbol-text`).evaluate(n=>{const a=n.getScreenCTM(),b=document.querySelector('#pageContent').getScreenCTM().inverse(),c=b.multiply(a);return{a:c.a,b:c.b,c:c.c,d:c.d}});near(textMatrix.a,1,1e-5);near(textMatrix.b,0,1e-5);near(textMatrix.c,0,1e-5);near(textMatrix.d,1,1e-5);
    await page.locator(`#parts > g[data-id="${custom.id}"] .custom-symbol-text`).click();assert.equal(await page.locator('#parts > g.selected').getAttribute('data-id'),custom.id);
    await dropCustom(48*GRID,18*GRID);assert.deepEqual(parts(await save()).filter(p=>p.type==='custom-symbol').map(p=>p.deviceCode),['G1','G2']);
    const customFile=await save();await page.reload();await load(customFile);assert.equal(await page.locator('#parts .proposal-shape').count(),8);assert.equal(await page.locator('#parts .custom-symbol-text').count(),2);await assertAttached();
    const customPdf=await download('#exportBtn');await fs.writeFile('/tmp/Cabel-Studio-custom-symbols.pdf',customPdf);await fs.writeFile('/tmp/Cabel-Studio-custom-symbols.expected.json',JSON.stringify({pages:(await save()).sheets.length}));
    console.log('PASS symbol proposal drag/drop, geometry/terminal import, unique tags, upright custom text after reflection/rotation, attached wires, embedded JSON reopening without library and PDF');

    // Upgrade only on request; the first five legacy terminal indices stay attached.
    await load({title:'Power supply upgrade',parts:[{id:'p8000',type:'power-supply',label:'G1',deviceCode:'G1',x:18*GRID,y:22*GRID,pinNumbers:['L','N','PE','+24V','0V'],portSides:['left','left','left','right','right'],catalog:{libraryId:'phoenix-contact',productId:'quint4-24dc-5',manufacturer:'Phoenix Contact',model:'QUINT4-PS/1AC/24DC/5',attributes:{},verification:'not-verified'}},{id:'p8001',type:'lamp',label:'H1',deviceCode:'H1',x:42*GRID,y:22*GRID}],wires:[{id:'w8002',a:'p8000:3',b:'p8001:0',points:[{x:30*GRID,y:21*GRID},{x:30*GRID,y:22*GRID}]}]});
    assert.equal(await page.locator('[data-part="p8000"]').count(),5);await page.locator('#parts > g[data-id="p8000"] .part-body').click({button:'right'});await page.locator('#supplyPortsButton').click();await page.locator('#componentForm [type="submit"]').click();
    let upgraded=await save(),power=parts(upgraded).find(p=>p.id==='p8000');assert.equal(power.pinNumbers.length,12);assert.deepEqual(power.pinNumbers.slice(0,5),['L','N','PE','+24V','0V']);assert.ok(power.pinNumbers.includes('DC OK 13'));assert.ok(power.pinNumbers.includes('Signal IN'));await assertAttached();await assertOrthogonal();
    const glyphs=await page.locator('#parts > g[data-id="p8000"]').evaluate(root=>{const f=root.querySelector('.port-block-frame').getBBox();return Array.from(root.querySelectorAll('.supply-divider,.supply-ac,.supply-dc'),n=>{const b=n.getBBox();return b.x>=f.x-.001&&b.y>=f.y-.001&&b.x+b.width<=f.x+f.width+.001&&b.y+b.height<=f.y+f.height+.001})});assert.deepEqual(glyphs,[true,true,true]);
    await page.keyboard.press('Control+z');assert.equal(parts(await save()).find(p=>p.id==='p8000').pinNumbers.length,5);await assertAttached();await page.keyboard.press('Control+y');assert.equal(parts(await save()).find(p=>p.id==='p8000').pinNumbers.length,12);await assertAttached();
    for(const [i,[key,count]]of [['uno-24dc-60w',7],['trio-24dc-5',9],['quint4-24dc-10',12]].entries()){const p=await placeProduct('phoenix-contact:'+key,(40+12*i)*GRID,30*GRID);assert.equal(p.pinNumbers.length,count)}
    await page.screenshot({path:'/tmp/Cabel-Studio-v1.19.1-power-supplies.png'});
    console.log('PASS AC/DC divider/wave/DC glyphs fit frame, UNO/TRIO/QUINT output/signal variants, explicit legacy port upgrade preserving terminal indices, route adjustment and undo/redo');

    const fixture={title:'AKS contexts',sheets:[{id:'scope-main',title:'Original title',parts:[{id:'p9000',type:'resistor',deviceCode:'R1',label:'R1',functionCode:'F1',locationCode:'TU001',x:12*GRID,y:12*GRID},{id:'p9001',type:'lamp',deviceCode:'H1',label:'H1',functionCode:'F1',locationCode:'TU002',x:35*GRID,y:14*GRID},{id:'p9002',type:'coil',deviceCode:'K1',label:'K1',functionCode:'F2',locationCode:'TU001',x:46*GRID,y:14*GRID}],wires:[]},{id:'scope-other',title:'Other page',parts:[],wires:[]}],activeSheet:0};
    await load(fixture);await page.locator('#pagePropertiesBtn').click();await page.locator('#pagePropertiesForm [name="title"]').fill('Control cabinet');await page.locator('#pagePropertiesForm [name="functionCode"]').fill('=F1');await page.locator('#pagePropertiesForm [name="locationCode"]').fill('+TU001');await page.locator('#pagePropertiesForm [type="submit"]').click();
    const caption=id=>page.locator(`#parts > g[data-id="${id}"] .part-aks`);
    assert.equal(await caption('p9000').isVisible(),false);assert.equal(await caption('p9001').textContent(),'+TU002−H1');assert.equal(await caption('p9002').textContent(),'=F2−K1');
    let scopedFile=await save();assert.equal(drawings(scopedFile)[0].title,'Control cabinet');assert.deepEqual(drawings(scopedFile)[0].aks,{functionCode:'F1',locationCode:'TU001',hideMatching:true});assert.equal(parts(scopedFile).find(p=>p.id==='p9000').functionCode,'F1');
    await page.locator('#pagePropertiesBtn').click();await page.locator('#pagePropertiesForm [name="hideMatching"]').uncheck();await page.locator('#pagePropertiesForm [type="submit"]').click();assert.equal(await caption('p9000').isVisible(),true);await page.keyboard.press('Control+z');assert.equal(await caption('p9000').isVisible(),false);
    await page.locator('.part[data-type="resistor"]').click();const inherited=parts(await save()).findLast(p=>p.type==='resistor');assert.equal(inherited.functionCode,'F1');assert.equal(inherited.locationCode,'TU001');assert.equal(await caption(inherited.id).isVisible(),false);
    const drawArea=async(a,b)=>{await page.locator('#aksAreaTool').click();const p=await screen(a[0]*GRID,a[1]*GRID),q=await screen(b[0]*GRID,b[1]*GRID);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(q.x,q.y,{steps:6});await page.mouse.up();await page.locator('#aksAreaForm').waitFor()};
    await drawArea([8,10],[24,24]);await page.locator('#aksAreaForm [name="title"]').fill('PLC panel');await page.locator('#aksAreaForm [name="locationCode"]').fill('+TU001.01');await page.locator('#aksAreaForm [type="submit"]').click();
    assert.equal(await caption('p9000').textContent(),'+TU001−R1');assert.equal(await page.locator('.aks-area-border').count(),1);
    const borderPoint=await screen(8*GRID,20*GRID);await page.mouse.click(borderPoint.x,borderPoint.y,{button:'right'});assert.equal(await page.locator('#aksAreaForm [name="title"]').inputValue(),'PLC panel');await page.locator('#aksAreaCancel').click();
    const dropResistor=async(x,y)=>{const p=await screen(x*GRID,y*GRID),b=await page.locator('#sheet').boundingBox();await page.locator('.part[data-type="resistor"]').dragTo(page.locator('#sheet'),{targetPosition:{x:p.x-b.x,y:p.y-b.y}});return parts(await save()).findLast(p=>p.type==='resistor')};
    const areaPart=await dropResistor(16,16);assert.equal(areaPart.locationCode,'TU001.01');assert.equal(await caption(areaPart.id).isVisible(),false);await dragPart(areaPart.id,28*GRID,30*GRID);assert.equal(await caption(areaPart.id).textContent(),'+TU001.01−'+areaPart.deviceCode);await dragPart(areaPart.id,16*GRID,16*GRID);assert.equal(await caption(areaPart.id).isVisible(),false);
    await drawArea([14,14],[20,20]);await page.locator('#aksAreaForm [name="title"]').fill('Inner function');await page.locator('#aksAreaForm [name="functionCode"]').fill('F3');await page.locator('#aksAreaForm [name="locationCode"]').fill('');await page.locator('#aksAreaForm [type="submit"]').click();
    const innerPart=await dropResistor(18,18);assert.equal(innerPart.functionCode,'F3');assert.equal(innerPart.locationCode,'TU001.01');assert.equal(await caption(innerPart.id).isVisible(),false);assert.equal(await caption(areaPart.id).textContent(),'=F1−'+areaPart.deviceCode);
    scopedFile=await save();const inner=drawings(scopedFile)[0].aksAreas.find(a=>a.title==='Inner function');
    await page.locator('#pagePropertiesBtn').click();await page.locator(`[data-edit-aks-area="${inner.id}"]`).click();await page.locator('#aksAreaForm [name="functionCode"]').fill('F4');await page.locator('#aksAreaForm [name="assignExisting"]').check();await page.locator('#aksAreaForm [type="submit"]').click();
    assert.equal(parts(await save()).find(p=>p.id===areaPart.id).functionCode,'F4');assert.equal(await caption(areaPart.id).isVisible(),false);
    await page.keyboard.press('Control+z');assert.equal(parts(await save()).find(p=>p.id===areaPart.id).functionCode,'F1');assert.equal(drawings(await save())[0].aksAreas.find(a=>a.id===inner.id).functionCode,'F3');await page.keyboard.press('Control+y');assert.equal(parts(await save()).find(p=>p.id===areaPart.id).functionCode,'F4');
    await page.locator('#pagePropertiesBtn').click();await page.locator(`[data-delete-aks-area="${inner.id}"]`).click();await page.locator('#pagePropertiesCancel').click();assert.equal(await page.locator('.aks-area-border').count(),1);await page.keyboard.press('Control+z');assert.equal(await page.locator('.aks-area-border').count(),2);
    await page.locator('#aksAreaTool').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#aksAreaTool').getAttribute('aria-pressed'),'false');
    await page.locator('#aksAreaTool').click();await page.keyboard.press('Control+a');assert.equal(await page.locator('#aksAreaTool').getAttribute('aria-pressed'),'false');await page.keyboard.press('Escape');
    await page.locator('.sheetItem[data-sheet-kind="drawing"]').nth(1).click({button:'right'});await page.locator('#pagePropertiesForm [name="title"]').fill('Auxiliary page');await page.locator('#pagePropertiesForm [type="submit"]').click();assert.equal(drawings(await save())[1].title,'Auxiliary page');assert.equal((await save()).activeSheetId,'scope-main');
    const pageFile=await save();await page.reload();await load(pageFile);assert.deepEqual(drawings(await save()),drawings(pageFile));assert.equal(await page.locator('.aks-area-border').count(),2);assert.equal(await caption(areaPart.id).isVisible(),false);
    await page.screenshot({path:'/tmp/Cabel-Studio-v1.19.1-aks-areas.png'});
    const scopesPdf=await download('#exportBtn');await fs.writeFile('/tmp/Cabel-Studio-aks-scopes.pdf',scopesPdf);await fs.writeFile('/tmp/Cabel-Studio-aks-scopes.expected.json',JSON.stringify({pages:(await save()).sheets.length}));
    assert.equal(await page.locator('.aks-area-border').count(),2);assert.equal(await caption(areaPart.id).isVisible(),false);
    await page.locator('[data-overview="devices"]').click();assert.match(await page.locator(`.device-node[data-device-id="${areaPart.id}"] > summary .device-jump`).getAttribute('title'),/=F4\+TU001.01/);
    await load({title:'Terminal context boundary',parts:[{id:'p9100',type:'terminal-strip',deviceCode:'X1',label:'X1',functionCode:'F1',locationCode:'TU001',x:8*GRID,y:8*GRID,unplaced:true},...[9101,9102].map((id,i)=>({id:'p'+id,type:'connector',deviceCode:'X1',label:'X1',masterId:'p9100',terminalNumber:String(i+1),terminalType:'DG',functionCode:'F1',locationCode:'TU001',pinNumbers:[(i+1)+'a',(i+1)+'b'],x:20*GRID,y:(12+i)*GRID}))],wires:[],sheets:undefined});
    const boundaryFile=await save();drawings(boundaryFile)[0].aksAreas=[{id:'boundary',title:'Top terminal',functionCode:'F1',locationCode:'TU001',hideMatching:true,x:18*GRID,y:10*GRID,width:4*GRID,height:2*GRID}];await load(boundaryFile);
    assert.equal(await caption('p9101').isVisible(),false);assert.equal(await caption('p9102').isVisible(),true);
    console.log('PASS terminal-stack headers restart across an AKS-context boundary');
    console.log('PASS page title/AKS properties, selective aspect hiding, explicit identifiers, new-part inheritance, rectangular and overlapping AKS fields, moving in/out, explicit reassignment, right-click page edits, cancellation, undo/redo, full tree tags, JSON and PDF');

    await load({title:'Movable fields',sheets:[{id:'field-main',title:'Field drawing',aks:{functionCode:'F1',locationCode:'TU001',hideMatching:true},aksAreas:[
      {id:'small-field',title:'A long heading that must stay inside its small field',locationCode:'SMALL',x:20*GRID,y:20*GRID,width:2*GRID,height:GRID},
      {id:'micro-field',title:'A 2 mm field',locationCode:'SMALL',x:40*GRID,y:30*GRID,width:GRID/2,height:GRID/2},
      {id:'move-field',title:'Control field',functionCode:'F1',locationCode:'TU001.01',hideMatching:true,x:8*GRID,y:10*GRID,width:16*GRID,height:14*GRID}
    ],parts:[
      {id:'p9200',type:'resistor',deviceCode:'R1',label:'R1',functionCode:'F1',locationCode:'TU001.01',x:12*GRID,y:12*GRID},
      {id:'p9201',type:'lamp',deviceCode:'H1',label:'H1',functionCode:'F1',locationCode:'TU001',x:26*GRID,y:18*GRID}
    ],wires:[{id:'w9202',a:'p9200:1',b:'p9201:0',points:[{x:20*GRID,y:12*GRID},{x:20*GRID,y:18*GRID}]}]}],activeSheet:0});
    assert.equal(await page.locator('#aksAreaTool').textContent(),'Field');
    const originalFields=await save(),fieldIn=project=>drawings(project)[0].aksAreas.find(a=>a.id==='move-field');
    const fieldRect=page.locator('[data-aks-area="move-field"] .aks-area-border');
    const assertHeadingsInside=async()=>{
      for(const {text,box}of await page.locator('[data-aks-area]').evaluateAll(nodes=>nodes.map(g=>{const bounds=n=>{const {x,y,width,height}=n.getBBox();return{x,y,width,height}};return{text:bounds(g.querySelector('.aks-area-label')),box:bounds(g.querySelector('.aks-area-border'))}}))){
        assert.ok(text.x>=box.x&&text.y>=box.y&&text.x+text.width<=box.x+box.width+.01&&text.y+text.height<=box.y+box.height+.01,JSON.stringify({text,box}));
      }
    };
    const dragWorld=async(from,to,finish='release')=>{
      const a=await screen(from[0]*GRID,from[1]*GRID),b=await screen(to[0]*GRID,to[1]*GRID);
      await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});
      if(finish==='escape')await page.keyboard.press('Escape');
      if(finish==='cancel')await page.locator('#sheet').dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse',bubbles:true});
      await page.mouse.up();
    };
    await assertHeadingsInside();assert.match(await page.locator('[data-aks-area="small-field"] .aks-area-label').evaluate(n=>n.firstChild.textContent),/…$/);
    assert.equal(await caption('p9200').isVisible(),false);
    await dragWorld([8,20],[14,24]);
    const movedFields=await save();near(fieldIn(movedFields).x,14*GRID);near(fieldIn(movedFields).y,14*GRID);
    assert.deepEqual(drawings(movedFields)[0].parts,drawings(originalFields)[0].parts);assert.deepEqual(drawings(movedFields)[0].wires,drawings(originalFields)[0].wires);await assertAttached();
    assert.equal(await caption('p9200').textContent(),'+TU001.01−R1');
    await page.keyboard.press('Control+z');assert.deepEqual(fieldIn(await save()),fieldIn(originalFields));assert.equal(await caption('p9200').isVisible(),false);
    await page.keyboard.press('Control+y');assert.deepEqual(fieldIn(await save()),fieldIn(movedFields));
    await dragWorld([14,24],[20,30],'escape');assert.deepEqual(fieldIn(await save()),fieldIn(movedFields));
    await dragWorld([14,24],[20,30],'cancel');assert.deepEqual(fieldIn(await save()),fieldIn(movedFields));
    await page.keyboard.press('Control+z');assert.deepEqual(fieldIn(await save()),fieldIn(originalFields));await page.keyboard.press('Control+y');

    const heading=await page.locator('[data-aks-area="move-field"] .aks-area-label').boundingBox(),headingTarget=await screen(3*GRID,2*GRID),zero=await screen(0,0);
    await page.mouse.move(heading.x+heading.width/2,heading.y+heading.height/2);await page.mouse.down();await page.mouse.move(heading.x+heading.width/2+headingTarget.x-zero.x,heading.y+heading.height/2+headingTarget.y-zero.y,{steps:6});await page.mouse.up();
    near(fieldIn(await save()).x,17*GRID);near(fieldIn(await save()).y,16*GRID);await page.keyboard.press('Control+z');
    await page.keyboard.down('Alt');await dragWorld([14,24],[14.5,24.5]);await page.keyboard.up('Alt');near(fieldIn(await save()).x,14.5*GRID);near(fieldIn(await save()).y,14.5*GRID);await page.keyboard.press('Control+z');
    await dragWorld([14,24],[0,0]);near(+await fieldRect.getAttribute('x'),0);near(+await fieldRect.getAttribute('y'),0);
    await dragWorld([0,10],[1128/GRID,710/GRID]);near(+await fieldRect.getAttribute('x'),Math.floor((1128-16*GRID)/GRID)*GRID);near(+await fieldRect.getAttribute('y'),Math.floor((710-14*GRID)/GRID)*GRID);
    await page.keyboard.press('Control+z');await page.keyboard.press('Control+z');assert.deepEqual(fieldIn(await save()),fieldIn(movedFields));
    console.log('PASS field border/heading dragging, 4/2 mm grid, drawing bounds, stable devices/routes, live AKS captions, single-step undo/redo, Escape and pointer cancellation');

    const outsideKeeps=async form=>{await page.mouse.click(8,8);assert.equal(await page.locator(form).isVisible(),true)};
    const rightWorld=async(x,y)=>{const p=await screen(x*GRID,y*GRID);await page.mouse.click(p.x,p.y,{button:'right'})};
    await rightWorld(21,20.5);assert.equal(await page.locator('#aksAreaForm [name="title"]').inputValue(),'A long heading that must stay inside its small field');await page.locator('#aksAreaCancel').click();
    await rightWorld(22,25);assert.equal(await page.locator('#simpleContent h2').textContent(),'AKS field properties');await page.locator('#aksAreaForm [name="title"]').fill('Unsaved field title');await outsideKeeps('#aksAreaForm');assert.equal(await page.locator('#aksAreaForm [name="title"]').inputValue(),'Unsaved field title');await page.locator('#aksAreaCancel').click();assert.equal(fieldIn(await save()).title,'Control field');
    await rightWorld(14,24);assert.equal(await page.locator('#aksAreaForm [name="title"]').inputValue(),'Control field');await page.keyboard.press('Escape');
    await page.locator('[data-aks-area="move-field"] .aks-area-label').click({button:'right'});assert.equal(await page.locator('#aksAreaForm [name="title"]').inputValue(),'Control field');await page.locator('#simpleClose').click();
    await page.locator('[data-aks-area="move-field"] .aks-area-label').dblclick();assert.equal(await page.locator('#aksAreaForm').isVisible(),true);await page.locator('#aksAreaCancel').click();
    await page.locator('#parts > g[data-id="p9201"] .part-body').click({button:'right'});assert.equal(await page.locator('#componentForm').isVisible(),true);await page.locator('#componentForm [name="value"]').fill('Unsaved lamp value');await outsideKeeps('#componentForm');assert.equal(await page.locator('#componentForm [name="value"]').inputValue(),'Unsaved lamp value');await page.locator('#componentCancel').click();
    await rightWorld(50,8);assert.equal(await page.locator('#pagePropertiesForm').isVisible(),true);assert.equal(await page.locator('#simpleContent h3').textContent(),'AKS fields');await page.locator('#pagePropertiesForm [name="title"]').fill('Field property smoke');await outsideKeeps('#pagePropertiesForm');assert.equal(await page.locator('#pagePropertiesForm [name="title"]').inputValue(),'Field property smoke');await page.locator('#pagePropertiesForm [type="submit"]').click();assert.equal(drawings(await save())[0].title,'Field property smoke');
    await dragWorld([24,16],[28,20]);assert.equal(await page.locator('#parts > g[data-id="p9201"]').getAttribute('class').then(s=>s.includes('selected')),true);assert.deepEqual(fieldIn(await save()),fieldIn(movedFields));await page.keyboard.press('Escape');
    const fieldsFile=await save();await page.reload();await load(fieldsFile);assert.deepEqual(drawings(await save()),drawings(fieldsFile));await assertHeadingsInside();await assertAttached();
    await page.screenshot({path:'/tmp/Cabel-Studio-v1.19.1-fields.png'});await fs.writeFile('/tmp/Cabel-Studio-fields.pdf',await download('#exportBtn'));await fs.writeFile('/tmp/Cabel-Studio-fields.expected.json',JSON.stringify({pages:(await save()).sheets.length}));await assertHeadingsInside();
    console.log('PASS Fields terminology, headings inside small/large rectangles, field border/heading/interior context menus and double-click, component precedence, blank-sheet properties, modal draft persistence after backdrop clicks, interior multi-selection, JSON roundtrip and PDF');
    const resizeField=async(direction,dx,dy,finish='release')=>{
      const b=await page.locator(`[data-aks-area="move-field"] [data-field-resize="${direction}"]`).boundingBox(),zero=await screen(0,0),delta=await screen(dx*GRID,dy*GRID);
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+delta.x-zero.x,b.y+b.height/2+delta.y-zero.y,{steps:8});
      if(finish==='escape')await page.keyboard.press('Escape');
      if(finish==='cancel')await page.locator('#sheet').dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse',bubbles:true});
      await page.mouse.up();
    };
    const originalBox=fieldIn(fieldsFile);
    assert.equal(await page.locator('[data-aks-area="move-field"] [data-field-resize]').count(),8);
    for(const direction of ['se','e','s','w','n','nw','ne','sw']){
      const dx=direction.includes('w')?-2:direction.includes('e')?2:0,dy=direction.includes('n')?-2:direction.includes('s')?2:0;
      await resizeField(direction,dx,dy);const resized=await save(),box=fieldIn(resized);
      near(box.x,originalBox.x+(direction.includes('w')?dx*GRID:0));near(box.y,originalBox.y+(direction.includes('n')?dy*GRID:0));
      near(box.width,originalBox.width+Math.abs(dx)*GRID);near(box.height,originalBox.height+Math.abs(dy)*GRID);
      assert.deepEqual(drawings(resized)[0].parts,drawings(fieldsFile)[0].parts);assert.deepEqual(drawings(resized)[0].wires,drawings(fieldsFile)[0].wires);
      await page.keyboard.press('Control+z');assert.deepEqual(fieldIn(await save()),originalBox);
      if(direction==='se'){await page.keyboard.press('Control+y');assert.deepEqual(fieldIn(await save()),box);await page.keyboard.press('Control+z')}
    }
    await resizeField('nw',-4,-4);assert.equal(await caption('p9200').isVisible(),false);await assertAttached();await page.keyboard.press('Control+z');assert.equal(await caption('p9200').textContent(),'+TU001.01−R1');
    await resizeField('se',4,4,'escape');assert.deepEqual(fieldIn(await save()),originalBox);await resizeField('se',4,4,'cancel');assert.deepEqual(fieldIn(await save()),originalBox);
    await page.keyboard.down('Alt');await resizeField('se',.5,.5);await page.keyboard.up('Alt');near(fieldIn(await save()).width,originalBox.width+GRID/2);near(fieldIn(await save()).height,originalBox.height+GRID/2);await page.keyboard.press('Control+z');
    await resizeField('w',100,0);near(fieldIn(await save()).width,GRID);near(fieldIn(await save()).x+fieldIn(await save()).width,originalBox.x+originalBox.width);await page.keyboard.press('Control+z');
    await resizeField('n',0,100);near(fieldIn(await save()).height,GRID);await assertHeadingsInside();await page.keyboard.press('Control+z');
    await resizeField('nw',-100,-100);near(fieldIn(await save()).x,0);near(fieldIn(await save()).y,0);await page.keyboard.press('Control+z');
    await resizeField('se',100,100);let resizedBox=fieldIn(await save());assert.ok(resizedBox.x+resizedBox.width<=1128&&resizedBox.y+resizedBox.height<=710);near((resizedBox.x+resizedBox.width)/GRID,Math.floor(1128/GRID));near((resizedBox.y+resizedBox.height)/GRID,Math.floor(710/GRID));await page.keyboard.press('Control+z');
    await page.locator('#wireTool').click();assert.equal(await page.locator('[data-field-resize]').count(),0);await page.locator('#selectTool').click();
    await resizeField('se',2,3);const resizedFile=await save();await page.reload();await load(resizedFile);assert.deepEqual(drawings(await save()),drawings(resizedFile));await assertHeadingsInside();await assertAttached();
    await page.screenshot({path:'/tmp/Cabel-Studio-v1.19.1-resize-fields.png'});await fs.writeFile('/tmp/Cabel-Studio-fields.pdf',await download('#exportBtn'));await fs.writeFile('/tmp/Cabel-Studio-fields.expected.json',JSON.stringify({pages:(await save()).sheets.length}));
    assert.deepEqual(errors,[]);
    console.log('PASS all eight field resize handles, anchored opposite edges, 4/2 mm steps, minimum dimensions/bounds, stable components/routes, live AKS hiding, single-step undo/redo, cancellation, connection-mode isolation, JSON and PDF');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
