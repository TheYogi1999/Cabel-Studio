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
    assert.deepEqual(sheet.wires[0].points, waypoints.map(([x, y]) => ({ x: snap(x), y: snap(y) })));
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
      near(p.x, original.wires[0].points[i].x + GRID * (i === 0 ? 3 : i === 3 ? -2 : 0));
      near(p.y, original.wires[0].points[i].y + GRID * (i === 0 ? 2 : i === 3 ? 3 : 0));
    });
    const routeMoved = await page.locator('#wires path.wire').getAttribute('d');
    assert.notEqual(routeBefore, routeMoved);
    const vertices = routeMoved.match(/-?\d+(?:\.\d+)?/g).map(Number);
    near(vertices[0], sheet.parts[0].x + 48); near(vertices[1], sheet.parts[0].y);
    near(vertices.at(-2), sheet.parts[1].x - 48); near(vertices.at(-1), sheet.parts[1].y);
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
      near(p.x, sheet.wires[0].points[i].x + (i === 0 ? GRID : 0));
      near(p.y, sheet.wires[0].points[i].y - (i === 0 ? GRID : 0));
    });
    await dragPart('p2', sheet.parts[1].x + GRID, sheet.parts[1].y + GRID);
    movedAgain = drawing(await save());
    movedAgain.wires[0].points.forEach((p, i) => {
      near(p.x, sheet.wires[0].points[i].x + (i === 0 || i === 3 ? GRID : 0));
      near(p.y, sheet.wires[0].points[i].y + (i === 0 ? -GRID : i === 3 ? GRID : 0));
    });
    await assertAttached();
    await load(project);
    const svg = await download('#exportBtn');
    assert.ok(svg.includes(routeMoved)); assert.ok(svg.includes('R label &lt;&amp;&gt;'));
    console.log('PASS 4 mm routes: only adjacent bends follow either component, interior bends stay fixed, exact terminal alignment, JSON roundtrip and legacy anchors, SVG export');

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
    assert.equal(drawing(await save()).wires.at(-1).points.length, 0);
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
    assert.equal(await page.locator('#appVersion').textContent(), 'v1.1.0');
    await load(project);
    await page.locator('#selectTool').click();
    await page.locator('#parts > g[data-id="p1"] .part-body').click();
    await page.keyboard.press('r');
    let transformed = drawing(await save());
    assert.equal(transformed.parts[0].rotation, 90);
    await assertAttached();
    // Only the first bend follows the rotated start terminal.
    near(transformed.wires[0].points[0].x, sheet.wires[0].points[0].x - 48);
    near(transformed.wires[0].points[0].y, sheet.wires[0].points[0].y + 48);
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
    const textId = await page.locator('.annotation-text').evaluate(t => t.parentNode.dataset.id);
    await dragPart(textId, snap(500), snap(500));
    await page.keyboard.press('r');
    let withText = await save();
    assert.equal(withText.appVersion, '1.1.0');
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
    await page.locator('.part[data-type="resistor"]').click();
    const targetObjectId = await page.locator('#parts > g').getAttribute('data-id');
    await page.keyboard.press('j'); await page.locator('#pageJumpTarget').selectOption('0');
    await page.locator('#pageJumpForm [type="submit"]').click();
    await page.locator('.part[data-type="reference"]').click();
    const referenceId = await page.locator('#parts > g.selected').getAttribute('data-id');
    assert.ok((await page.locator(`#parts > g[data-id="${referenceId}"] .symbol`).getAttribute('d')).includes('L 20 0'));
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
    console.log('PASS v1.1.0, C/X/Y/R/T/J shortcuts, transformed wire endpoints and adjacent bends, text and page references after save/reopen');
    assert.deepEqual(errors, []);
    console.log('PASS deletion cleans attached wires, generated device lists, no browser JavaScript errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
