// Chromium tablet emulation and real browser Pointer Events; no physical Pencil is required.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium, devices } = require('playwright');
const ROOT = path.resolve(__dirname, '..'), GRID = 4 * 1128 / 297;
const near = (a, b, tolerance = 1e-5) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const drawings = project => project.sheets.filter(s => !s.kind);

(async () => {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(ROOT, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(ROOT + path.sep)) return res.writeHead(403).end();
      res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'application/javascript' : 'application/json');
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    const url = `http://127.0.0.1:${server.address().port}/`, errors = [];
    const context = await browser.newContext(devices['iPad Pro 11 landscape']);
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', e => errors.push(e.message));
    const client = await context.newCDPSession(page);
    await page.goto(url);
    const download = async selector => {
      const [file] = await Promise.all([page.waitForEvent('download'), page.locator(selector).click()]);
      const chunks = []; for await (const chunk of await file.createReadStream()) chunks.push(chunk);
      return Buffer.concat(chunks);
    };
    const save = async () => JSON.parse((await download('#saveBtn')).toString());
    const load = async project => {
      await page.locator('#fileInput').setInputFiles({ name: 'tablet.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
      await page.waitForFunction(() => document.querySelector('#toast').textContent === 'Project loaded');
      await page.locator('#selectTool').click();
    };
    const screen = (x, y) => page.locator('#pageContent').evaluate((g, p) => {
      const q = new DOMPoint(p.x, p.y).matrixTransform(g.getScreenCTM()); return { x: q.x, y: q.y };
    }, { x, y });
    const transform = () => page.locator('#pageContent').getAttribute('transform');
    const pen = async (type, p, down = true) => client.send('Input.dispatchMouseEvent', {
      type, x: p.x, y: p.y, pointerType: 'pen', button: type === 'mouseMoved' ? 'none' : 'left',
      buttons: down ? 1 : 0, force: down ? .6 : 0, clickCount: type === 'mouseMoved' ? 0 : 1
    });
    const penTap = async p => { await pen('mousePressed', p); await pen('mouseReleased', p, false); };
    const penDrag = async (a, b) => {
      await pen('mousePressed', a);
      for (let i = 1; i <= 6; i++) await pen('mouseMoved', { x: a.x + (b.x - a.x) * i / 6, y: a.y + (b.y - a.y) * i / 6 });
      await pen('mouseReleased', b, false);
    };
    const touch = (type, points) => client.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ ...p, id: i + 1 })) });
    const assertLayout = async () => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const canvas = await page.locator('#sheet').boundingBox(); near(canvas.width, page.viewportSize().width, 1);
      const chrome = await page.locator('header').boundingBox(); assert.ok(canvas.y >= chrome.y + chrome.height);
      assert.equal(await page.locator('#sheet').evaluate(n => n.contains(document.querySelector('.newnav'))), false);
      assert.equal(await page.locator('.newnav').evaluate(n => Boolean(n.closest('header'))), true);
      for (const id of ['selectTool','wireTool','bridgeTool','aksAreaTool','panTool','propertiesBtn','undoBtn','fullscreenBtn']) {
        const box = await page.locator('#' + id).boundingBox(); assert.ok(box.height >= 44, id + ' must be touch sized');
      }
    };
    await assertLayout();
    assert.equal(await page.locator('#libraryToggle').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#overviewToggle').getAttribute('aria-expanded'), 'false');
    let project = await save();
    assert.equal(drawings(project)[0].title, 'Schematic');
    for (const sheet of project.sheets) assert.doesNotMatch(sheet.title, /\b\d{4}\b/);
    await page.locator('#overviewToggle').tap(); await page.locator('.sheetItem[data-sheet-kind="cover"]').tap();
    await page.waitForFunction(() => document.querySelector('#scene').style.display === 'none');
    await page.locator('#libraryToggle').tap();
    await page.locator('#catalogSearch').fill('Resistor');
    await page.locator('.part[data-type="resistor"]').tap();
    assert.equal(await page.locator('#libraryToggle').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#scene').evaluate(n => n.style.display), '', 'Placement from a generated page opens a drawing');
    assert.equal(drawings(await save())[0].parts.length, 0, 'Choosing a tablet library entry waits for a drawing position');
    const placementCenter = await screen(30 * GRID, 22 * GRID);
    await touch('touchStart', [{ x: placementCenter.x - 50, y: placementCenter.y }, { x: placementCenter.x + 50, y: placementCenter.y }]);
    await touch('touchMove', [{ x: placementCenter.x - 75, y: placementCenter.y }, { x: placementCenter.x + 75, y: placementCenter.y }]);
    await touch('touchEnd', []);
    assert.equal(drawings(await save())[0].parts.length, 0, 'Navigation while placing must not insert a component');
    await page.locator('#fitBtn').click();
    await penTap(await screen(20 * GRID, 20 * GRID));
    project = await save(); let part = drawings(project)[0].parts[0];
    near(part.x, 20 * GRID); near(part.y, 20 * GRID);
    assert.equal(drawings(project)[0].parts.length, 1);
    await penDrag(await screen(part.x, part.y), await screen(25 * GRID, 22 * GRID));
    part = drawings(await save())[0].parts[0]; near(part.x, 25 * GRID); near(part.y, 22 * GRID);
    await page.locator('#undoBtn').tap(); part = drawings(await save())[0].parts[0]; near(part.x, 20 * GRID);
    await page.locator('#redoBtn').tap(); part = drawings(await save())[0].parts[0]; near(part.x, 25 * GRID);
    console.log('PASS tablet chrome, separate page numbers, tap/Pencil placement, pen drag and toolbar undo/redo');

    const beforeNavigation = await save(), beforeView = await transform();
    let a = await screen(12 * GRID, 14 * GRID), b = { x: a.x + 65, y: a.y + 40 };
    await touch('touchStart', [a]); await touch('touchMove', [b]); await touch('touchEnd', []);
    assert.notEqual(await transform(), beforeView); assert.deepEqual(await save(), beforeNavigation);
    await page.locator('#fitBtn').click();
    const center = await screen(35 * GRID, 22 * GRID);
    const worldAt = p => page.locator('#pageContent').evaluate((g, p) => { const q = new DOMPoint(p.x, p.y).matrixTransform(g.getScreenCTM().inverse()); return { x: q.x, y: q.y }; }, p);
    const anchorBefore = await worldAt(center);
    await touch('touchStart', [{ x: center.x - 60, y: center.y }, { x: center.x + 60, y: center.y }]);
    await touch('touchMove', [{ x: center.x - 100, y: center.y }, { x: center.x + 100, y: center.y }]);
    await touch('touchEnd', []);
    assert.ok(parseInt(await page.locator('#zoomLabel').textContent()) > 150);
    const anchorAfter = await worldAt(center); near(anchorBefore.x, anchorAfter.x, .2); near(anchorBefore.y, anchorAfter.y, .2);
    assert.deepEqual(await save(), beforeNavigation);
    await page.locator('#fitBtn').click();

    // A touching palm cannot navigate or edit while the Pencil owns the gesture.
    a = await screen(part.x, part.y); b = await screen(part.x + 3 * GRID, part.y);
    const palmView = await transform(); await pen('mousePressed', a);
    await page.locator('#sheet').dispatchEvent('pointerdown', { pointerId: 901, pointerType: 'touch', clientX: a.x + 80, clientY: a.y, button: 0, bubbles: true });
    await page.locator('#sheet').dispatchEvent('pointermove', { pointerId: 901, pointerType: 'touch', clientX: a.x + 160, clientY: a.y + 30, bubbles: true });
    await page.locator('#sheet').dispatchEvent('pointerup', { pointerId: 901, pointerType: 'touch', bubbles: true });
    assert.equal(await transform(), palmView);
    await pen('mouseMoved', b); await pen('mouseReleased', b, false);
    part = drawings(await save())[0].parts[0]; near(part.x, 28 * GRID);
    const beforeCancel = await save();
    await page.evaluate(() => document.addEventListener('pointerdown', e => { window.testPenId = e.pointerId; }, { once: true, capture: true }));
    a = await screen(part.x, part.y); b = await screen(part.x + 4 * GRID, part.y + GRID);
    await pen('mousePressed', a); await pen('mouseMoved', b);
    await page.locator('#sheet').dispatchEvent('pointercancel', { pointerId: await page.evaluate(() => window.testPenId), pointerType: 'pen', bubbles: true });
    await pen('mouseReleased', b, false); assert.deepEqual(await save(), beforeCancel);
    console.log('PASS finger pan, anchored two-finger pinch, unchanged project data, concurrent palm suppression and cancelled pen-drag rollback');

    await page.locator('#touchEditToggle').tap();
    a = await screen(part.x, part.y); b = await screen(part.x, part.y + 3 * GRID);
    await touch('touchStart', [a]); await touch('touchMove', [b]); await touch('touchEnd', []);
    near(drawings(await save())[0].parts[0].y, part.y + 3 * GRID);
    await page.locator('#touchEditToggle').tap();
    const beforeHold = await save(); part = drawings(beforeHold)[0].parts[0];
    a = await screen(part.x, part.y); await pen('mousePressed', a); await page.waitForTimeout(650); await pen('mouseReleased', a, false);
    assert.equal(await page.locator('#componentForm').isVisible(), true);
    await page.locator('#componentForm [name="value"]').fill('Pencil tested');
    await page.locator('#componentForm [type="submit"]').tap();
    assert.equal(drawings(await save())[0].parts[0].value, 'Pencil tested');
    await page.locator('#libraryToggle').tap(); await page.locator('[data-library-mode="products"]').tap();
    await page.locator('#catalogSearch').fill('S201'); await page.locator('.catalog-part').first().tap();
    const productPosition = await screen(10 * GRID, 30 * GRID); await page.touchscreen.tap(productPosition.x, productPosition.y);
    assert.ok(drawings(await save())[0].parts.some(p => p.catalog?.libraryId === 'abb'));
    console.log('PASS optional finger editing and Pencil hold-to-edit without right-click or keyboard');

    const fixture = { title: 'Tablet routing', sheets: [{ id: 'tablet-drawing', title: 'Power distribution', parts: [
      { id: 'p900', type: 'resistor', deviceCode: 'R1', label: 'R1', x: 20 * GRID, y: 20 * GRID },
      { id: 'p901', type: 'lamp', deviceCode: 'H1', label: 'H1', x: 40 * GRID, y: 20 * GRID }
    ], wires: [], aksAreas: [{ id: 'tablet-field', title: 'Control', x: 6 * GRID, y: 6 * GRID, width: 5 * GRID, height: 4 * GRID, functionCode: 'F1' }] }] };
    await load(fixture); await page.locator('#wireTool').tap();
    const terminalPoint = (id, index) => page.locator(`[data-part="${id}"][data-term="${index}"]`).evaluate(n => {
      const p = new DOMPoint(n.cx.baseVal.value, n.cy.baseVal.value).matrixTransform(n.getScreenCTM()); return { x: p.x, y: p.y };
    });
    a = await terminalPoint('p900', 1); await penTap({ x: a.x + 9, y: a.y + 6 });
    assert.equal(await page.locator('#preview').evaluate(n => n.style.display), 'block');
    const panA = await screen(30 * GRID, 28 * GRID);
    await touch('touchStart', [panA]); await touch('touchMove', [{ x: panA.x + 30, y: panA.y + 20 }]); await touch('touchEnd', []);
    b = await terminalPoint('p901', 0); await penTap({ x: b.x - 9, y: b.y + 6 });
    project = await save(); assert.equal(drawings(project)[0].wires.length, 1);
    assert.equal(drawings(project)[0].wires[0].a, 'p900:1'); assert.equal(drawings(project)[0].wires[0].b, 'p901:0');
    assert.equal(await page.locator('#preview').evaluate(n => n.style.display), 'none');
    await page.locator('#selectTool').tap();
    await page.waitForFunction(() => document.querySelector('#selectTool').getAttribute('aria-pressed') === 'true');
    await page.locator('#fitBtn').click();
    const box = await page.locator('[data-field-resize="se"]').boundingBox();
    a = { x: box.x + box.width / 2, y: box.y + box.height / 2 }; b = await screen(13 * GRID, 12 * GRID);
    await penDrag(a, b); project = await save();
    near(drawings(project)[0].aksAreas[0].width, 7 * GRID); near(drawings(project)[0].aksAreas[0].height, 6 * GRID);
    await page.locator('#undoBtn').tap(); near(drawings(await save())[0].aksAreas[0].width, 5 * GRID);
    assert.equal(await page.locator('#a4Sheet').textContent(), 'Power distribution');
    await page.locator('#overviewToggle').tap();
    assert.equal(await page.locator('.sheetItem[data-sheet-kind="drawing"] strong').textContent(), 'Power distribution');
    assert.match(await page.locator('.sheetItem[data-sheet-kind="drawing"] .sheet-number').textContent(), /^\d{4}$/);
    await page.locator('#overviewToggle').tap();
    console.log('PASS forgiving Pencil terminal targets, finger navigation during routing, pen field resize, title in drawing head and separate number badge');

    await page.locator('#fullscreenBtn').tap();
    await page.waitForFunction(() => document.fullscreenElement || document.querySelector('.app.focus-mode'));
    await page.locator('#pagePropertiesBtn').tap();
    assert.equal(await page.locator('#pagePropertiesForm').isVisible(), true);
    await page.locator('#pagePropertiesCancel').tap();
    await page.locator('#fullscreenBtn').tap();
    await page.waitForFunction(() => !document.fullscreenElement && !document.querySelector('.app.focus-mode'));
    await page.setViewportSize({ width: 834, height: 1194 }); await assertLayout();
    await page.locator('#pagePropertiesBtn').tap();
    assert.equal(await page.locator('#pagePropertiesForm [name="title"]').inputValue(), 'Power distribution');
    assert.equal(await page.locator('#pagePropertiesForm input').first().evaluate(n => getComputedStyle(n).fontSize), '16px');
    await page.locator('#pagePropertiesCancel').tap();
    await page.screenshot({ path: '/tmp/Cabel-Studio-v1.18.0-ipad-portrait.png' });
    await page.setViewportSize({ width: 1194, height: 834 });
    await page.screenshot({ path: '/tmp/Cabel-Studio-v1.18.0-ipad-landscape.png' });
    const pdf = await download('#exportBtn'); assert.match(pdf.toString('latin1', 0, 8), /^%PDF-1.4/);
    await page.waitForFunction(() => document.querySelector('#simpleModal').style.display !== 'grid');
    assert.equal(await page.locator('#propertiesBtn').isEnabled(), true);
    await fs.writeFile('/tmp/Cabel-Studio-tablet.pdf', pdf);
    await fs.writeFile('/tmp/Cabel-Studio-tablet.expected.json', JSON.stringify({ pages: (await save()).sheets.length }));
    project = await save(); await page.reload(); await load(project); assert.deepEqual(drawings(await save()), drawings(project));
    const fallback = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await fallback.addInitScript(() => {
      Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined });
      Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', { configurable: true, value: undefined });
    });
    await fallback.goto(url);
    await fallback.locator('#panTool').click(); assert.equal(await fallback.locator('#panTool').getAttribute('aria-pressed'), 'true');
    await fallback.keyboard.press('c');
    assert.equal(await fallback.locator('#panTool').getAttribute('aria-pressed'), 'false');
    assert.equal(await fallback.locator('#wireTool').getAttribute('aria-pressed'), 'true');
    await fallback.keyboard.press('v'); await fallback.locator('#fullscreenBtn').click();
    assert.equal(await fallback.locator('.app.focus-mode').count(), 1);
    await fallback.keyboard.press('Escape'); assert.equal(await fallback.locator('.app.focus-mode').count(), 0);
    await fallback.close();
    assert.deepEqual(errors, []);
    console.log('PASS landscape/portrait, full-screen entry/exit and unsupported-browser focus fallback, accessible dialogs, project roundtrip and PDF');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
