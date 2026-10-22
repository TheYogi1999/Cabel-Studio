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
    page.setDefaultTimeout(10000);
    page.on('pageerror', e => { errors.push(e.message); console.error('Browser error:',e.message); });
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
      const bytes=Buffer.concat(chunks);if(selector==='#exportBtn')await fs.writeFile('/tmp/Cabel-Studio-smoke.pdf',bytes);
      return bytes.toString('utf8');
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
    const drawing = project => project.sheets.find(s => !s.kind);
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
    const pdf = await download('#exportBtn');
    assert.match(pdf,/^%PDF-1.4/);assert.ok(pdf.includes('/Count '+project.sheets.length));
    assert.equal(await page.locator('#wires path.wire').getAttribute('d'),routeMoved);
    console.log('PASS 4 mm routes: terminal stretches resize, interior bends stay fixed, exact terminal alignment, JSON roundtrip and legacy anchors, PDF export');

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
    await page.locator('#sheetPanel .sheetItem[data-sheet-kind="device-list"]').last().click();
    assert.equal(await page.locator('#deviceListContent').isVisible(), true);
    assert.ok((await page.locator('#deviceListContent').textContent()).includes('R1'));
    const generatedTarget = await screen(500, 300), generatedBox = await page.locator('#sheet').boundingBox();
    await page.locator('.part[data-type="lamp"]').dragTo(page.locator('#sheet'), { targetPosition: { x: generatedTarget.x - generatedBox.x, y: generatedTarget.y - generatedBox.y } });
    assert.equal(await page.locator('#deviceListContent').isVisible(), true);
    assert.equal(drawing(await save()).parts.filter(p=>!p.unplaced).length, 2);
    // Version, transformations and shortcuts must survive the normal project roundtrip.
    assert.equal(await page.locator('#appVersion').textContent(), 'v1.9.1');
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
    assert.equal(withText.appVersion, '1.9.1');
    assert.equal(drawing(withText).parts.find(p => p.type === 'text').rotation, 90);
    await page.reload(); await load(withText);
    assert.equal(await page.locator('.annotation-text').textContent(), 'Prüftext <&>');
    assert.match(await download('#exportBtn'),/^%PDF-1.4/);assert.equal(await page.locator('.annotation-text').textContent(),'Prüftext <&>');
    await page.locator('#sheetPanel .sheetItem[data-sheet-kind="device-list"]').last().click();
    assert.ok(!(await page.locator('#deviceListContent').textContent()).includes('Prüftext'));
    // J without a reference opens a jump chooser, including generated pages.
    await page.keyboard.press('j');
    await page.locator('#pageJumpTarget').selectOption('2');
    await page.locator('#pageJumpForm [type="submit"]').click();
    assert.equal(await page.locator('#deviceListContent').isVisible(), false);
    const addDialog = page.waitForEvent('dialog').then(dialog => dialog.accept('Zielseite'));
    await page.locator('#sheetAdd').click(); await addDialog;
    await page.locator('.part[data-type="destination"]').click();
    const targetObjectId = await page.locator('#parts > g').getAttribute('data-id');
    await page.locator('#sheetPanel .sheetItem[data-sheet-kind="drawing"]').first().click();
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
    assert.equal(paired.sheets.find(s=>s.title==='Zielseite').parts[0].targetPartId, referenceId);
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
    await page.keyboard.press('j'); await page.locator('#pageJumpTarget').selectOption('2');
    await page.locator('#pageJumpForm [type="submit"]').click();
    await page.locator(`#parts > g[data-id="${referenceId}"] .part-body`).click();
    await page.keyboard.press('j');
    assert.equal(await page.locator('#toast').textContent(), 'Gegenziel nicht mehr vorhanden');
    console.log('PASS v1.9.1, C/X/Y/R/T/J shortcuts, transformed wire endpoints and adjacent bends, text and page references after save/reopen');
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
    assert.match(cleanSvg,/^%PDF-1.4/);assert.ok(cleanSvg.includes('/MediaBox [0 0 841.8898 595.2756]'));
    assert.equal(await page.locator('#wires path.wire').getAttribute('d'),adjustedPath);
    // A formerly straight wire can gain elbows when a component moves perpendicular to it.
    const straight=structuredClone(engineering);straight.sheets[0].parts[1].y=12*GRID;straight.sheets[0].wires[0].points=[];
    await load(straight);await dragPart('p100',10*GRID,16*GRID);
    await assertAttached();await assertOrthogonal();
    assert.ok(drawing(await save()).wires[0].points.length>=2);
    console.log('PASS wire stretches lengthen/shorten, draggable interior/end sections, orthogonal doglegs, roundtrip and PDF output');

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
    assert.match(await page.locator('#a4Number').textContent(),/^0003 \/ 0006$/);
    for(const label of await page.locator('#sheetPanel .sheetItem strong').allTextContents())assert.match(label,/^\d{4} · /);
    assert.match(await page.locator('#sheetCurrent').textContent(),/^0003\/0006$/);
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

    const devicesProject={title:'Geräte',sheets:[{id:'dev-sheet',title:'Geräteblatt',parts:[
      {id:'p300',type:'switch',x:10*GRID,y:12*GRID,label:'Master K1',deviceCode:'K1',locationCode:'TU001.01',functionCode:'A1',value:'Schütz'},
      {id:'p301',type:'connector',x:14*GRID,y:12*GRID,label:'Slave 1',deviceCode:'X1.01',locationCode:'TU001.01',functionCode:'A1',masterId:'p300',value:'Klemme'},
      {id:'p302',type:'connector',x:18*GRID,y:12*GRID,label:'Unterposition 2',deviceCode:'X1.02',locationCode:'TU001.01',functionCode:'A1',masterId:'p301',value:'Klemme'},
    ],wires:[{id:'w400',a:'p300:1',b:'p301:0',points:[]}]},{id:'dev-other',title:'Andere Geräte',parts:[
      {id:'p303',type:'coil',x:16*GRID,y:18*GRID,label:'Spule K2',deviceCode:'K2',locationCode:'TU002.05',functionCode:'A1',value:'24 V'},
    ],wires:[]}],activeSheet:0};
    await load(devicesProject);await page.locator('#selectTool').click();
    const body=page.locator('#parts > g[data-id="p300"] .part-body');
    const bodyStyle=await body.evaluate(n=>({fill:getComputedStyle(n).fill,stroke:getComputedStyle(n).stroke}));
    assert.equal(bodyStyle.stroke,'none');assert.ok(bodyStyle.fill==='transparent'||bodyStyle.fill==='rgba(0, 0, 0, 0)');
    await body.click({button:'right'});
    const deviceForm=page.locator('#componentForm');
    assert.equal(await deviceForm.locator('[name="masterId"] option[value="p301"]').count(),0);
    assert.equal(await deviceForm.locator('[name="masterId"] option[value="p302"]').count(),0);
    await deviceForm.locator('[name="manufacturerNumber"]').fill('M-00123');
    await deviceForm.locator('[name="sapNumber"]').fill('00001234');
    await deviceForm.locator('[name="pinNumbers"]').fill(':13, :14');
    await deviceForm.locator('[type="submit"]').click();
    assert.deepEqual(await page.locator('#parts > g[data-id="p300"] .pin-label').allTextContents(),[':13',':14']);
    assert.equal(await page.locator('.wire-label rect').count(),1);assert.equal(await page.locator('.wire-label rect').getAttribute('fill'),'#fff');
    assert.equal(await page.locator('.wire-label text').getAttribute('font-size'),'7');
    // Ctrl-click finds the device in nested AKS folders, including its descendants.
    await body.click({modifiers:['Control']});
    assert.equal(await page.locator('[data-overview="devices"]').getAttribute('aria-selected'),'true');
    const treeMaster=page.locator('.device-node[data-device-id="p300"]');
    assert.equal(await treeMaster.locator(':scope > summary small').count(),0);
    assert.ok((await treeMaster.locator(':scope > summary .device-jump').getAttribute('title')).includes('Master K1'));
    assert.equal(await treeMaster.locator('.device-node[data-device-id="p301"]').count(),1);
    assert.equal(await treeMaster.locator('.device-node[data-device-id="p302"]').count(),1);
    const folderNames=await page.locator('.aks-folder > summary').allTextContents();
    assert.ok(folderNames.includes('+TU001'));assert.ok(folderNames.includes('01'));
    await page.locator('.device-node[data-device-id="p303"] .device-jump').click();
    assert.equal(await page.locator('#parts > g.selected').getAttribute('data-id'),'p303');
    assert.ok((await page.locator('#hud').textContent()).includes('0004/'));
    await page.locator('[data-overview="sheets"]').click();
    await page.locator('#sheetPanel .sheetItem[data-sheet-kind="device-list"]').last().click();
    assert.ok((await page.locator('#deviceListContent').textContent()).includes('M-00123'));
    assert.ok((await page.locator('#deviceListContent').textContent()).includes('00001234'));
    assert.ok((await page.locator('#deviceListContent').textContent()).includes('Slave von'));
    await page.locator('.device-list-link[data-part-id="p300"]').click();
    assert.equal(await page.locator('#parts > g.selected').getAttribute('data-id'),'p300');
    // Moving a master carries same-sheet descendants and preserves wire attachment.
    const groupBefore=drawing(await save()).parts.map(p=>({...p}));
    const groupWireBefore=(await page.locator('#wires path.wire').getAttribute('d')).match(/-?\d+(?:\.\d+)?/g).map(Number);
    await dragPart('p300',groupBefore[0].x+2*GRID,groupBefore[0].y+GRID);
    const groupAfter=drawing(await save()).parts;
    groupAfter.forEach((p,i)=>{near(p.x,groupBefore[i].x+2*GRID);near(p.y,groupBefore[i].y+GRID)});
    await assertAttached();await assertOrthogonal();
    const groupWireAfter=(await page.locator('#wires path.wire').getAttribute('d')).match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.equal(groupWireAfter.length,groupWireBefore.length);groupWireAfter.forEach((n,i)=>near(n,groupWireBefore[i]+(i%2?GRID:2*GRID)));
    await page.locator('#autoLists').click();
    assert.ok((await page.locator('#simpleContent').textContent()).includes('M-00123'));
    assert.ok((await page.locator('#simpleContent').textContent()).includes('00001234'));
    const csv=await download('#csvDownload');
    assert.ok(csv.includes('Herstellernummer'));assert.ok(csv.includes('00001234'));
    await page.locator('[data-device-go="p301"]').click();
    assert.equal(await page.locator('#parts > g.selected').getAttribute('data-id'),'p301');
    const deviceFile=await save();await page.reload();await load(deviceFile);
    const reopened=drawing(await save()).parts;
    assert.equal(reopened[0].manufacturerNumber,'M-00123');assert.equal(reopened[0].sapNumber,'00001234');
    assert.deepEqual(reopened[0].pinNumbers,['13','14']);assert.equal(reopened[1].masterId,'p300');
    console.log('PASS invisible component hit areas, small white-backed wire labels, order numbers/pins, nested AKS folders, Ctrl-click, list/tree jumps, master/slave movement and JSON roundtrip');

    await page.locator('#createTerminalStrip').click();
    const strip=page.locator('#stripForm');
    await strip.locator('[name="code"]').fill('X9');await strip.locator('[name="count"]').fill('3');
    await strip.locator('[name="manufacturerNumber"]').fill('KL-3');await strip.locator('[name="sapNumber"]').fill('000099');
    await strip.locator('[type="submit"]').click();
    const stripProject=await save(),built=drawing(stripProject).parts.filter(p=>p.manufacturerNumber==='KL-3');
    assert.equal(built.length,4);assert.equal(built[0].assemblyName,'X9');
    assert.ok(built.slice(1).every(p=>p.masterId===built[0].id));
    assert.ok(built.every(p=>p.sapNumber==='000099')&&built.slice(1).every(p=>p.type==='connector'));
    assert.equal(await page.locator(`.device-node[data-device-id="${built[0].id}"] .device-node`).count(),3);
    await page.locator('[data-device-id="p301"] > summary .device-jump').click();
    await page.locator('#parts > g.selected .part-body').click({button:'right'});
    await page.locator('#componentForm [name="masterId"]').selectOption('p303');
    await page.locator('#componentForm [type="submit"]').click();
    assert.equal(drawing(await save()).parts.find(p=>p.id==='p301').masterId,'p303');
    console.log('PASS terminal-strip creation, master/slave subpositions, editable master assignment and cycle-safe choices');

    const autoLabels=structuredClone(engineering);autoLabels.sheets[0].wires[0].labelT=.15;autoLabels.sheets[0].wires[0].labelOrientation='vertical';
    await load(autoLabels);await page.locator('[data-overview="sheets"]').click();await page.locator('#selectTool').click();
    const labelPose=async()=> (await page.locator('.wire-label').getAttribute('transform')).match(/-?\d+(?:\.\d+)?/g).map(Number);
    let pose=await labelPose();near(pose[2],0);near(pose[0]/GRID,Math.round(pose[0]/GRID));near(pose[1]/GRID,Math.round(pose[1]/GRID));
    const dragLabel=async(x,y)=>{const box=await page.locator('.wire-label text').boundingBox(),target=await screen(x,y);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:5});await page.mouse.up()};
    await dragLabel(20*GRID,17*GRID);pose=await labelPose();near(pose[0],20*GRID);near(pose[1],17*GRID);near(pose[2],-90);
    await dragLabel(15*GRID,12*GRID);pose=await labelPose();near(pose[0],15*GRID);near(pose[1],12*GRID);near(pose[2],0);
    const labelFile=await save();await page.reload();await load(labelFile);pose=await labelPose();near(pose[2],0);near(pose[0],15*GRID);
    const matrix=()=>page.locator('#pageContent').evaluate(g=>{const m=g.getScreenCTM();return {a:m.a,d:m.d,e:m.e,f:m.f}});
    const beforePan=await matrix(),partsBeforePan=drawing(await save());
    const panStart=await screen(800,500);await page.mouse.move(panStart.x,panStart.y);await page.mouse.down({button:'middle'});await page.mouse.move(panStart.x+80,panStart.y+50,{steps:5});await page.mouse.up({button:'middle'});
    const afterPan=await matrix();assert.ok(Math.abs(afterPan.e-beforePan.e-80)<.001);assert.ok(Math.abs(afterPan.f-beforePan.f-50)<.001);near(afterPan.a,beforePan.a);near(afterPan.d,beforePan.d);assert.deepEqual(drawing(await save()),partsBeforePan);
    console.log('PASS automatic horizontal/vertical wire labels on 4 mm grid, saved label location, middle-button pan without moving parts');

    const terminalsFixture=structuredClone(devicesProject);terminalsFixture.sheets[0].parts[1].pinNumbers=['11','12'];terminalsFixture.sheets[0].parts[2].pinNumbers=['21','22'];
    await load(terminalsFixture);await page.locator('#projectInfoBtn').click();
    const infoForm=page.locator('#projectInfoForm');
    for(const [key,value] of Object.entries({title:'PDF Prüfstand',company:'Test GmbH',documentNumber:'EL-0042',revision:'B',author:'Test',date:'21.10.2026',description:'Automatische Dokumentation'}))await infoForm.locator(`[name="${key}"]`).fill(value);
    await infoForm.locator('[type="submit"]').click();
    const documentFile=await save();assert.deepEqual(documentFile.sheets.map(s=>s.kind||'drawing'),['cover','toc','drawing','drawing','device-list','terminal-list']);
    assert.equal(documentFile.projectInfo.documentNumber,'EL-0042');
    await page.locator('[data-overview="sheets"]').click();await page.locator('.sheetItem[data-sheet-kind="cover"]').click();
    assert.ok((await page.locator('#deviceListContent').textContent()).includes('PDF Prüfstand'));
    assert.ok((await page.locator('#deviceListContent').textContent()).includes('Test GmbH'));
    assert.ok((await page.locator('#a4Document').textContent()).includes('EL-0042 / B'));
    await page.locator('.sheetItem[data-sheet-kind="toc"]').click();
    assert.ok((await page.locator('#deviceListContent').textContent()).includes('Klemmenliste'));
    await page.locator('[aria-label="Zu Seite 0003"]').click();
    assert.equal(await page.locator('#scene').isVisible(),true);
    await page.locator('[data-part="p301"][data-term="1"]').click({modifiers:['Control']});
    const pinSlave=page.locator('.pin-node[data-pin-part="p301"][data-pin-index="1"]');
    assert.ok((await pinSlave.textContent()).includes(':12'));
    await pinSlave.click();assert.equal(drawing(await save()).parts.find(p=>p.type==='terminal-pin').pinIndex,1);
    await page.locator('[data-overview="sheets"]').click();await page.locator('.sheetItem[data-sheet-kind="terminal-list"]').click();
    assert.equal(await page.locator('.terminal-list-link').count(),4);
    assert.ok((await page.locator('#deviceListContent').textContent()).includes(':11'));
    await page.locator('.terminal-list-link').first().click();
    assert.equal(await page.locator('#parts > g.selected').getAttribute('data-id'),'p301');
    await page.locator('#selectTool').click();await page.locator('#parts > g[data-id="p302"] .part-body').click();await page.keyboard.press('Delete');
    await page.locator('.sheetItem[data-sheet-kind="terminal-list"]').click();assert.equal(await page.locator('.terminal-list-link').count(),4);
    await page.locator('#createTerminalStrip').click();await page.locator('#stripForm [name="count"]').fill('12');await page.locator('#stripForm [type="submit"]').click();
    await page.locator('[data-overview="sheets"]').click();assert.equal(await page.locator('.sheetItem[data-sheet-kind="terminal-list"]').count(),3);
    const beforePdf=await save(),beforePdfId=beforePdf.activeSheetId;
    const fullPdf=await download('#exportBtn');assert.match(fullPdf,/^%PDF-1.4/);assert.ok(fullPdf.includes('/Count '+beforePdf.sheets.length));assert.ok(fullPdf.includes('%%EOF'));
    const afterPdf=await save();assert.equal(afterPdf.activeSheetId,beforePdfId);assert.deepEqual(afterPdf.projectInfo,beforePdf.projectInfo);assert.deepEqual(afterPdf.sheets,beforePdf.sheets);
    await page.locator('.sheetItem[data-sheet-kind="terminal-list"]').first().click();const onList=await save();await page.reload();await load(onList);
    assert.ok((await page.locator('#hud').textContent()).includes('Klemmenliste'));assert.equal((await save()).activeSheetId,onList.activeSheetId);
    assert.equal((await save()).projectInfo.author,'Test');
    console.log('PASS cover/contents/drawing/device/terminal page order, metadata and drawing head, pin slaves and jumps, automatic terminal pagination, PDF download/state restoration, generated-page roundtrip');

    await load({title:'Klemmen und Brücken',parts:[],wires:[]});
    await page.locator('#createTerminalStrip').click();
    await page.locator('#stripForm [name="code"]').fill('X1');await page.locator('#stripForm [name="count"]').fill('2');await page.locator('#stripForm [name="pins"]').fill('4');await page.locator('#stripForm [type="submit"]').click();
    let stripFile=await save(),stripParts=drawing(stripFile).parts,stripMaster=stripParts.find(p=>p.type==='terminal-strip'),clamps=stripParts.filter(p=>p.type==='connector');
    assert.equal(stripParts.length,3);assert.equal(stripMaster.deviceCode,'X1');assert.deepEqual(clamps.map(p=>p.terminalNumber),['1','2']);
    assert.deepEqual(clamps[0].pinNumbers,['1a','1b','1c','1d']);assert.deepEqual(clamps[1].pinNumbers,['2a','2b','2c','2d']);
    assert.ok(clamps.every(p=>p.masterId===stripMaster.id));
    const firstId=clamps[0].id,secondId=clamps[1].id;
    assert.equal(await page.locator(`.device-node[data-device-id="${stripMaster.id}"] .device-node`).count(),2);
    assert.equal(await page.locator(`.device-node[data-device-id="${firstId}"] .pin-node`).count(),5);
    assert.equal(await page.locator(`#parts > g[data-id="${firstId}"] .terminal:not(.bridge-terminal)`).count(),4);
    await page.locator('[data-overview="sheets"]').click();await page.locator('.sheetItem[data-sheet-kind="terminal-list"]').click();
    const terminalText=await page.locator('#deviceListContent').textContent();
    for(const text of ['KLEMME','PIN','X1',':1a',':1b',':2a',':2b'])assert.ok(terminalText.includes(text));
    assert.equal(await page.locator('.terminal-list-link').count(),8);
    await page.locator('.sheetItem[data-sheet-kind="drawing"]').first().click();
    await page.locator('#bridgeTool').click();
    await page.locator(`[data-part="${firstId}"][data-term="1"]`).click();
    await clickWorld(9*GRID,13*GRID);await clickWorld(10*GRID,13*GRID);
    await page.locator(`[data-part="${secondId}"][data-term="0"]`).click();
    let bridge=(drawing(await save()).wires).find(w=>w.kind==='bridge');assert.ok(bridge);assert.equal(bridge.colorCode,'BN');
    const bridgePath=page.locator(`#wires path.wire[data-id="${bridge.id}"]`);
    assert.equal(await bridgePath.evaluate(p=>p.style.stroke),'rgb(121, 85, 72)');assert.equal(await bridgePath.evaluate(p=>p.style.strokeWidth),'2');
    assert.equal(await page.locator(`.wire-label[data-wire-label="${bridge.id}"] text`).textContent(),'Brücke');
    await page.keyboard.press('Escape');await page.locator(`.wire-label[data-wire-label="${bridge.id}"] text`).dblclick();assert.equal(await page.locator('#wireKind').inputValue(),'bridge');await page.locator('#simpleClose').click();
    await page.locator('#wireTool').click(); // From bridge mode this returns to selection; C explicitly starts a conductor.
    await page.keyboard.press('c');await page.locator(`[data-part="${firstId}"][data-term="3"]`).click();
    await clickWorld(8*GRID,20*GRID);await clickWorld(11*GRID,20*GRID);await page.locator(`[data-part="${secondId}"][data-term="3"]`).click();
    let conductor=drawing(await save()).wires.find(w=>w.kind!=='bridge');assert.ok(conductor);
    const conductorPath=page.locator(`#wires path.wire[data-id="${conductor.id}"]`);assert.equal(await conductorPath.evaluate(p=>p.style.strokeWidth),'1');
    for(const rect of await page.locator('.wire-label-background').all())assert.equal(await rect.getAttribute('fill'),'#fff');
    await assertAttached();await assertOrthogonal();await page.keyboard.press('Escape');
    // The type can be changed in the existing wire-data dialog.
    await page.locator(`.wire-label[data-wire-label="${conductor.id}"] text`).click();await page.locator('#wireDataButton').click();
    await page.locator('#wireKind').selectOption('bridge');assert.equal(await page.locator('#wireLabelPreview').textContent(),'Brücke');await page.locator('#wireApply').click();
    assert.equal(drawing(await save()).wires.find(w=>w.id===conductor.id).kind,'bridge');
    await page.locator('#wireDataButton').click();await page.locator('#wireKind').selectOption('wire');await page.locator('#wireApply').click();
    // Do not silently remove an extra pin that already has a conductor attached.
    await page.locator(`#parts > g[data-id="${firstId}"] .part-body`).click({button:'right'});
    await page.locator('#componentForm [name="pinNumbers"]').fill('1a, 1b');await page.locator('#componentForm [type="submit"]').click();
    assert.equal(await page.locator('#toast').textContent(),'Zu entfernende Pins sind noch verdrahtet');assert.equal(await page.locator(`#parts > g[data-id="${firstId}"] .terminal:not(.bridge-terminal)`).count(),4);
    await page.locator('#componentForm [name="pinNumbers"]').fill('1a, 1b, 1c, 1d, 1e, 1f');await page.locator('#componentForm [type="submit"]').click();
    assert.equal(await page.locator(`#parts > g[data-id="${firstId}"] .terminal:not(.bridge-terminal)`).count(),6);await assertAttached();
    await page.locator('[data-overview="sheets"]').click();await page.locator('.sheetItem[data-sheet-kind="terminal-list"]').click();
    assert.equal(await page.locator('.terminal-list-link').count(),10);assert.ok((await page.locator('#deviceListContent').textContent()).includes('Brücke →'));
    await page.locator('.sheetItem[data-sheet-kind="drawing"]').first().click();
    // Bridges cannot connect ordinary device terminals or cross terminal strips.
    await page.locator('.part[data-type="lamp"]').click();const lampId=drawing(await save()).parts.find(p=>p.type==='lamp').id;
    await page.locator('#bridgeTool').click();await page.locator(`[data-part="${firstId}"][data-term="0"]`).click();await page.locator(`[data-part="${lampId}"][data-term="0"]`).click();
    assert.equal(await page.locator('#toast').textContent(),'Brücken verbinden nur Klemmenpins');assert.equal(drawing(await save()).wires.length,2);await page.keyboard.press('Escape');
    await page.locator('#createTerminalStrip').click();await page.locator('#stripForm [name="code"]').fill('X2');await page.locator('#stripForm [name="count"]').fill('2');await page.locator('#stripForm [type="submit"]').click();
    const secondMaster=drawing(await save()).parts.find(p=>p.type==='terminal-strip'&&p.deviceCode==='X2');await dragPart(secondMaster.id,30*GRID,10*GRID);
    const otherClamp=drawing(await save()).parts.find(p=>p.type==='connector'&&p.stripName==='X2');
    await page.locator('#bridgeTool').click();await page.locator(`[data-part="${firstId}"][data-term="0"]`).click();await page.locator(`[data-part="${otherClamp.id}"][data-term="0"]`).click();
    assert.equal(await page.locator('#toast').textContent(),'Brücken müssen innerhalb derselben Klemmenleiste liegen');assert.equal(drawing(await save()).wires.length,2);await page.keyboard.press('Escape');
    const bridgeFile=await save();await page.reload();await load(bridgeFile);
    assert.equal(drawing(await save()).parts.find(p=>p.id===firstId).pinNumbers.length,6);assert.equal(drawing(await save()).wires.find(w=>w.id===bridge.id).kind,'bridge');
    assert.equal(await bridgePath.evaluate(p=>p.style.stroke),'rgb(121, 85, 72)');assert.equal(await conductorPath.evaluate(p=>p.style.strokeWidth),'1');
    await assertAttached();await assertOrthogonal();
    const legacyStrip={title:'Alte Klemmenleiste',parts:[
      {id:'p10',type:'connector',assemblyName:'X5',deviceCode:'X5.01',label:'X5.01',x:8*GRID,y:16*GRID,pinNumbers:['1','2']},
      {id:'p11',type:'connector',masterId:'p10',deviceCode:'X5.02',label:'X5.02',x:11*GRID,y:16*GRID,pinNumbers:['1','2']},
    ],wires:[{id:'w20',a:'p10:1',b:'p11:0',points:[]}]};
    await load(legacyStrip);const upgraded=await save(),upgradedParts=drawing(upgraded).parts;
    const upgradeMaster=upgradedParts.find(p=>p.type==='terminal-strip');assert.ok(upgradeMaster);
    assert.equal(upgradedParts.find(p=>p.id==='p10').masterId,upgradeMaster.id);assert.deepEqual(upgradedParts.find(p=>p.id==='p11').pinNumbers,['2a','2b']);
    assert.equal(drawing(upgraded).wires[0].a,'p10:1');assert.equal(drawing(upgraded).wires[0].b,'p11:0');await assertAttached();
    await page.reload();await load(upgraded);assert.equal(drawing(await save()).parts.length,3);
    await load(bridgeFile);
    const bridgePdf=await download('#exportBtn');assert.match(bridgePdf,/^%PDF-1.4/);assert.ok(bridgePdf.includes('/Count '+bridgeFile.sheets.length));
    await fs.writeFile('/tmp/Cabel-Studio-smoke.expected.json',JSON.stringify({pages:bridgeFile.sheets.length}));
    console.log('PASS X1 master → terminals 1/2 → pins 1a/1b/2a/2b, 2–8 pins, white label backgrounds, thin conductors, brown thicker bridges, bridge restrictions/conversion, pin removal protection, generated list and PDF roundtrip');

    await load(engineering);await page.locator('[data-overview="sheets"]').click();await page.locator('#selectTool').click();
    const gridRect=page.locator('#pageContent > rect[fill="url(#grid4mm)"]');
    assert.equal(await page.locator('#gridToggle').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#grid4mm circle').getAttribute('fill'),'#78909c');
    assert.equal(await page.locator('#grid4mm path').count(),1);
    await page.locator('#gridToggle').click();assert.equal(await gridRect.isVisible(),false);
    await dragPart('p100',10.4*GRID,12.4*GRID);
    let gridParts=drawing(await save()).parts;near(gridParts[0].x,10*GRID);near(gridParts[0].y,12*GRID);
    await page.locator('#gridToggle').click();assert.equal(await gridRect.isVisible(),true);
    await page.keyboard.down('Alt');near(Number(await page.locator('#grid4mm').getAttribute('width')),GRID/2);
    assert.ok((await page.locator('#hud').textContent()).includes('2 mm Raster'));
    await dragPart('p100',10.5*GRID,12.5*GRID);
    await page.keyboard.up('Alt');near(Number(await page.locator('#grid4mm').getAttribute('width')),GRID);
    gridParts=drawing(await save()).parts;near(gridParts[0].x,10.5*GRID);near(gridParts[0].y,12.5*GRID);
    await page.keyboard.press('c');await page.locator('[data-part="p100"][data-term="0"]').click();await page.keyboard.down('Alt');
    await clickWorld(18.5*GRID,16.5*GRID);await page.locator('[data-part="p101"][data-term="1"]').click();await page.keyboard.up('Alt');
    assert.ok(drawing(await save()).wires.at(-1).points.some(p=>Math.abs(p.x-18.5*GRID)<1e-6&&Math.abs(p.y-16.5*GRID)<1e-6));await assertAttached();await assertOrthogonal();
    await page.keyboard.press('Escape');await page.keyboard.down('Alt');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));near(Number(await page.locator('#grid4mm').getAttribute('width')),GRID);await page.keyboard.up('Alt');
    const activePage=()=>page.locator('#sheetPanel .sheetItem.active').getAttribute('data-right-sheet');
    assert.equal(await activePage(),'2');await page.keyboard.press('PageUp');assert.equal(await activePage(),'1');await page.keyboard.press('PageUp');assert.equal(await activePage(),'0');await page.keyboard.press('PageUp');assert.equal(await activePage(),'0');
    const pageCount=(await save()).sheets.length;
    for(let i=0;i<pageCount+2;i++)await page.keyboard.press('PageDown');assert.equal(await activePage(),String(pageCount-1));
    await page.keyboard.press('PageUp');assert.equal(await activePage(),String(pageCount-2));
    await page.locator('.sheetItem[data-sheet-kind="drawing"]').first().click();await page.locator('#parts > g[data-id="p100"] .part-body').click({button:'right'});
    await page.locator('#componentForm [name="value"]').focus();await page.keyboard.press('PageDown');assert.equal(await activePage(),'2');
    await page.keyboard.down('Alt');near(Number(await page.locator('#grid4mm').getAttribute('width')),GRID);await page.keyboard.up('Alt');await page.locator('#componentCancel').click();
    console.log('PASS Page Up/Down with bounds and input guards, stronger toggleable grid, temporary Alt 2 mm part/wire snapping and blur reset');

    await load(bridgeFile);await page.locator('#selectTool').click();
    for(const [id,type,manufacturer,sap] of [[firstId,'Durchgangsklemme','M-DG-004','000044'],[secondId,'PE-Klemme','M-PE-005','000055']]){
      await page.locator(`#parts > g[data-id="${id}"] .part-body`).click({button:'right'});
      await page.locator('#componentForm [name="terminalType"]').fill(type);await page.locator('#componentForm [name="manufacturerNumber"]').fill(manufacturer);await page.locator('#componentForm [name="sapNumber"]').fill(sap);await page.locator('#componentForm [type="submit"]').click();
    }
    const mixed=await save(),mixedParts=drawing(mixed).parts;
    assert.equal(mixedParts.find(p=>p.id===firstId).masterId,mixedParts.find(p=>p.id===secondId).masterId);
    await page.locator('[data-overview="sheets"]').click();await page.locator('.sheetItem[data-sheet-kind="device-list"]').first().click();
    const cells=await page.locator('#deviceListContent text').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,x:Number(n.getAttribute('x')),y:Number(n.getAttribute('y'))})));
    assert.deepEqual(cells.filter(n=>n.y===128).map(n=>n.text),['AKS-KENNZEICHEN','BESCHRIFTUNG','BAUTEIL','WERT / TYP','HERSTELLERNUMMER','SAP-NUMMER','BLATT']);
    for(const [manufacturer,sap,type] of [['M-DG-004','000044','Durchgangsklemme'],['M-PE-005','000055','PE-Klemme']]){
      const article=cells.find(n=>n.text===manufacturer);assert.ok(article);near(article.x,685);
      assert.ok(cells.some(n=>n.y===article.y&&n.x===850&&n.text===sap));assert.ok(cells.some(n=>n.y===article.y&&n.x===540&&n.text===type));
    }
    await page.locator('.sheetItem[data-sheet-kind="terminal-list"]').first().click();const mixedList=await page.locator('#deviceListContent').textContent();
    assert.ok(mixedList.includes('KLEMMENTYP'));assert.ok(mixedList.includes('Durchgangsklemme'));assert.ok(mixedList.includes('PE-Klemme'));
    await page.reload();await load(mixed);const mixedReopened=drawing(await save()).parts;
    assert.equal(mixedReopened.find(p=>p.id===firstId).terminalType,'Durchgangsklemme');assert.equal(mixedReopened.find(p=>p.id===secondId).terminalType,'PE-Klemme');
    await page.locator('#autoLists').click();const typedCsv=await download('#csvDownload');assert.ok(typedCsv.includes('PE-Klemme'));assert.ok(typedCsv.includes('000055'));await page.locator('#simpleClose').click();
    const mixedPdf=await download('#exportBtn');assert.match(mixedPdf,/^%PDF-1.4/);assert.ok(mixedPdf.includes('/Count '+mixed.sheets.length));
    await fs.writeFile('/tmp/Cabel-Studio-smoke.expected.json',JSON.stringify({pages:mixed.sheets.length}));
    console.log('PASS manufacturer/SAP header columns after Value/Type, mixed terminal types in one strip, device/terminal lists, CSV, JSON and PDF');

    // Devices survive removal from a drawing; slaves can be placed independently.
    await load(bridgeFile);await page.locator('#selectTool').click();
    await page.locator(`#parts > g[data-id="${firstId}"] .part-body`).click();await page.keyboard.press('Delete');
    assert.equal(await page.locator(`#parts > g[data-id="${firstId}"]`).count(),0);
    const unplacedFile=await save();assert.equal(drawing(unplacedFile).parts.find(p=>p.id===firstId).unplaced,true);
    await page.reload();await load(unplacedFile);await page.locator('[data-overview="devices"]').click();
    const unplacedNode=page.locator(`[data-device-id="${firstId}"]`);
    assert.ok((await unplacedNode.getAttribute('class')).includes('device-unplaced'));
    await unplacedNode.locator(':scope > summary .device-jump').click();
    assert.equal(await page.locator(`#parts > g[data-id="${firstId}"]`).count(),1);
    assert.ok(!(drawing(await save()).parts.find(p=>p.id===firstId).unplaced));
    const beforeSlave=drawing(await save()).parts;const slave=beforeSlave.find(p=>p.id===firstId),master=beforeSlave.find(p=>p.id===slave.masterId);
    await dragPart(firstId,slave.x+2*GRID,slave.y+GRID);
    const afterSlave=drawing(await save()).parts.find(p=>p.id===master.id);near(afterSlave.x,master.x);near(afterSlave.y,master.y);
    // Explicit bridge ports retain their own endpoint indices and routes after reload.
    await page.locator('#bridgeTool').click();
    await page.locator(`[data-part="${firstId}"][data-term="8"]`).click();await page.locator(`[data-part="${secondId}"][data-term="8"]`).click();
    const separateBridge=drawing(await save()).wires.find(w=>w.a===firstId+':8'&&w.b===secondId+':8');assert.ok(separateBridge);assert.equal(separateBridge.kind,'bridge');
    await assertAttached();await assertOrthogonal();const bridgePortsFile=await save();await page.reload();await load(bridgePortsFile);await assertAttached();
    const labelStyle=await page.locator(`#parts > g[data-id="${firstId}"] .part-label`).evaluate(n=>({size:getComputedStyle(n).fontSize,color:getComputedStyle(n).fill}));assert.equal(labelStyle.size,'10px');assert.equal(labelStyle.color,'rgb(36, 99, 181)');
    await page.locator('[data-overview="devices"]').click();
    await page.locator(`[data-device-id="${master.id}"] > summary .terminal-manage`).click();
    const addedFile=await save(),added=drawing(addedFile).parts.find(p=>!drawing(bridgePortsFile).parts.some(q=>q.id===p.id));assert.ok(added);assert.equal(added.masterId,master.id);assert.equal(added.unplaced,true);
    await page.locator(`[data-device-id="${added.id}"] > summary .device-jump`).click();assert.equal(await page.locator(`#parts > g[data-id="${added.id}"]`).count(),1);
    page.once('dialog',dialog=>dialog.accept());await page.locator(`[data-device-id="${added.id}"] > summary .terminal-manage`).click();
    assert.ok(!drawing(await save()).parts.some(p=>p.id===added.id));
    console.log('PASS persisted yellow unplaced/blue placed devices, independent slave placement/movement, separate bridge ports and routes, add/remove strip terminals, smaller blue symbol text');

    // One terminal list per strip; separate pin symbols preserve parent ownership and routes.
    await load(bridgePortsFile);await page.locator('[data-overview="devices"]').click();
    assert.equal(await page.locator('.device-node > summary small').count(),0);
    const pinButton=page.locator(`[data-pin-part="${firstId}"][data-pin-index="0"]`);await pinButton.click();
    let pinProject=await save(),single=drawing(pinProject).parts.find(p=>p.type==='terminal-pin'&&p.masterId===firstId&&p.pinIndex===0);assert.ok(single);
    assert.equal(await page.locator(`[data-part="${firstId}"][data-term="0"]`).isVisible(),false);
    const parentBefore=drawing(pinProject).parts.find(p=>p.id===firstId);
    await dragPart(single.id,single.x-3*GRID,single.y+4*GRID);const movedPin=drawing(await save()).parts.find(p=>p.id===single.id);near(movedPin.x,single.x-3*GRID);near(movedPin.y,single.y+4*GRID);
    pinProject=await save();const parentAfter=drawing(pinProject).parts.find(p=>p.id===firstId);near(parentBefore.x,parentAfter.x);near(parentBefore.y,parentAfter.y);
    await page.locator(`[data-pin-part="${firstId}"][data-pin-index="8"]`).click();
    let bridgePin=drawing(await save()).parts.find(p=>p.type==='terminal-pin'&&p.masterId===firstId&&p.pinIndex===8);assert.ok(bridgePin);
    assert.ok(drawing(await save()).wires.some(w=>w.a===bridgePin.id+':0'||w.b===bridgePin.id+':0'));
    await dragPart(bridgePin.id,bridgePin.x+GRID,bridgePin.y+3*GRID);await assertAttached();await assertOrthogonal();
    await page.locator('#selectTool').click();await page.locator(`#parts > g[data-id="${firstId}"] .part-body`).click();await page.keyboard.press('Delete');
    assert.equal(await page.locator(`#parts > g[data-id="${single.id}"]`).count(),1);assert.equal(await page.locator(`#parts > g[data-id="${bridgePin.id}"]`).count(),1);
    const independentFile=await save();await page.reload();await load(independentFile);await assertAttached();
    await page.locator('[data-overview="devices"]').click();await page.locator(`[data-device-id="${firstId}"] > summary .device-jump`).click();
    const positions=await page.locator(`#parts > g[data-id="${secondId}"] .terminal`).evaluateAll(nodes=>nodes.map(n=>({x:Number(n.getAttribute('cx')),y:Number(n.getAttribute('cy')),bridge:n.classList.contains('bridge-terminal')})).sort((a,b)=>a.x-b.x));
    assert.ok(positions.every(p=>p.y===0));assert.deepEqual(positions.map(p=>p.bridge),[false,false,true,false,false]);
    await page.locator('#createTerminalStrip').click();await page.locator('#stripForm [name="code"]').fill('X3');await page.locator('#stripForm [name="count"]').fill('2');await page.locator('#stripForm [type="submit"]').click();
    await page.locator('[data-overview="sheets"]').click();assert.equal(await page.locator('.sheetItem[data-sheet-kind="terminal-list"]').count(),3);
    await page.locator('.sheetItem[data-sheet-kind="terminal-list"]').first().click();
    assert.ok(await page.locator('.terminal-bridge').count()>0);assert.ok((await page.locator('#deviceListContent').textContent()).includes('X1'));
    await page.locator('#deviceListContent > text').first().click({button:'right'});assert.equal(await page.locator('#componentForm [name="deviceCode"]').inputValue(),'X1');await page.locator('#componentCancel').click();
    await page.locator(`.terminal-list-link[data-part-id="${firstId}"]`).first().click({button:'right'});
    assert.equal(await page.locator('#componentForm [name="label"]').inputValue(),parentBefore.label);await page.locator('#componentForm [name="terminalType"]').fill('Testklemme');await page.locator('#componentForm [type="submit"]').click();
    assert.ok((await page.locator('#deviceListContent').textContent()).includes('Testklemme'));
    const listFile=await save();await page.reload();await load(listFile);assert.ok(await page.locator('.terminal-bridge').count()>0);
    await page.locator('.sheetItem[data-sheet-kind="terminal-list"]').last().click();assert.ok((await page.locator('#deviceListContent').textContent()).includes('X3'));assert.equal(await page.locator('.terminal-bridge').count(),0);
    const finalPdf=await download('#exportBtn');assert.match(finalPdf,/^%PDF-1.4/);assert.ok(finalPdf.includes('/Count '+(await save()).sheets.length));await fs.writeFile('/tmp/Cabel-Studio-smoke.expected.json',JSON.stringify({pages:(await save()).sheets.length}));
    await page.locator('.sheetItem[data-sheet-kind="terminal-list"]').first().click();await page.screenshot({path:'/tmp/Cabel-Studio-v1.9.1-terminal-list.png'});
    console.log('PASS compact device tree, independent regular/bridge pin placement and movement with attached wires, inline terminals, one list per strip, graphical bridges, right-click edits and PDF/JSON roundtrip');

    const overviewFixture={title:'Mehrfachauswahl',sheets:[{id:'multi-sheet',title:'Zeichnung',parts:[
      {id:'p801',type:'switch',label:'Master',deviceCode:'K1',value:'Schütz',x:10*GRID,y:10*GRID,targetSheetId:'multi-sheet',targetPartId:'p804'},
      {id:'p802',type:'lamp',label:'Slave',deviceCode:'H1',masterId:'p801',value:'24 V',x:20*GRID,y:10*GRID},
      {id:'p803',type:'coil',label:'Vorrat',deviceCode:'K2',x:40*GRID,y:20*GRID,unplaced:true},
      {id:'p804',type:'resistor',label:'Fest',deviceCode:'R1',x:35*GRID,y:12*GRID},
      {id:'p805',type:'text',label:'Kommentar',x:50*GRID,y:30*GRID},
      {id:'p810',type:'terminal-strip',label:'X9',deviceCode:'X9',x:7*GRID,y:35*GRID},
      {id:'p811',type:'connector',label:'X9:1',deviceCode:'X9.1',masterId:'p810',pinNumbers:['1a','1b'],x:12*GRID,y:35*GRID,unplaced:true},
    ],wires:[{id:'w820',a:'p801:1',b:'p802:0',points:[{x:14*GRID,y:10*GRID},{x:14*GRID,y:14*GRID},{x:18*GRID,y:14*GRID},{x:18*GRID,y:10*GRID}]},{id:'w821',a:'p802:1',b:'p804:0',points:[]}]}],activeSheet:0};
    await load(overviewFixture);await page.locator('#selectTool').click();
    const rectangle=async(x1,y1,x2,y2)=>{const a=await screen(x1,y1),b=await screen(x2,y2);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up()};
    await rectangle(7*GRID,7*GRID,23*GRID,17*GRID);assert.equal(await page.locator('#parts > g.selected').count(),2);
    await dragPart('p801',13*GRID,12*GRID);let multi=drawing(await save());
    near(multi.parts.find(p=>p.id==='p801').x,13*GRID);near(multi.parts.find(p=>p.id==='p802').x,23*GRID);near(multi.parts.find(p=>p.id==='p802').y,12*GRID);near(multi.parts.find(p=>p.id==='p804').x,35*GRID);
    const originalRoute=drawing(overviewFixture).wires[0].points,movedRoute=multi.wires.find(w=>w.id==='w820').points;assert.equal(movedRoute.length,originalRoute.length);movedRoute.forEach((p,i)=>{near(p.x,originalRoute[i].x+3*GRID);near(p.y,originalRoute[i].y+2*GRID)});await assertAttached();await assertOrthogonal();
    await page.keyboard.press('Escape');await page.locator('[data-overview="devices"]').click();
    const dropFromTree=async(locator,x,y)=>{const pt=await screen(x,y),box=await page.locator('#sheet').boundingBox();await locator.dragTo(page.locator('#sheet'),{targetPosition:{x:pt.x-box.x,y:pt.y-box.y}})};
    const unplacedButton=page.locator('[data-device-id="p803"] > summary .device-jump');
    const unplacedStyle=await unplacedButton.evaluate(n=>({color:getComputedStyle(n).color,size:getComputedStyle(n).fontSize,weight:getComputedStyle(n).fontWeight}));assert.equal(unplacedStyle.color,'rgb(73, 52, 0)');assert.equal(unplacedStyle.size,'12px');assert.equal(unplacedStyle.weight,'700');
    await dropFromTree(unplacedButton,30*GRID,30*GRID);multi=drawing(await save());const placed=multi.parts.find(p=>p.id==='p803');assert.ok(!placed.unplaced);near(placed.x,30*GRID);near(placed.y,30*GRID);assert.equal(multi.parts.length,7);
    assert.equal(await page.locator('[data-device-id="p803"] > summary .device-jump').evaluate(n=>getComputedStyle(n).color),'rgb(18, 50, 72)');
    await dropFromTree(page.locator('[data-device-id="p803"] > summary .device-jump'),34*GRID,30*GRID);near(drawing(await save()).parts.find(p=>p.id==='p803').x,34*GRID);
    await page.locator('[data-device-id="p803"] > summary').click({button:'right',position:{x:2,y:2}});assert.equal(await page.locator('#componentForm [name="label"]').inputValue(),'Vorrat');await page.locator('#componentCancel').click();
    await dropFromTree(page.locator('[data-pin-part="p811"][data-pin-index="0"]'),25*GRID,35*GRID);const pinDrop=drawing(await save()).parts.find(p=>p.type==='terminal-pin'&&p.masterId==='p811');assert.ok(pinDrop);near(pinDrop.x,25*GRID);near(pinDrop.y,35*GRID);
    await page.locator('[data-device-id="p801"] > summary').click({button:'right',position:{x:2,y:2}});
    for(const key of ['label','value','aks','pins','reference'])await page.locator(`#componentForm [name="show_${key}"]`).uncheck();await page.locator('#componentForm [type="submit"]').click();
    for(const selector of ['.part-label','.part-value','.part-aks','.pin-label','.page-reference'])for(const node of await page.locator('#parts > g[data-id="p801"] '+selector).all())assert.equal(await node.isVisible(),false);
    assert.equal(await page.locator('#parts > g[data-id="p802"] .part-label').isVisible(),true);
    await page.locator('#parts > g[data-id="p805"] .part-body').click({button:'right'});await page.locator('#componentForm [name="show_annotation"]').uncheck();await page.locator('#componentForm [type="submit"]').click();assert.equal(await page.locator('#parts > g[data-id="p805"] .annotation-text').isVisible(),false);
    const visibilityFile=await save();await page.reload();await load(visibilityFile);assert.equal(drawing(await save()).parts.find(p=>p.id==='p801').textVisibility.aks,false);assert.equal(await page.locator('#parts > g[data-id="p801"] .part-aks').isVisible(),false);await assertAttached();
    await page.locator('#parts > g[data-id="p801"] .part-body').click({button:'right'});await page.locator('#componentForm [name="show_label"]').check();await page.locator('#componentForm [type="submit"]').click();assert.equal(await page.locator('#parts > g[data-id="p801"] .part-label').isVisible(),true);assert.equal(await page.locator('#parts > g[data-id="p801"] .part-value').isVisible(),false);
    const visibilityPdf=await download('#exportBtn');assert.match(visibilityPdf,/^%PDF-1.4/);await fs.writeFile('/tmp/Cabel-Studio-smoke.expected.json',JSON.stringify({pages:(await save()).sheets.length}));
    console.log('PASS area selection and joint movement without double-moving slaves, internal/external wire routes, native device/pin tree drag/drop, readable status colors, summary right-click, per-object text switches and PDF/JSON roundtrip');

    assert.deepEqual(errors, []);
    console.log('PASS deletion cleans attached wires, generated device lists, no browser JavaScript errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
