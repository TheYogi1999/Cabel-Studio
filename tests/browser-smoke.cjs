// Run: node tests/browser-smoke.cjs (requires Playwright and Chromium).
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const GRID = 4 * 1128 / 297;
const snap = n => Math.round(n / GRID) * GRID;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

(async () => {
  const html = await fs.readFile(path.join(__dirname, '..', 'index.html'));
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      headless: true, args: ['--no-sandbox'],
    });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    // Use the rendered A4 transform, including zoom and SVG letterboxing.
    const screen = (x, y) => page.locator('#pageContent').evaluate((g, p) => {
      const q = new DOMPoint(p.x, p.y).matrixTransform(g.getScreenCTM());
      return { x: q.x, y: q.y };
    }, { x, y });
    const clickWorld = async (x, y) => { const p = await screen(x, y); await page.mouse.click(p.x, p.y); };
    const download = async selector => {
      const [file] = await Promise.all([page.waitForEvent('download'), page.locator(selector).click()]);
      const stream = await file.createReadStream();
      const chunks = []; for await (const chunk of stream) chunks.push(chunk);
      return Buffer.concat(chunks).toString('utf8');
    };
    // Compare actual rendered terminal centers with the rendered wire endpoints.
    const assertAttached = async () => {
      const connections = await page.locator('#wires path.wire').evaluateAll(paths => paths.map(path => {
        const numbers = path.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
        const endpoints = [new DOMPoint(numbers[0], numbers[1]), new DOMPoint(numbers.at(-2), numbers.at(-1))]
          .map(p => p.matrixTransform(path.getScreenCTM()));
        return endpoints.map(p => Math.min(...Array.from(document.querySelectorAll('#parts .terminal'), terminal => {
          const center = new DOMPoint(terminal.cx.baseVal.value, terminal.cy.baseVal.value).matrixTransform(terminal.getScreenCTM());
          return Math.hypot(p.x - center.x, p.y - center.y);
        })));
      }));
      for (const distances of connections) for (const distance of distances) assert.ok(distance < .001, `Wire misses rendered terminal by ${distance}px`);
    };
    const assertOrthogonal = async () => {
      const paths = await page.locator('#wires path.wire').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number)));
      for(const pts of paths) for(let i=2;i<pts.length;i+=2) assert.ok(Math.abs(pts[i]-pts[i-2])<1e-6||Math.abs(pts[i+1]-pts[i-1])<1e-6,'Diagonal wire segment');
    };
    const save = async () => JSON.parse(await download('#saveBtn'));
    const drawing = project => project.sheets.find(s => s.kind !== 'device-list');
    const load = async project => {
      await page.locator('#fileInput').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
      await page.waitForFunction(() => document.querySelector('#toast').textContent === 'Projekt geladen');
    };
    const dragPart = async (id, x, y) => {
      const body = page.locator(`#parts > g[data-id="${id}"] .part-body`);
      const box = await body.boundingBox(), dest = await screen(x, y);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); await page.mouse.move(dest.x, dest.y, { steps: 8 }); await page.mouse.up();
    };

    assert.equal(await page.locator('.component-group').count(), 5);
    const folder = page.locator('.component-group').filter({ hasText: 'Passive Bauteile' });
    await folder.locator('summary').click();
    assert.equal(await folder.locator('.part').first().isVisible(), false);
    await folder.locator('summary').click();
    await page.locator('.part[data-type="resistor"]').click();
    assert.equal(await page.locator('#parts > g').count(), 1);
    await dragPart('p1', snap(220), snap(240));
    for (let i = 0; i < 2; i++) await page.locator('#zoomIn').click();
    const target = await screen(790, 270), box = await page.locator('#sheet').boundingBox();
    await page.locator('.part[data-type="lamp"]').dragTo(page.locator('#sheet'), { targetPosition: { x: target.x - box.x, y: target.y - box.y } });
    assert.equal(await page.locator('#parts > g').count(), 2);
    let project = await save(), sheet = drawing(project);
    near(sheet.parts[1].x, snap(790)); near(sheet.parts[1].y, snap(270));
    console.log('PASS folders, click placement, HTML drag/drop under zoom, component movement');

    const quickEdit = page.waitForEvent('dialog', { timeout: 3000 }).then(dialog => dialog.accept('R quick · 15 kΩ'));
    await page.locator('#parts > g[data-id="p1"] .part-body').dblclick();
    await quickEdit;
    assert.equal(await page.locator('#parts > g[data-id="p1"] .part-value').textContent(), '15 kΩ');
    await page.locator('#parts > g[data-id="p1"] .part-body').click({ button: 'right' });
    const form = page.locator('#componentForm');
    for (const [name, value] of Object.entries({ functionCode: 'F2', locationCode: 'L3', deviceCode: 'R9', label: 'R label <&>', value: '22 kΩ' })) {
      await form.locator(`[name="${name}"]`).fill(value);
    }
    // Keyboard shortcuts must not delete components or change mode during editing.
    await form.locator('[name="value"]').press('Delete');
    await form.locator('[name="value"]').fill('22 kΩ');
    await form.locator('[type="submit"]').click();
    assert.equal(await page.locator('#parts > g[data-id="p1"] .part-label').textContent(), 'R label <&>');
    assert.equal(await page.locator('#parts > g[data-id="p1"] .part-aks').textContent(), '=F2+L3−R9');
    await page.locator('#parts > g[data-id="p1"] .part-body').click({ button: 'right' });
    await form.locator('[name="label"]').fill('discard');
    await page.locator('#componentCancel').click();
    assert.equal(await page.locator('#parts > g[data-id="p1"] .part-label').textContent(), 'R label <&>');
    await page.locator('#parts > g[data-id="p1"] .part-body').click({ button: 'right' });
    await form.locator('[name="label"]').fill('discard with Escape');
    await form.locator('[name="label"]').press('Escape');
    assert.equal(await form.isVisible(), false);
    assert.equal(await page.locator('#parts > g[data-id="p1"] .part-label').textContent(), 'R label <&>');
    console.log('PASS double-click quick editing, right-click AKS/label/value editing, escaped text, cancel and Escape');

    await page.locator('#wireTool').click();
    await page.locator('[data-part="p1"][data-term="1"]').click();
    const waypoints = [[330, 190], [450, 340], [600, 180], [710, 340]];
    for (const [x, y] of waypoints) await clickWorld(x, y);
    const preview = await page.locator('#preview').getAttribute('d');
    assert.ok(preview.split('L').length >= 5);
    await page.locator('[data-part="p2"][data-term="0"]').click();
    assert.equal(await page.locator('#wires path.wire').count(), 1);
    project = await save(); sheet = drawing(project);
    for (const [x,y] of waypoints) assert.ok(sheet.wires[0].points.some(p=>Math.abs(p.x-snap(x))<1e-6&&Math.abs(p.y-snap(y))<1e-6));
    await assertOrthogonal();
    // Repeating an existing terminal pair must cancel without leaving a preview.
    await page.locator('[data-part="p1"][data-term="1"]').click();
    await clickWorld(400, 450);
    await page.locator('[data-part="p2"][data-term="0"]').click();
    assert.equal(await page.locator('#wires path.wire').count(), 1);
    assert.equal(await page.locator('#preview').isVisible(), false);
    await assertAttached();
    const original = structuredClone(sheet);
    const routeBefore = await page.locator('#wires path.wire').getAttribute('d');
    await page.locator('#selectTool').click();
    await dragPart('p1', original.parts[0].x + GRID * 3, original.parts[0].y + GRID * 2);
    await dragPart('p2', original.parts[1].x - GRID * 2, original.parts[1].y + GRID * 3);
    project = await save(); sheet = drawing(project);
    sheet.wires[0].points.forEach((p, i) => {
      near(p.x, original.wires[0].points[i].x + (i === sheet.wires[0].points.length-1 ? -2*GRID : 0));
      near(p.y, original.wires[0].points[i].y + (i === 0 ? 2*GRID : 0));
    });
    const routeMoved = await page.locator('#wires path.wire').getAttribute('d');
    assert.notEqual(routeBefore, routeMoved);
    const vertices = routeMoved.match(/-?\d+(?:\.\d+)?/g).map(Number);
    near(vertices[0], sheet.parts[0].x + GRID); near(vertices[1], sheet.parts[0].y);
    near(vertices.at(-2), sheet.parts[1].x - GRID); near(vertices.at(-1), sheet.parts[1].y);
    await assertAttached();
    await page.reload(); await load(project);
    assert.equal(await page.locator('#wires path.wire').getAttribute('d'), routeMoved);
    assert.deepEqual(drawing(await save()), sheet);
    await assertAttached();
    await page.locator('#zoomOut').click();
    await assertAttached();
    // Older route files may still contain anchor fields. They must not move half the route.
    const anchored = structuredClone(project);
    drawing(anchored).wires[0].points.forEach((p, i) => { p.anchor = i < 2 ? 'a' : 'b'; });
    await load(anchored);
    await dragPart('p1', sheet.parts[0].x + GRID, sheet.parts[0].y - GRID);
    let movedAgain = drawing(await save());
    movedAgain.wires[0].points.forEach((p, i) => {
      near(p.x, sheet.wires[0].points[i].x);
      near(p.y, sheet.wires[0].points[i].y - (i === 0 ? GRID : 0));
    });
    await dragPart('p2', sheet.parts[1].x + GRID, sheet.parts[1].y + GRID);
    movedAgain = drawing(await save());
    movedAgain.wires[0].points.forEach((p, i) => {
      near(p.x, sheet.wires[0].points[i].x + (i===sheet.wires[0].points.length-1?GRID:0));
      near(p.y, sheet.wires[0].points[i].y - (i === 0 ? GRID : 0));
    });
    await assertAttached();
    await load(project);
    const svg = await download('#exportBtn');
    assert.ok(svg.includes(routeMoved)); assert.ok(svg.includes('R label &lt;&amp;&gt;'));
    console.log('PASS 4 mm routes: terminal stretches resize, interior bends stay fixed, exact terminal alignment, JSON roundtrip and legacy anchors, SVG export');

    // Old files with no route field retain their automatic route and wire metadata.
    const legacy = { title: 'Legacy', parts: [
      { id: 'p20', type: 'resistor', x: snap(200), y: snap(240), label: 'R1', value: '10 kΩ' },
      { id: 'p50', type: 'lamp', x: snap(800), y: snap(400), label: 'H1', value: '24 V' },
    ], wires: [{ id: 'w90', a: 'p20:1', b: 'p50:0', diameter: '2.5', colorCode: 'RD', labelT: .3 }] };
    await load(legacy);
    assert.equal(await page.locator('#wires path.wire').count(), 1);
    assert.equal(await page.locator('.wire-label text').textContent(), '2.5RD');
    assert.equal(drawing(await save()).wires[0].points, undefined);
    await assertAttached();
    await page.locator('.part[data-type="connector"]').click();
    assert.equal(await page.locator('#parts > g[data-id="p91"]').count(), 1);
    await page.locator('#wireTool').click();
    await page.locator('[data-part="p20"][data-term="0"]').click();
    await clickWorld(330, 190); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#preview').isVisible(), false);
    assert.equal(await page.locator('#wires path.wire').count(), 1);
    await page.locator('#wireTool').click();
    await page.locator('[data-part="p20"][data-term="0"]').click();
    await page.locator('[data-part="p50"][data-term="1"]').click();
    await assertOrthogonal();
    console.log('PASS legacy project import, wire metadata, sparse IDs, route cancellation, direct connections');

    await page.locator('#selectTool').click();
    await page.locator('#parts > g[data-id="p50"] .part-body').click();
    await page.keyboard.press('Delete');
    assert.equal(await page.locator('#wires path.wire').count(), 0);
    await page.locator('#sheetPanel .sheetItem').last().click();
    assert.equal(await page.locator('#deviceListContent').isVisible(), true);
    assert.ok((await page.locator('#deviceListContent').textContent()).includes('R1'));
    const generatedTarget = await screen(500, 300), generatedBox = await page.locator('#sheet').boundingBox();
    await page.locator('.part[data-type="lamp"]').dragTo(page.locator('#sheet'), { targetPosition: { x: generatedTarget.x - generatedBox.x, y: generatedTarget.y - generatedBox.y } });
    assert.equal(await page.locator('#deviceListContent').isVisible(), true);
    assert.equal(drawing(await save()).parts.length, 2);
    // Version, transformations and shortcuts must survive the normal project roundtrip.
    assert.equal(await page.locator('#appVersion').textContent(), 'v1.2.0');
    await load(project);
    await page.locator('#selectTool').click();
    await page.locator('#parts > g[data-id="p1"] .part-body').click();
    await page.keyboard.press('r');
    let transformed = drawing(await save());
    assert.equal(transformed.parts[0].rotation, 90);
    await assertAttached();
    // Only the first bend follows the rotated start terminal.
    near(transformed.wires[0].points[0].x, sheet.wires[0].points[0].x);
    near(transformed.wires[0].points[0].y, sheet.wires[0].points[0].y + GRID);
    assert.deepEqual(transformed.wires[0].points.slice(1), sheet.wires[0].points.slice(1));
    await page.keyboard.press('x'); await page.keyboard.press('y');
    transformed = drawing(await save());
    assert.equal(transformed.parts[0].flipX, true);
    assert.equal(transformed.parts[0].flipY, true);
    await assertAttached();
    await page.keyboard.press('Control+r'); // Browser shortcut must not rotate the selected object.
    assert.equal(drawing(await save()).parts[0].rotation, 90);
    await page.keyboard.press('c');
    assert.ok((await page.locator('#wireTool').getAttribute('class')).includes('active'));
    await page.keyboard.press('Escape');
    const textDialog = page.waitForEvent('dialog').then(dialog => dialog.accept('Prüftext <&>'));
    await page.keyboard.press('t'); await textDialog;
    assert.equal(await page.locator('.annotation-text').textContent(), 'Prüftext <&>');
    const textId = await page.locator('.annotation-text').evaluate(t => t.closest('[data-id]').dataset.id);
    await dragPart(textId, snap(500), snap(500));
    await page.keyboard.press('r');
    let withText = await save();
    assert.equal(withText.appVersion, '1.2.0');
    assert.equal(drawing(withText).parts.find(p => p.type === 'text').rotation, 90);
    await page.reload(); await load(withText);
    assert.equal(await page.locator('.annotation-text').textContent(), 'Prüftext <&>');
    assert.ok((await download('#exportBtn')).includes('Prüftext &lt;&amp;&gt;'));
    await page.locator('#sheetPanel .sheetItem').last().click();
    assert.ok(!(await page.locator('#deviceListContent').textContent()).includes('Prüftext'));
    // J without a reference opens a jump chooser, including generated pages.
    await page.keyboard.press('j');
    await page.locator('#pageJumpTarget').selectOption('0');
    await page.locator('#pageJumpForm [type="submit"]').click();
    assert.equal(await page.locator('#deviceListContent').isVisible(), false);
    const addDialog = page.waitForEvent('dialog').then(dialog => dialog.accept('Zielseite'));
    await page.locator('#sheetAdd').click(); await addDialog;
    await page.locator('.part[data-type="destination"]').click();
    const targetObjectId = await page.locator('#parts > g').getAttribute('data-id');
    await page.locator('#sheetPanel .sheetItem').first().click();
    await page.locator('.part[data-type="reference"]').click();
    const referenceId = await page.locator('#parts > g.selected').getAttribute('data-id');
    assert.ok((await page.locator(`#parts > g[data-id="${referenceId}"] .symbol`).getAttribute('d')).includes('L 48 0'));
    await page.keyboard.press('c');
    await page.locator('[data-part="p1"][data-term="0"]').click();
    await clickWorld(400, 400);
    await page.locator(`[data-part="${referenceId}"][data-term="0"]`).click();
    assert.equal(await page.locator('#wires path.wire').count(), 2);
    await assertAttached();
    await page.keyboard.press('Escape');
    await page.locator(`#parts > g[data-id="${referenceId}"] .part-body`).click({ button: 'right' });
    const referenceForm = page.locator('#componentForm');
    const targetValue = await referenceForm.locator('[name="referenceTarget"] option').filter({ hasText: 'Zielseite' }).getAttribute('value');
    await referenceForm.locator('[name="referenceTarget"]').selectOption(targetValue);
    await referenceForm.locator('[name="value"]').fill('cyrjtx');
    await referenceForm.locator('[type="submit"]').click();
    const referenced = await save();
    assert.equal(drawing(referenced).parts[0].rotation, 90);
    assert.equal(drawing(referenced).parts.length, 4);
    const ref = drawing(referenced).parts.find(p => p.type === 'reference');
    assert.equal(ref.targetPartId, targetObjectId);
    await page.keyboard.press('j');
    assert.ok((await page.locator('#sheetPanel .sheetItem.active').textContent()).includes('Zielseite'));
    assert.equal(await page.locator('#parts > g.selected').getAttribute('data-id'), targetObjectId);
    const paired = await save();
    assert.equal(paired.sheets[1].parts[0].targetPartId, referenceId);
    await page.keyboard.press('j');
    assert.equal(await page.locator('#parts > g.selected').getAttribute('data-id'), referenceId);
    await page.keyboard.press('j');
    assert.equal(await page.locator('#parts > g.selected').getAttribute('data-id'), targetObjectId);
    await page.reload(); await load(referenced);
    await page.locator('#selectTool').click();
    await page.locator(`#parts > g[data-id="${referenceId}"] .part-body`).click();
    await page.keyboard.press('j');
    assert.equal(await page.locator('#parts > g.selected').getAttribute('data-id'), targetObjectId);
    // A deleted counterpart must show a useful message, not jump to a different object.
    await page.keyboard.press('Delete');
    await page.keyboard.press('j'); await page.locator('#pageJumpTarget').selectOption('0');
    await page.locator('#pageJumpForm [type="submit"]').click();
    await page.locator(`#parts > g[data-id="${referenceId}"] .part-body`).click();
    await page.keyboard.press('j');
    assert.equal(await page.locator('#toast').textContent(), 'Gegenziel nicht mehr vorhanden');
    console.log('PASS v1.2.0, C/X/Y/R/T/J shortcuts, transformed wire endpoints and adjacent bends, text and page references after save/reopen');
    // Engineering regression cases: fixed routing channels must resize at their ends.
    const engineering = {
      title: 'Engineering', sheets: [{ id: 'engineering-sheet', title: 'Steuerung', parts: [
        { id: 'p100', type: 'resistor', x: 10*GRID, y: 12*GRID, label: 'R100', value: '10 kΩ' },
        { id: 'p101', type: 'lamp', x: 30*GRID, y: 20*GRID, label: 'H101', value: '24 V' },
      ], wires: [{ id: 'w200', a: 'p100:1', b: 'p101:0', points: [{ x:20*GRID,y:12*GRID },{ x:20*GRID,y:20*GRID }] }] },
      { id:'second-sheet', title:'Reserve', parts:[], wires:[] }], activeSheet:0,
    };
    await load(engineering);
    await page.locator('#selectTool').click();
    await dragPart('p100',12*GRID,12*GRID);
    let resized = drawing(await save());
    near(resized.wires[0].points[0].x,20*GRID);
    near(resized.wires[0].points[0].y,12*GRID);
    // Original first stretch was 9 grid units; after moving along it, it is 7.
    near(resized.wires[0].points[0].x-(resized.parts[0].x+GRID),7*GRID);
    await dragPart('p100',12*GRID,14*GRID);
    await dragPart('p101',32*GRID,22*GRID);
    resized = drawing(await save());
    near(resized.wires[0].points[0].x,20*GRID);near(resized.wires[0].points[0].y,14*GRID);
    near(resized.wires[0].points[1].x,20*GRID);near(resized.wires[0].points[1].y,22*GRID);
    await assertAttached();await assertOrthogonal();
    const dragWorld = async (x1,y1,x2,y2) => {
      const a=await screen(x1,y1),b=await screen(x2,y2);
      await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:6});await page.mouse.up();
    };
    // Drag an interior vertical section sideways; both terminal endpoints stay fixed.
    await dragWorld(20*GRID,15*GRID,24*GRID,15*GRID);
    let adjusted = drawing(await save());
    near(adjusted.wires[0].points[0].x,24*GRID);near(adjusted.wires[0].points[1].x,24*GRID);
    assert.deepEqual(adjusted.parts,resized.parts);
    await assertAttached();await assertOrthogonal();
    // Drag the first horizontal section. A connecting lead must preserve the real terminal.
    await dragWorld(16*GRID,14*GRID,16*GRID,10*GRID);
    adjusted = drawing(await save());
    assert.ok(adjusted.wires[0].points.some(p=>Math.abs(p.y-10*GRID)<1e-6));
    assert.deepEqual(adjusted.parts,resized.parts);
    await assertAttached();await assertOrthogonal();
    const adjustedFile=await save(),adjustedPath=await page.locator('#wires path.wire').getAttribute('d');
    await page.reload();await load(adjustedFile);
    assert.equal(await page.locator('#wires path.wire').getAttribute('d'),adjustedPath);
    const cleanSvg=await download('#exportBtn');
    assert.ok(!cleanSvg.includes('wire-hit'));
    assert.ok(cleanSvg.includes('width="297mm"'));assert.ok(cleanSvg.includes('height="210mm"'));
    assert.ok(cleanSvg.includes('.symbol{fill:none;'));
    assert.ok(!/<g[^>]*id="pageContent"[^>]*transform=/.test(cleanSvg));
    assert.ok(cleanSvg.includes(adjustedPath));
    // A formerly straight wire can gain elbows when a component moves perpendicular to it.
    const straight=structuredClone(engineering);straight.sheets[0].parts[1].y=12*GRID;straight.sheets[0].wires[0].points=[];
    await load(straight);await dragPart('p100',10*GRID,16*GRID);
    await assertAttached();await assertOrthogonal();
    assert.ok(drawing(await save()).wires[0].points.length>=2);
    console.log('PASS wire stretches lengthen/shorten, draggable interior/end sections, orthogonal doglegs, roundtrip and clean SVG');

    // For every rotation and reflection, captions are readable only from bottom/right.
    for(const rotation of [0,90,180,270])for(const flipX of [false,true])for(const flipY of [false,true]){
      const fixture=structuredClone(engineering);
      Object.assign(fixture.sheets[0].parts[0],{rotation,flipX,flipY});
      await load(fixture);
      const readable=await page.locator('#parts > g[data-id="p100"] .part-caption text').evaluateAll(texts=>texts.map(t=>{
        const m=t.getCTM();return {det:m.a*m.d-m.b*m.c,a:m.a,b:m.b};
      }));
      assert.ok(readable.length>=3);
      for(const m of readable){assert.ok(m.det>0,'Mirrored caption');assert.ok(m.a>=-1e-6&&m.b<=1e-6,'Upside-down caption');}
      const terminals=await page.locator('#parts > g[data-id="p100"] .terminal').evaluateAll(nodes=>nodes.map(t=>{
        const root=document.querySelector('#pageContent').getScreenCTM().inverse();
        const p=new DOMPoint(t.cx.baseVal.value,t.cy.baseVal.value).matrixTransform(t.getScreenCTM()).matrixTransform(root);
        return {x:p.x,y:p.y};
      }));
      // 8 mm span, and every transformed terminal remains on the 4 mm grid.
      assert.ok(Math.abs(Math.hypot(terminals[1].x-terminals[0].x,terminals[1].y-terminals[0].y)-2*GRID)<.001);
      for(const t of terminals){assert.ok(Math.abs(t.x/GRID-Math.round(t.x/GRID))<.0001);assert.ok(Math.abs(t.y/GRID-Math.round(t.y/GRID))<.0001);}
      await assertAttached();await assertOrthogonal();
    }
    assert.match(await page.locator('#a4Number').textContent(),/^0001 \/ 0003$/);
    for(const label of await page.locator('#sheetPanel .sheetItem strong').allTextContents())assert.match(label,/^\d{4} · /);
    assert.match(await page.locator('#sheetCurrent').textContent(),/^0001\/0003$/);
    near(Number(await page.locator('#grid4mm circle').getAttribute('cx')),0);
    near(Number(await page.locator('#grid4mm circle').getAttribute('cy')),0);
    console.log('PASS all 16 rotation/reflection combinations: upright unmirrored captions, 8 mm symbols on grid, four-digit page numbering');

    await load(engineering);await page.locator('#selectTool').click();
    await page.locator('#parts > g[data-id="p100"] .part-body').click();
    await page.keyboard.press('Control+c');
    assert.equal(drawing(await save()).parts.length,2);
    await page.keyboard.press('Control+v');
    let clipboardFile=await save(),copied=drawing(clipboardFile).parts.at(-1);
    assert.equal(drawing(clipboardFile).parts.length,3);assert.notEqual(copied.id,'p100');
    assert.equal(copied.value,'10 kΩ');
    await page.keyboard.press('Control+x');
    assert.equal(drawing(await save()).parts.length,2);
    await page.keyboard.press('Control+v');
    assert.equal(drawing(await save()).parts.at(-1).id,copied.id);
    await page.keyboard.press('Meta+c');await page.keyboard.press('Meta+v');
    assert.equal(drawing(await save()).parts.length,4);
    // Cut a wired component: remove its dangling connections, preserve identity on paste.
    await page.locator('#parts > g[data-id="p100"] .part-body').click();
    await page.keyboard.press('Control+x');
    assert.equal(await page.locator('#wires path.wire').count(),0);
    await page.keyboard.press('Control+v');
    assert.equal(await page.locator('#parts > g[data-id="p100"]').count(),1);
    console.log('PASS Ctrl/Cmd+C/X/V copy, cut and paste; fresh copy IDs, cut identity and dangling-wire cleanup');

    assert.deepEqual(errors, []);
    console.log('PASS deletion cleans attached wires, generated device lists, no browser JavaScript errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
