// Run: node tests/manufacturer-smoke.cjs (Playwright and Chromium required).
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
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
      res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'application/javascript' : 'application/json');
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

    const libraries = await Promise.all(['abb', 'phoenix-contact', 'finder'].map(async name => JSON.parse(await fs.readFile(path.join(ROOT, 'libraries', name + '.json'), 'utf8'))));
    assert.deepEqual(await page.evaluate(() => CABEL_CATALOGS), libraries);
    assert.equal(await page.locator('.manufacturer-library').count(), 3);
    const total = libraries.flatMap(l => l.families.flatMap(f => f.products)).length;
    assert.equal(await page.locator('.catalog-part').count(), total);
    for (const library of libraries) {
      assert.equal(library.coverage.complete, false);
      assert.ok(library.sources.every(s => s.retrieved === false));
      assert.ok(library.families.flatMap(f => f.products).every(p => ['not-verified', 'user-specified-reference'].includes(p.verification)));
    }
    await page.locator('[data-manufacturer="abb"] > summary').click();
    assert.deepEqual(JSON.parse((await download('[data-manufacturer="abb"] .catalog-download')).toString()), libraries[0]);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('#appVersion').textContent(), 'v1.14.0');
    assert.match(await page.title(), /Schematic editor/);
    assert.match(await page.locator('.hint').textContent(), /Right-click/);
    assert.equal(await page.locator('#wireTool').getAttribute('title'), 'Connect (C / W)');
    console.log(`PASS ${total} entries in three separate manufacturer files, matching browser bundle, honest verification metadata, folder downloads and English UI`);

    await load({ title: 'AC drives', parts: [], wires: [] });
    const motors = [];
    for (const [i, type] of ['motor-ac-1p', 'motor-ac-3p', 'motor-ac-6t'].entries()) {
      await page.locator(`.part[data-type="${type}"]`).click();
      const motor = parts(await save()).find(p => p.type === type); motors.push(motor);
      await dragPart(motor.id, (12 + 18 * i) * GRID, 16 * GRID);
      assert.equal(await page.locator(`#parts > g[data-id="${motor.id}"] .terminal`).count(), [3, 4, 7][i]);
      assert.equal(await page.locator(`#parts > g[data-id="${motor.id}"] circle.symbol`).count(), 1);
      const positions = await page.locator(`#parts > g[data-id="${motor.id}"] .terminal`).evaluateAll(nodes => nodes.map(n => {
        const p = new DOMPoint(n.cx.baseVal.value, n.cy.baseVal.value).matrixTransform(n.getScreenCTM()).matrixTransform(document.querySelector('#pageContent').getScreenCTM().inverse()); return { x: p.x, y: p.y };
      }));
      for (const p of positions) { near(p.x / GRID, Math.round(p.x / GRID), 1e-4); near(p.y / GRID, Math.round(p.y / GRID), 1e-4); }
    }
    let project = await save();
    assert.deepEqual(parts(project).map(p => p.pinNumbers), [['L', 'N', 'PE'], ['U1', 'V1', 'W1', 'PE'], ['U1', 'V1', 'W1', 'U2', 'V2', 'W2', 'PE']]);
    assert.equal(new Set(parts(project).map(p => p.deviceCode)).size, 3);
    await page.keyboard.press('c');
    await page.locator(`[data-part="${motors[1].id}"][data-term="0"]`).click();
    const bend = await screen(25 * GRID, 8 * GRID); await page.mouse.click(bend.x, bend.y);
    await page.locator(`[data-part="${motors[2].id}"][data-term="0"]`).click(); await page.keyboard.press('Escape');
    await dragPart(motors[2].id, 50 * GRID, 20 * GRID); await page.keyboard.press('r'); await assertAttached();
    const motorFile = await save();
    parts(motorFile)[0].value = 'Motor – Überprüfung'; // user-entered language is preserved
    await page.reload(); await load(motorFile);
    assert.deepEqual(parts(await save()).map(p => p.pinNumbers), parts(motorFile).map(p => p.pinNumbers)); await assertAttached();
    assert.equal(await page.locator(`#parts > g[data-id="${motors[0].id}"] .part-value`).textContent(), 'Motor – Überprüfung');
    console.log('PASS single-phase, three-phase and six-lead AC motors, distinct equipment tags, pins, movement/rotation, attached routes and JSON reopening');

    await load({ title: 'Manufacturer placement', parts: [], wires: [] });
    await page.locator('#zoomIn').click();
    const breaker = await placeProduct('abb:s203-c16', 12 * GRID, 12 * GRID);
    assert.ok(breaker); near(breaker.x, 12 * GRID); near(breaker.y, 12 * GRID);
    assert.equal(breaker.type, 'mcb-3p'); assert.equal(breaker.catalog.attributes.ratedCurrentA, 16);
    assert.equal(breaker.catalog.attributes.tripCurve, 'C'); assert.equal(breaker.manufacturer, 'ABB'); assert.equal(breaker.manufacturerNumber, '');
    assert.deepEqual(breaker.pinNumbers, ['1', '2', '3', '4', '5', '6']);
    const contactor = await placeProduct('abb:af09-22-00', 30 * GRID, 13 * GRID);
    assert.equal(contactor.contactConfiguration, '2NO2NC');
    assert.equal(await page.locator(`#parts > g[data-id="${contactor.id}"] .terminal`).count(), 10);
    const contacts = await page.locator(`#parts > g[data-id="${contactor.id}"] [data-contactor-contact]`).evaluateAll(nodes => nodes.map(n => n.querySelector('path').getAttribute('d')));
    assert.notEqual(contacts[0], contacts[2]); assert.equal(contacts[2], contacts[3]);
    const terminal = await placeProduct('phoenix-contact:st-2-5', 48 * GRID, 12 * GRID);
    const multiTerminal = await placeProduct('phoenix-contact:sttb-2-5', 48 * GRID, 17 * GRID);
    assert.equal(terminal.masterId, multiTerminal.masterId); assert.equal(multiTerminal.deviceCode, terminal.deviceCode);
    assert.deepEqual(multiTerminal.pinNumbers, ['2a', '2b', '2c', '2d']);
    assert.equal(multiTerminal.terminalType, 'STTB 2,5'); assert.equal(terminal.terminalType, 'ST 2,5');
    assert.ok(parts(await save()).find(p => p.id === terminal.masterId && p.type === 'terminal-strip' && p.unplaced));
    assert.equal(await page.locator(`#parts > g[data-id="${multiTerminal.id}"] .terminal`).count(), 5); // four pins plus the dedicated bridge port
    const exactRelay = await placeProduct('finder:60-13-9-024-0074', 12 * GRID, 30 * GRID);
    const singleRelay = await placeProduct('finder:series-60-11', 30 * GRID, 30 * GRID);
    const doubleRelay = await placeProduct('finder:series-60-12', 48 * GRID, 30 * GRID);
    project = await save();
    for (const [relay, count] of [[exactRelay, 3], [singleRelay, 1], [doubleRelay, 2]]) {
      const coil = parts(project).find(p => p.type === 'relay-coil' && p.masterId === relay.id);
      assert.ok(coil?.unplaced);
      assert.equal(parts(project).filter(p => p.type === 'relay-contact' && p.masterId === coil.id).length, count);
      assert.equal(await page.locator(`#parts > g[data-id="${relay.id}"] .terminal`).count(), 2 + 3 * count);
      assert.equal(await page.locator(`#parts > g[data-id="${relay.id}"] .relay-symbol-link`).count(), count + 1);
      assert.equal(relay.relayContactCount, count);
    }
    assert.equal(exactRelay.manufacturerNumber, '60.13.9.024.0074');
    assert.equal(parts(project).find(p => p.type === 'relay-coil' && p.masterId === exactRelay.id).value, '24 V DC');
    assert.equal(singleRelay.manufacturerNumber, '');
    await page.locator(`#parts > g[data-id="${breaker.id}"] .part-body`).click({ button: 'right' });
    assert.match(await page.locator('#componentForm').textContent(), /Unverified catalogue reference/);
    assert.match(await page.locator('#componentForm').textContent(), /Manufacturer number/);
    await page.locator('#componentForm [name="sapNumber"]').fill('00012345'); await page.locator('#componentForm [type="submit"]').click();
    const catalogueFile = await save(); await page.reload(); await load(catalogueFile);
    assert.deepEqual(parts(await save()).map(p => p.catalog), parts(catalogueFile).map(p => p.catalog));
    assert.equal(parts(await save()).find(p => p.id === breaker.id).sapNumber, '00012345');
    await page.locator('[data-overview="sheets"]').click(); await page.locator('.sheetItem[data-sheet-kind="terminal-list"]').click();
    assert.match(await page.locator('#deviceListContent').textContent(), /TERMINAL TYPE/);
    assert.match(await page.locator('#deviceListContent').textContent(), /STTB 2,5/);
    await page.locator('#autoLists').click();
    const listText = await page.locator('#simpleContent').textContent();
    assert.match(listText, /Save lists as CSV/); assert.match(listText, /= Function, \+ Location/);
    assert.doesNotMatch(listText, /Bezeichnung|Funktion|speichern|anzeigen/); await page.locator('#simpleClose').click();
    const pdf = await download('#exportBtn'); assert.match(pdf.toString('latin1', 0, 8), /^%PDF-1.4/);
    await fs.writeFile('/tmp/Cabel-Studio-manufacturers.pdf', pdf);
    await fs.writeFile('/tmp/Cabel-Studio-manufacturers.expected.json', JSON.stringify({ pages: (await save()).sheets.length }));
    await page.locator('.sheetItem[data-sheet-kind="drawing"]').first().click(); await page.screenshot({ path: '/tmp/Cabel-Studio-v1.14.0-manufacturers.png' });
    console.log('PASS catalogue drag/drop at zoom, ABB pole/contact geometry, mixed Phoenix terminal strip, Finder 1/2/3-contact assemblies, source metadata/SAP roundtrip, English lists and PDF');

    // The same library format can be imported; rejected files leave existing libraries intact.
    const custom = { schemaVersion: 1, id: 'example', manufacturer: 'Example <safe>', families: [{ id: 'motors', name: 'AC drives', products: [{ id: 'm1', model: 'M1 <prototype>', symbol: 'motor-ac-3p', manufacturerNumber: 'EX-001', verification: 'not-verified' }] }] };
    const importLibrary = data => page.locator('#catalogFile').setInputFiles({ name: 'example.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
    await importLibrary(custom); await page.waitForFunction(() => document.querySelector('#toast').textContent === 'Manufacturer library imported');
    await page.locator('#catalogSearch').fill('prototype'); await page.locator('[data-catalog-product="example:m1"]').click();
    assert.equal(parts(await save()).find(p => p.catalog?.libraryId === 'example').manufacturerNumber, 'EX-001');
    assert.equal(await page.locator('#catalogFolders prototype').count(), 0);
    const invalid = structuredClone(custom); invalid.families[0].products[0].symbol = 'unknown-symbol';
    await importLibrary(invalid); await page.waitForFunction(() => document.querySelector('#toast').textContent.startsWith('Could not import library:'));
    assert.equal(await page.locator('[data-catalog-product="example:m1"]').count(), 1);
    const malformed = structuredClone(custom); malformed.families[0].products[0].name = { invalid: true };
    await importLibrary(malformed); await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('text fields must be strings'));
    assert.equal(await page.locator('[data-catalog-product="example:m1"]').textContent(), 'M1 <prototype>AC motor · three phase');
    await page.locator('#catalogSearch').fill('');
    assert.equal(await page.locator('.manufacturer-library').count(), 4);
    // Offline file:// opening must load the checked-in bundle without a fetch/CORS dependency.
    const offline = await browser.newPage();
    let filePolicyBlocked = false;
    try { await offline.goto(pathToFileURL(path.join(ROOT, 'index.html')).href); }
    catch (error) {
      if (!error.message.includes('ERR_BLOCKED_BY_ADMINISTRATOR')) throw error;
      filePolicyBlocked = true;
      console.log('SKIP file:// browser check: Chromium administrator policy blocks local-file navigation');
    }
    if (!filePolicyBlocked) {
      assert.equal(await offline.locator('.manufacturer-library').count(), 3);
      await offline.locator('#catalogSearch').fill('60.13.9.024.0074'); await offline.locator('[data-catalog-product="finder:60-13-9-024-0074"]').click();
      assert.equal(await offline.locator('#parts > g .terminal').count(), 11);
      console.log('PASS offline file:// catalogue placement');
    }
    await offline.close();
    console.log('PASS safe manufacturer JSON import/validation, literal text escaping and rejected-file preservation');

    await load({ title: 'Short bridges', parts: [
      { id: 'p2000', type: 'terminal-strip', deviceCode: 'X1', label: 'X1', x: 5 * GRID, y: 5 * GRID, unplaced: true },
      ...[[2001, 10, 12, 0], [2002, 13, 12, 0], [2003, 32, 10, 90], [2004, 32, 13, 90]].map(([id, x, y, rotation], i) => ({ id: 'p' + id, type: 'connector', masterId: 'p2000', deviceCode: 'X1', label: 'X1', terminalNumber: String(i + 1), value: 'Terminal', pinNumbers: [(i + 1) + 'a', (i + 1) + 'b'], x: x * GRID, y: y * GRID, rotation })),
    ], wires: [
      { id: 'w2010', kind: 'bridge', a: 'p2001:1', b: 'p2002:0', points: [], labelT: .5 },
      { id: 'w2011', kind: 'bridge', a: 'p2003:1', b: 'p2004:0', points: [], labelT: .5 },
    ] });
    for (const id of ['w2010', 'w2011']) {
      assert.equal(await page.locator(`.wire-label[data-wire-label="${id}"]`).isVisible(), false);
      assert.equal(await page.locator(`#wires .wire[data-id="${id}"]`).evaluate(p => getComputedStyle(p).display !== 'none' && getComputedStyle(p).visibility === 'visible' && p.getTotalLength() > 0), true);
    }
    const hiddenBridgePoint = await page.locator('#wires .wire[data-id="w2010"]').evaluate(p => {
      const q = p.getPointAtLength(p.getTotalLength() / 2).matrixTransform(p.getScreenCTM()); return { x: q.x, y: q.y };
    });
    await page.mouse.click(hiddenBridgePoint.x, hiddenBridgePoint.y); await page.locator('#wireDataButton').click();
    assert.equal(await page.locator('#wireKind').inputValue(), 'bridge'); await page.locator('#simpleClose').click();
    await dragPart('p2002', 20 * GRID, 12 * GRID); await dragPart('p2004', 32 * GRID, 23 * GRID);
    for (const id of ['w2010', 'w2011']) assert.equal(await page.locator(`.wire-label[data-wire-label="${id}"]`).isVisible(), true);
    assert.match(await page.locator('.wire-label[data-wire-label="w2011"]').getAttribute('transform'), /rotate\(-90\)/);
    await assertAttached();
    await dragPart('p2002', 13 * GRID, 12 * GRID); await dragPart('p2004', 32 * GRID, 13 * GRID);
    const bridgeFile = await save(); await page.reload(); await load(bridgeFile);
    assert.equal(drawings(await save())[0].wires.length, 2);
    assert.equal(await page.locator('.wire-label[data-label-hidden="true"]').count(), 2); await assertAttached();
    assert.deepEqual(errors, []);
    console.log('PASS fit-aware horizontal/vertical bridge labels, automatic reveal/hide after movement, persistent routes and no browser/asset errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
