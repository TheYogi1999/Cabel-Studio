// Real UI input, persisted graph topology and rendered/PDF junction geometry.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const{chromium,devices}=require('playwright'),ROOT=path.resolve(__dirname,'..'),G=4*1128/297;
const drawings=p=>p.sheets.filter(s=>!s.kind),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const part=(id,x,y,type='resistor',extra={})=>({id,type,label:id.toUpperCase(),deviceCode:id.toUpperCase(),value:type,x:x*G,y:y*G,...extra});
const fixture={title:'Branched connections',sheets:[{id:'drawing',title:'Power distribution',parts:[part('p1',12,18),part('p2',44,18),part('p3',28,30),part('p4',38,36),part('p5',18,38),part('p6',10,41),part('p7',19,46),
  part('p80',52,25,'terminal-strip',{unplaced:true,deviceCode:'X1',label:'X1'}),...[81,82,83,84].map((id,i)=>part('p'+id,52+i*5,30+i*4,'connector',{masterId:'p80',terminalNumber:String(i+1),pinNumbers:[`${i+1}a`,`${i+1}b`],deviceCode:`X1.${i+1}`}))],wires:[{id:'w1',a:'p1:1',b:'p2:0',points:[],labelT:.25,colorCode:'RD'}]}]};
function checkGraph(s){
  const nodes=new Map((s.junctions||[]).map(n=>['@'+n.id+':0',n])),refs=new Map();for(const w of s.wires){for(const ref of[w.a,w.b]){if(ref.startsWith('@'))assert.ok(nodes.has(ref),'Every section has a real junction');if(!refs.has(ref))refs.set(ref,[]);refs.get(ref).push(w);}}
  for(const[key]of nodes)assert.ok(refs.get(key)?.length>=2,'No orphan junctions');
  return{nodes,refs,reachable(start){const seen=new Set(),queue=[start];while(queue.length){const key=queue.pop();if(seen.has(key))continue;seen.add(key);for(const w of refs.get(key)||[])queue.push(w.a===key?w.b:w.a);}return seen;}};
}
function pathPoints(d){const numbers=d.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi).map(Number);return Array.from({length:numbers.length/2},(_,i)=>({x:numbers[i*2],y:numbers[i*2+1]}));}
function hasDiagonal(points){return points.slice(1).some((b,i)=>{const a=points[i],dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y);return dx>1e-5&&dy>1e-5&&Math.abs(dx-dy)<1e-5;});}
(async()=>{
  const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(ROOT+path.sep))return res.writeHead(403).end();res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/json');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
    async function setup(page){
      page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);
      const download=async id=>{const[d]=await Promise.all([page.waitForEvent('download'),page.locator('#'+id).click()]);const chunks=[];for await(const c of await d.createReadStream())chunks.push(c);return Buffer.concat(chunks);};
      const load=async data=>{await page.locator('#fileInput').setInputFiles({name:'branches.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Project loaded');await page.locator('#selectTool').click();await page.locator('#fitBtn').click();};
      const screen=(x,y)=>page.locator('#pageContent').evaluate((g,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(g.getScreenCTM());return{x:q.x,y:q.y};},{x,y});
      const click=async(x,y)=>{const p=await screen(x*G,y*G);await page.mouse.click(p.x,p.y);};
      const terminal=(id,i)=>page.locator(`[data-part="${id}"][data-term="${i}"]`),wirePath=id=>page.locator(`path.wire[data-id="${id}"]`).getAttribute('d');
      await load(fixture);return{load,download,save:async()=>JSON.parse((await download('saveBtn')).toString()),screen,click,terminal,wirePath};
    }
    const page=await browser.newPage({viewport:{width:1660,height:1100}}),a=await setup(page),baseline=drawings(await a.save());
    // Starting on a line is a draft until a valid target is chosen.
    await page.keyboard.press('c');await a.click(28,18);assert.equal(await page.locator('.junction-dot').count(),0);await a.click(28,18);assert.deepEqual(drawings(await a.save()),baseline);assert.ok(await page.locator('#undoBtn').isDisabled(),'Cancelling a line draft creates no history step');await page.keyboard.press('Escape');
    await page.keyboard.press('c');await a.terminal('p3',0).click();await a.click(28,18);let project=await a.save(),s=drawings(project)[0];
    assert.equal(s.junctions.length,1);assert.equal(s.wires.length,3);const firstNode=s.junctions[0],firstKey='@'+firstNode.id+':0';let graph=checkGraph(s);assert.equal(graph.refs.get(firstKey).length,3);assert.equal(await page.locator('.junction-dot').count(),1);assert.equal(await page.locator('.wire-label').count(),2);
    assert.equal(s.wires.filter(w=>w.runId==='w1').length,2);assert.ok(s.wires.filter(w=>w.runId==='w1').every(w=>w.colorCode==='RD'));assert.ok(graph.reachable('p1:1').has('p3:0'));
    await page.locator('#undoBtn').click();assert.deepEqual(drawings(await a.save()),baseline);await page.locator('#redoBtn').click();assert.deepEqual(drawings(await a.save()),drawings(project));
    await page.keyboard.press('c');await a.click(28,18);await a.terminal('p4',0).click();await a.click(28,24);await a.terminal('p5',1).click();project=await a.save();s=drawings(project)[0];graph=checkGraph(s);
    assert.equal(s.junctions.length,2);assert.equal(s.wires.length,6);assert.equal(graph.refs.get(firstKey).length,4);for(const key of['p1:1','p2:0','p3:0','p4:0','p5:1'])assert.ok(graph.reachable('p1:1').has(key),key);
    console.log('PASS deferred splitting, multi-branch/nested topology, shared main-run properties, visible dots and one-step undo/redo');
    await page.keyboard.press('Escape');await a.click(28,18);await page.locator('#propertiesBtn').click();await page.locator('#junctionStyle').selectOption('root');await page.locator('#junctionApply').click();
    const branch=s.wires.find(w=>w.runId&&w.runId!=='w1'&&(w.a===firstKey||w.b===firstKey)),rootBefore=await a.wirePath('w1'),branchBefore=await a.wirePath(branch.id);assert.ok(hasDiagonal(pathPoints(branchBefore)));assert.equal(hasDiagonal(pathPoints(rootBefore)),false);assert.equal(await page.locator('.junction-dot').count(),1);
    await a.click(28,18);await page.locator('#propertiesBtn').click();const continuation=s.wires.find(w=>w.runId==='w1'&&w.id!=='w1');await page.locator('#junctionRoot').selectOption(continuation.id);await page.locator('#junctionApply').click();assert.notEqual(await a.wirePath(branch.id),branchBefore);assert.equal(await a.wirePath('w1'),rootBefore);
    // Move only one component: the node and unrelated sections stay put.
    const beforeMove=drawings(await a.save())[0],component=page.locator('#parts > g[data-id="p3"] .part-body'),box=await component.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();const end=await a.screen(30*G,32*G);await page.mouse.move(end.x,end.y,{steps:8});await page.mouse.up();s=drawings(await a.save())[0];assert.deepEqual(s.junctions,beforeMove.junctions);assert.notDeepEqual(s.parts.find(p=>p.id==='p3'),beforeMove.parts.find(p=>p.id==='p3'));checkGraph(s);
    await page.locator('#undoBtn').click();assert.deepEqual(drawings(await a.save())[0],beforeMove);
    await page.keyboard.press('Control+a');const groupStart=await a.screen(12*G,18*G),groupEnd=await a.screen(14*G,20*G);await page.mouse.move(groupStart.x,groupStart.y);await page.mouse.down();await page.mouse.move(groupEnd.x,groupEnd.y,{steps:6});await page.mouse.up();s=drawings(await a.save())[0];for(const n of beforeMove.junctions){const moved=s.junctions.find(q=>q.id===n.id);near(moved.x,n.x+2*G);near(moved.y,n.y+2*G);}for(const w of beforeMove.wires){const moved=s.wires.find(q=>q.id===w.id);assert.deepEqual(moved.points,w.points.map(p=>({x:p.x+2*G,y:p.y+2*G})));}await page.locator('#undoBtn').click();assert.deepEqual(drawings(await a.save())[0],beforeMove);
    // Moving a junction stretches its real incident ends; undo restores exactly.
    const n=beforeMove.junctions[0],start=await a.screen(n.x,n.y),nodeEnd=await a.screen(n.x+G,n.y+G);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(nodeEnd.x,nodeEnd.y,{steps:6});await page.mouse.up();s=drawings(await a.save())[0];near(s.junctions[0].x,n.x+G);checkGraph(s);await page.locator('#undoBtn').click();assert.deepEqual(drawings(await a.save())[0],beforeMove);
    console.log('PASS 45° root entries, choosing either main-line root direction, component/node movement and exact undo');
    await page.keyboard.press('c');await page.keyboard.down('Shift');await a.terminal('p6',1).click();await a.click(15,45);await a.terminal('p7',0).click();await page.keyboard.up('Shift');s=drawings(await a.save())[0];const angled=s.wires.at(-1);assert.equal(angled.routing,'octilinear');assert.ok(hasDiagonal(pathPoints(await a.wirePath(angled.id))));
    for(const w of s.wires){const points=pathPoints(await a.wirePath(w.id));for(let i=1;i<points.length;i++){const dx=Math.abs(points[i].x-points[i-1].x),dy=Math.abs(points[i].y-points[i-1].y);assert.ok(dx<1e-5||dy<1e-5||Math.abs(dx-dy)<1e-5,'Only axis-aligned or 45° segments');}}
    await a.terminal('p81',8).click();assert.equal(await page.locator('#wireTool').textContent(),'Bridge');await page.locator('#diagonalTool').click();await a.terminal('p82',8).click();let bridges=drawings(await a.save())[0].wires.filter(w=>w.kind==='bridge');assert.equal(bridges.length,1);assert.equal(bridges[0].routing,'octilinear');
    await page.locator('#diagonalTool').click();await a.click(54,32);await a.terminal('p83',8).click();s=drawings(await a.save())[0];bridges=s.wires.filter(w=>w.kind==='bridge');assert.equal(bridges.length,3);const bridgeNode=s.junctions.find(n=>checkGraph(s).refs.get('@'+n.id+':0').some(w=>w.kind==='bridge'));assert.ok(bridgeNode);assert.ok(checkGraph(s).reachable('p81:8').has('p83:8'));
    const beforeInvalid=drawings(await a.save());await a.click(bridgeNode.x/G,bridgeNode.y/G);await a.terminal('p1',0).click();assert.match(await page.locator('#toast').textContent(),/wire ports to wire ports/);await page.keyboard.press('Escape');assert.deepEqual(drawings(await a.save()),beforeInvalid);
    console.log('PASS Shift/toggle octilinear routing, automatic bridge detection, branched bridges and rejected mixed-port connections');
    project=await a.save();await page.reload();await a.load(project);assert.deepEqual(drawings(await a.save()),drawings(project));
    const beforeExport=await a.save();await fs.writeFile('/tmp/Cabel-Studio-branches.pdf',await a.download('exportBtn'));await fs.writeFile('/tmp/Cabel-Studio-branches.expected.json',JSON.stringify({pages:beforeExport.sheets.length}));assert.deepEqual(await a.save(),beforeExport);
    await page.screenshot({path:'/tmp/Cabel-Studio-v1.21.1-branches-desktop.png'});
    await page.locator('.sheetItem[data-sheet-kind="terminal-list"]').first().click();assert.ok(await page.locator('.terminal-bridge').count()>0);await page.locator('.sheetItem[data-sheet-kind="drawing"]').first().click();
    await page.keyboard.press('c');await a.click(28,26);await a.click(20,18);s=drawings(await a.save())[0];assert.equal(s.junctions.length,drawings(beforeExport)[0].junctions.length+2);assert.equal(s.wires.length,drawings(beforeExport)[0].wires.length+3);checkGraph(s);await page.locator('#undoBtn').click();assert.deepEqual(drawings(await a.save()),drawings(beforeExport));await page.keyboard.press('Escape');
    // Removing one terminal must keep the other branches connected.
    await a.terminal('p3',0).click();await page.keyboard.press('Delete');s=drawings(await a.save())[0];graph=checkGraph(s);for(const key of['p2:0','p4:0','p5:1'])assert.ok(graph.reachable('p1:1').has(key));await page.locator('#undoBtn').click();assert.deepEqual(drawings(await a.save()),drawings(beforeExport));
    console.log('PASS JSON roundtrip, PDF preservation, generated bridge diagrams and deletion without breaking surviving branches');
    // Stacked terminal references are above the first terminal and clickable.
    const stack={title:'Stack references',sheets:[{id:'stack',title:'Terminals',parts:[part('p90',15,10,'terminal-strip',{unplaced:true,deviceCode:'X2'}),...[91,92,93].map((id,i)=>part('p'+id,20,17+i,'connector',{masterId:'p90',deviceCode:'X2.'+(i+1),terminalNumber:String(i+1),pinNumbers:[(i+1)+'a',(i+1)+'b']})),part('p94',40,30,'terminal-pin',{masterId:'p93',pinIndex:0,value:'3a'})],wires:[]}]};
    await a.load(stack);assert.equal(await page.locator('[data-stack-reference-top="p91"]').count(),1);const refBox=await page.locator('[data-stack-reference-top="p91"]').boundingBox(),topBox=await page.locator('#parts > g[data-id="p91"] .part-geometry').boundingBox();assert.ok(refBox.y+refBox.height<topBox.y);await page.locator('[data-stack-reference-top="p91"]').click();assert.equal(await page.locator('#parts > g[data-id="p94"].selected').count(),1);
    console.log('PASS lower-terminal slave references above the first terminal with working navigation');
    const context=await browser.newContext(devices['iPad Pro 11 landscape']),tablet=await context.newPage(),t=await setup(tablet),client=await context.newCDPSession(tablet);
    const touch=async(x,y)=>{const p=await t.screen(x*G,y*G);await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
    await tablet.locator('#wireTool').tap();await touch(27,30);await touch(28,18);s=drawings(await t.save())[0];assert.equal(s.junctions.length,1);assert.equal(s.wires.length,3);
    await tablet.locator('#diagonalTool').tap();await touch(11,41);await touch(18,46);s=drawings(await t.save())[0];assert.equal(s.wires.at(-1).routing,'octilinear');assert.ok(hasDiagonal(pathPoints(await t.wirePath(s.wires.at(-1).id))));await tablet.screenshot({path:'/tmp/Cabel-Studio-v1.21.1-branches-ipad.png'});
    assert.deepEqual(errors,[]);console.log('PASS native tablet touch branching and 45° routing without a keyboard');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
