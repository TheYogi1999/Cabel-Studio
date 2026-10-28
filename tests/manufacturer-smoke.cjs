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
      const [file] = await Promise.all([page.waitForEvent('download',{timeout:selector==='#exportBtn'?60000:10000}), page.locator(selector).click()]);
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

    const libraryNames=(await fs.readdir(path.join(ROOT,'libraries'))).filter(name=>name.endsWith('.json')).sort();
    const libraries = await Promise.all(libraryNames.map(async name => JSON.parse(await fs.readFile(path.join(ROOT, 'libraries', name), 'utf8'))));
    assert.deepEqual(await page.evaluate(() => CABEL_CATALOGS), libraries);
    assert.equal(await page.locator('.manufacturer-library').count(), libraries.length);
    const total = libraries.flatMap(l => l.families.flatMap(f => f.products)).length;
    assert.equal(await page.locator('.catalog-part').count(), total);
    for (const library of libraries) {
      assert.equal(library.coverage.complete, false);
      assert.ok(library.sources.every(s => s.retrieved === false||['abb','phoenix-contact'].includes(library.id)&&s.retrieved===true&&s.scope?.includes('only;')||library.id==='eao'&&s.retrieved===true&&s.scope?.startsWith('Series')||library.id==='beckhoff'&&s.retrieved===true&&s.scope?.startsWith('EK1501 optical interface only')));
      assert.ok(library.families.flatMap(f => f.products).every(p => (['not-verified', 'user-specified-reference'].includes(p.verification)||library.id==='beckhoff'&&p.id==='ek1501'&&p.verification==='optical-interface-documented')));
    }
    assert.equal(await page.locator('#emptyState').count(),0);
    assert.equal(await page.getByText('Start your schematic here',{exact:true}).count(),0);
    assert.equal(await page.locator('[data-library-mode="generic"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.part[data-type="resistor"]').isVisible(),true);
    assert.equal(await page.locator('#manufacturerLibraries').isVisible(),false);
    const searchBox=await page.locator('#catalogSearch').boundingBox(),firstFolder=await page.locator('.component-group').first().boundingBox();assert.ok(searchBox.y+searchBox.height<firstFolder.y);
    await page.locator('.sidebar').evaluate(n=>n.scrollTop=n.scrollHeight);
    const stickySearch=await page.locator('#catalogSearch').boundingBox(),sidebarBox=await page.locator('.sidebar').boundingBox();assert.ok(stickySearch.y>=sidebarBox.y&&stickySearch.y+stickySearch.height<=sidebarBox.y+sidebarBox.height);
    await page.locator('.sidebar').evaluate(n=>n.scrollTop=0);
    await page.locator('#catalogSearch').fill('ReSiSt*');assert.equal(await page.locator('.part[data-type="resistor"]').isVisible(),true);assert.equal(await page.locator('.part[data-type="lamp"]').isVisible(),false);assert.equal(await page.locator('#createTerminalStrip').isVisible(),false);
    await page.locator('#catalogSearch').fill('*contact');assert.ok(await page.locator('.component-group .part:not([hidden])').count()>=3);
    await page.locator('#catalogSearch').fill('*not-a-component*');assert.equal(await page.locator('#componentSearchEmpty').isVisible(),true);
    await page.locator('#catalogSearch').fill('*');await page.locator('[data-library-mode="products"]').click();
    assert.equal(await page.locator('.part[data-type="resistor"]').isVisible(),false);assert.equal(await page.locator('#symbolEditorLink').isVisible(),false);assert.equal(await page.locator('.catalog-part').count(),total);
    const models=()=>page.locator('.catalog-part strong').allTextContents();
    await page.locator('#catalogSearch').fill('s201*');assert.ok((await models()).length>0);assert.ok((await models()).every(m=>m.startsWith('S201')));
    await page.locator('[data-library-mode="generic"]').click();assert.equal(await page.locator('#catalogSearch').inputValue(),'s201*');assert.equal(await page.locator('#componentSearchEmpty').isVisible(),true);await page.locator('[data-library-mode="products"]').click();assert.ok((await models()).length>0);
    for(const query of ['*0074','*024*','60.*.024.*','**60.**024**0074**']){await page.locator('#catalogSearch').fill(query);assert.deepEqual(await models(),['60.13.9.024.0074'])}
    await page.locator('#catalogSearch').fill('*fInDeR*');assert.equal((await models()).length,libraries.find(l=>l.id==='finder').families.flatMap(f=>f.products).length);
    await page.locator('#catalogSearch').fill('*[.*');assert.equal(await page.locator('.catalog-part').count(),0);assert.equal(await page.locator('#componentSearchEmpty').isVisible(),true);
    await page.locator('#catalogSearch').fill('**');assert.equal(await page.locator('.catalog-part').count(),total);
    await page.locator('#catalogSearch').fill('');
    console.log('PASS Generic/Products library switching, top/sticky shared search, case-insensitive plain/prefix/suffix/middle/multiple-star searches, literal punctuation, empty results and removed start overlay');
    await page.locator('[data-manufacturer="abb"] > summary').click();
    assert.deepEqual(JSON.parse((await download('[data-manufacturer="abb"] .catalog-download')).toString()), libraries[0]);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('#appVersion').textContent(), 'v1.37.2');
    assert.match(await page.title(), /Schematic editor/);
    assert.match(await page.locator('.hint').textContent(), /Right-click/);
    assert.equal(await page.locator('#wireTool').getAttribute('title'), 'Connect (C / W)');
    console.log(`PASS ${total} entries in ${libraries.length} separate manufacturer files, matching browser bundle, honest verification metadata, folder downloads and English UI`);

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
      // Keep the coil, all contact terminals and their pin text inside the complete symbol.
      const margins = await page.locator(`#parts > g[data-id="${relay.id}"]`).evaluate(root => {
        const box = root.querySelector('.relay-enclosure');
        const top = +box.getAttribute('y'), bottom = top + +box.getAttribute('height');
        return Array.from(root.querySelectorAll('.terminal'), n => Math.min(+n.getAttribute('cy') - top, bottom - +n.getAttribute('cy')));
      });
      assert.ok(margins.every(m => m >= 48), 'Relay terminal touches or extends beyond the frame');
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
    assert.match(listText, /Save device and project lists as CSV/); assert.match(listText, /= Function, \+ Location/);
    assert.doesNotMatch(listText, /Bezeichnung|Funktion|speichern|anzeigen/); await page.locator('#simpleClose').click();
    const pdf = await download('#exportBtn'); assert.match(pdf.toString('latin1', 0, 8), /^%PDF-1.4/);
    await fs.writeFile('/tmp/Cabel-Studio-manufacturers.pdf', pdf);
    await fs.writeFile('/tmp/Cabel-Studio-manufacturers.expected.json', JSON.stringify({ pages: (await save()).sheets.length }));
    await page.locator('.sheetItem[data-sheet-kind="drawing"]').first().click(); await page.screenshot({ path: '/tmp/Cabel-Studio-v1.37.2-manufacturers.png' });
    console.log('PASS catalogue drag/drop at zoom, ABB pole/contact geometry, mixed Phoenix terminal strip, Finder 1/2/3-contact assemblies, source metadata/SAP roundtrip, English lists and PDF');

    // The same library format can be imported; rejected files leave existing libraries intact.
    await page.locator('[data-library-mode="products"]').click();
    const custom = { schemaVersion: 1, id: 'example', manufacturer: 'Example <safe>', families: [{ id: 'motors', name: 'AC drives', products: [{ id: 'm1', model: 'M1 <prototype>', symbol: 'motor-ac-3p', manufacturerNumber: 'EX-001', verification: 'not-verified' }] }] };
    const importLibrary = data => page.locator('#catalogFile').setInputFiles({ name: 'example.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
    await importLibrary(custom); await page.waitForFunction(() => document.querySelector('#toast').textContent === 'Manufacturer library imported');
    for(const query of ['EX-*','*-001','*X-00*']){await page.locator('#catalogSearch').fill(query);assert.deepEqual(await page.locator('.catalog-part').evaluateAll(nodes=>nodes.map(n=>n.dataset.catalogProduct)),['example:m1'])}
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
    assert.equal(await page.locator('.manufacturer-library').count(), libraries.length + 1);
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
      assert.equal(await offline.locator('.manufacturer-library').count(), libraries.length);
      await offline.locator('[data-library-mode="products"]').click();
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
    await page.mouse.click(hiddenBridgePoint.x, hiddenBridgePoint.y); await page.locator('#propertiesBtn').click();
    assert.equal(await page.locator('#wireKind').inputValue(), 'bridge'); await page.locator('#simpleClose').click();
    await dragPart('p2002', 20 * GRID, 12 * GRID); await dragPart('p2004', 32 * GRID, 23 * GRID);
    for (const id of ['w2010', 'w2011']) assert.equal(await page.locator(`.wire-label[data-wire-label="${id}"]`).isVisible(), true);
    assert.match(await page.locator('.wire-label[data-wire-label="w2011"]').getAttribute('transform'), /rotate\(-90\)/);
    await assertAttached();
    await dragPart('p2002', 13 * GRID, 12 * GRID); await dragPart('p2004', 32 * GRID, 13 * GRID);
    const bridgeFile = await save(); await page.reload(); await load(bridgeFile);
    assert.equal(drawings(await save())[0].wires.length, 2);
    assert.equal(await page.locator('.wire-label[data-label-hidden="true"]').count(), 2); await assertAttached();

    // Check every S200 pole count, including the side of the fixed contact's breaker mark.
    await load({ title: 'S200 symbols', parts: [1, 2, 3, 4].map((n, i) => ({ id: 'p' + (4000 + n), type: 'mcb-' + n + 'p', deviceCode: 'Q' + n, label: 'Q' + n, value: 'S20' + n, x: (12 + 14 * i) * GRID, y: 18 * GRID })), wires: [] });
    for (const n of [1, 2, 3, 4]) {
      const root = page.locator(`#parts > g[data-id="p${4000 + n}"]`);
      assert.equal(await root.locator('.terminal').count(), 2 * n);
      const marks = await root.locator('.mcb-break-mark').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBBox(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      }));
      assert.equal(marks.length, n);
      for (let i = 0; i < n; i++) { assert.ok(marks[i].x > 0, 'Breaker mark must be on the right fixed contact'); near(marks[i].y, (2 * i - n + 1) * 48); }
    }
    await page.screenshot({ path: '/tmp/Cabel-Studio-v1.37.2-S200.png' });
    console.log('PASS S201/S202/S203/S204 breaker marks on the fixed-contact side and complete Finder 60.11/60.12/60.13 frames with terminal clearance');

    const selectAllFixture = { title: 'Selection', sheets: [{ id: 'selection-main', title: 'Current sheet', parts: [
      { id: 'p3001', type: 'resistor', deviceCode: 'R1', label: 'R1', x: 12 * GRID, y: 12 * GRID },
      { id: 'p3002', type: 'lamp', deviceCode: 'H1', label: 'H1', x: 30 * GRID, y: 12 * GRID },
      { id: 'p3003', type: 'switch', deviceCode: 'S1', label: 'S1', x: 14 * GRID, y: 24 * GRID },
      { id: 'p3004', type: 'resistor', deviceCode: 'R2', label: 'R2', x: 40 * GRID, y: 20 * GRID, unplaced: true },
      { id: 'p3005', type: 'text', label: 'Page note', x: 40 * GRID, y: 30 * GRID },
    ], wires: [{ id: 'w3010', a: 'p3001:1', b: 'p3002:0', colorCode: 'BK', points: [{ x: 20 * GRID, y: 12 * GRID }, { x: 20 * GRID, y: 18 * GRID }, { x: 29 * GRID, y: 18 * GRID }] }] },
    { id: 'selection-other', title: 'Other sheet', parts: [{ id: 'p3020', type: 'coil', label: 'K1', deviceCode: 'K1', x: 20 * GRID, y: 15 * GRID }], wires: [] }], activeSheet: 0 };
    await load(selectAllFixture);
    const originalSelectionFile = await save(), pink = 'rgb(255, 120, 183)';
    assert.equal(await page.locator('#selectTool').evaluate(n => getComputedStyle(n).color), pink);
    assert.equal(await page.locator('.sheetItem.active').evaluate(n => getComputedStyle(n).borderTopColor), pink);
    assert.equal(await page.locator('[data-overview="sheets"]').evaluate(n => getComputedStyle(n).color), pink);
    await page.locator('.wire-label[data-wire-label="w3010"] text').dblclick();
    assert.equal(await page.locator('#wireColor').inputValue(), 'BK'); await page.locator('#simpleClose').click();
    assert.equal(await page.locator('#wires .wire.selected').evaluate(n => getComputedStyle(n).stroke), pink);
    await page.locator('#wireTool').click(); assert.equal(await page.locator('#wireTool').evaluate(n => getComputedStyle(n).color), pink);
    await page.keyboard.press('Control+a');
    assert.equal(await page.locator('#parts > g.selected').count(), 4);
    assert.equal(await page.locator('#wires .wire.selected').count(), 1);
    assert.equal(await page.locator('#parts > g.selected .symbol').first().evaluate(n => getComputedStyle(n).stroke), pink);
    assert.equal(await page.locator('#parts > g[data-id="p3005"] .annotation-text').evaluate(n => getComputedStyle(n).fill), pink);
    assert.equal(await page.locator('#wires .wire.selected').evaluate(n => getComputedStyle(n).stroke), pink);
    assert.equal(await page.locator('#wireTool').evaluate(n => n.classList.contains('active')), false);
    assert.deepEqual(drawings(await save()), drawings(originalSelectionFile)); // selecting changes no document data
    await dragPart('p3001', 14 * GRID, 15 * GRID);
    const allMoved = await save();
    for (const p of drawings(allMoved)[0].parts) {
      const before = drawings(originalSelectionFile)[0].parts.find(q => q.id === p.id);
      near(p.x, before.x + (p.unplaced ? 0 : 2 * GRID)); near(p.y, before.y + (p.unplaced ? 0 : 3 * GRID));
    }
    assert.deepEqual(drawings(allMoved)[1], drawings(originalSelectionFile)[1]); await assertAttached();
    await page.locator('#parts > g[data-id="p3001"] .part-body').click({ button: 'right' });
    assert.match(await page.locator('#simpleContent h2').textContent(), /4 selected objects/);
    const batchInput = page.locator('#batchForm [name="manufacturerNumber"]'); await batchInput.fill('Native text selection'); await batchInput.focus(); await page.keyboard.press('Control+a');
    assert.deepEqual(await batchInput.evaluate(n => [n.selectionStart, n.selectionEnd]), [0, 'Native text selection'.length]);
    assert.equal(await page.locator('#parts > g.selected').count(), 4); await page.locator('#batchCancel').click();
    await page.keyboard.press('Delete');
    let selectionFile = await save();
    assert.ok(drawings(selectionFile)[0].parts.every(p => p.unplaced)); assert.equal(drawings(selectionFile)[0].wires.length, 0);
    assert.ok(!drawings(selectionFile)[0].parts.some(p => p.type === 'text'));
    assert.deepEqual(drawings(selectionFile)[1], drawings(originalSelectionFile)[1]);
    await page.keyboard.press('Control+z'); await assertAttached();
    assert.deepEqual(drawings(await save()), drawings(allMoved));
    await page.keyboard.press('Meta+a'); assert.equal(await page.locator('#parts > g.selected').count(), 4); assert.equal(await page.locator('#wires .wire.selected').count(), 1);
    const selectedPdf = await download('#exportBtn'); assert.match(selectedPdf.toString('latin1', 0, 8), /^%PDF-1.4/);
    assert.equal(await page.locator('#parts > g.selected').count(), 4); assert.equal(await page.locator('#wires .wire.selected').count(), 1);
    await fs.writeFile('/tmp/Cabel-Studio-selection.pdf', selectedPdf); await fs.writeFile('/tmp/Cabel-Studio-selection.expected.json', JSON.stringify({ pages: (await save()).sheets.length }));
    await page.screenshot({ path: '/tmp/Cabel-Studio-v1.37.2-selection.png' });
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#parts > g.selected').count(), 0); assert.equal(await page.locator('#wires .wire.selected').count(), 0);
    await page.locator('#catalogSearch').fill('ABB'); await page.keyboard.press('Control+a');
    assert.deepEqual(await page.locator('#catalogSearch').evaluate(n => [n.selectionStart, n.selectionEnd]), [0, 3]); assert.equal(await page.locator('#parts > g.selected').count(), 0);
    await page.locator('.sheetItem[data-sheet-kind="drawing"]').nth(1).click(); await page.keyboard.press('Control+a');
    assert.equal(await page.locator('#parts > g.selected').count(), 1); assert.equal(await page.locator('#parts > g.selected').getAttribute('data-id'), 'p3020');
    await page.locator('.sheetItem[data-sheet-kind="cover"]').click(); await page.keyboard.press('Control+a');
    assert.equal(await page.locator('#parts > g.selected').count(), 0); assert.equal(await page.locator('#wires .wire.selected').count(), 0);
    await load({ title: 'Empty sheet', parts: [], wires: [] }); await page.keyboard.press('Control+a');
    assert.equal(await page.locator('#parts > g.selected').count(), 0); assert.equal(await page.locator('#wires .wire.selected').count(), 0);
    // New hardware references expose real connection anchors and persist configurable port sides.
    await load({title:'Automation and controllers',parts:[],wires:[]});
    const supply=await placeProduct('phoenix-contact:quint4-24dc-5',10*GRID,14*GRID);
    const opto=await placeProduct('phoenix-contact:plc-osc-24dc-24dc-2',24*GRID,12*GRID);
    const io=await placeProduct('beckhoff:el1008',40*GRID,15*GRID);
    const pi=await placeProduct('raspberry-pi:pi-5',58*GRID,24*GRID);
    const esp=await placeProduct('generic-boards:esp32-d1-mini',12*GRID,30*GRID);
    const node=await placeProduct('joy-it:nodemcu-v2-lua',30*GRID,30*GRID);
    const fi=await placeProduct('abb:f204-40-030-a',48*GRID,34*GRID);
    for(const [p,n] of [[supply,12],[opto,4],[io,10],[pi,40],[esp,28],[node,17],[fi,8]]){
      assert.equal(await page.locator(`#parts > g[data-id="${p.id}"] .terminal`).count(),n);
      assert.equal(p.pinNumbers.length,n);
      const anchors=await page.locator(`#parts > g[data-id="${p.id}"] .terminal`).evaluateAll(nodes=>nodes.map(n=>{
        const p=new DOMPoint(+n.getAttribute('cx'),+n.getAttribute('cy')).matrixTransform(n.getScreenCTM()).matrixTransform(document.querySelector('#pageContent').getScreenCTM().inverse());return{x:p.x,y:p.y};
      }));
      for(const p of anchors){near(p.x/GRID,Math.round(p.x/GRID),1e-4);near(p.y/GRID,Math.round(p.y/GRID),1e-4)}
    }
    assert.deepEqual(supply.portSides,['left','left','left','right','right','right','right','right','right','left','right','right']);
    assert.ok(pi.pinNumbers.includes('40 GPIO21'));assert.ok(node.pinNumbers.includes('D1 / GPIO5'));
    await page.keyboard.press('c');await page.locator(`[data-part="${supply.id}"][data-term="3"]`).click();
    for(const [x,y] of [[20,8],[35,8]]){const p=await screen(x*GRID,y*GRID);await page.mouse.click(p.x,p.y)}
    await page.locator(`[data-part="${io.id}"][data-term="0"]`).click();await page.keyboard.press('Escape');await assertAttached();
    await dragPart(io.id,42*GRID,17*GRID);await page.locator(`#parts > g[data-id="${supply.id}"] .part-body`).click();await page.keyboard.press('r');await assertAttached();
    await page.locator(`#parts > g[data-id="${supply.id}"] .part-body`).click({button:'right'});
    assert.match(await page.locator('#componentForm').textContent(),/Functional AC\/DC ports/);
    await page.locator('#componentForm [name="pinNumbers"]').fill('L; N; PE');await page.locator('#componentForm [type="submit"]').click();
    assert.equal(await page.locator('#toast').textContent(),'Pins to be removed are still wired');await page.locator('#componentCancel').click();
    const automationFile=await save();await page.reload();await load(automationFile);await assertAttached();
    for(const p of [supply,opto,io,pi,esp,node,fi]){
      const stored=parts(await save()).find(q=>q.id===p.id);
      assert.deepEqual(stored.pinNumbers,p.pinNumbers);assert.deepEqual(stored.portSides,p.portSides);assert.deepEqual(stored.catalog,p.catalog);
    }
    await page.screenshot({path:'/tmp/Cabel-Studio-v1.37.2-automation.png'});
    console.log('PASS Phoenix supplies/optocouplers, Beckhoff I/O, Raspberry Pi, ESP32 D1 mini, Joy-it NodeMCU and FI/RCD: pin counts, 4 mm anchors, port sides, routes, movement/rotation and JSON');

    // Four approval stages appear on every document page and survive editing/export/reopening.
    const approvals={issuedName:'Alice Example',issuedDate:'2026-10-22',check1Name:'Bob Example',check1Date:'2026-10-23',check2Name:'Carol Example',check2Date:'2026-10-24',releaseName:'Dana Example',releaseDate:'2026-10-25'};
    await page.locator('#projectInfoBtn').click();
    for(const [key,value] of Object.entries(approvals))await page.locator(`#projectInfoForm [name="${key}"]`).fill(value);
    await page.locator('#projectInfoForm [type="submit"]').click();
    for(const stage of ['issued','check1','check2','release']){
      assert.equal(await page.locator(`#a4-${stage}-name`).textContent(),approvals[stage+'Name']);
      assert.equal(await page.locator(`#a4-${stage}-date`).textContent(),approvals[stage+'Date']);
    }
    const approvalFile=await save();for(const [key,value] of Object.entries(approvals))assert.equal(approvalFile.projectInfo[key],value);
    const keepCustom=structuredClone(approvalFile);keepCustom.projectInfo.customMetadata='Keep this value';await load(keepCustom);
    await page.locator('#projectInfoBtn').click();await page.locator('#projectInfoForm [type="submit"]').click();assert.equal((await save()).projectInfo.customMetadata,'Keep this value');
    const stagesBounds=await page.locator('#drawingTitleBlock').evaluate(g=>['issued','check1','check2','release'].map(stage=>{
      const a=g.querySelector('#a4-'+stage+'-name').getBBox(),b=g.querySelector('#a4-'+stage+'-date').getBBox();return{right:Math.max(a.x+a.width,b.x+b.width),bottom:Math.max(a.y+a.height,b.y+b.height)};
    }));
    for(let i=0;i<4;i++){assert.ok(stagesBounds[i].right<290+(i+1)*100);assert.ok(stagesBounds[i].bottom<=66)}
    await page.locator('[data-overview="sheets"]').click();
    for(const kind of ['cover','toc','device-list','terminal-list','drawing']){
      await page.locator(`.sheetItem[data-sheet-kind="${kind}"]`).first().click();
      for(const stage of ['issued','check1','check2','release'])assert.equal(await page.locator(`#a4-${stage}-name`).textContent(),approvals[stage+'Name']);
    }
    const approvalsPdf=await download('#exportBtn');await fs.writeFile('/tmp/Cabel-Studio-approvals.pdf',approvalsPdf);await fs.writeFile('/tmp/Cabel-Studio-approvals.expected.json',JSON.stringify({pages:(await save()).sheets.length}));
    await page.screenshot({path:'/tmp/Cabel-Studio-v1.37.2-approvals.png'});
    const finalApprovalFile=await save();await page.reload();await load(finalApprovalFile);
    for(const [key,value] of Object.entries(approvals))assert.equal((await save()).projectInfo[key],value);
    console.log('PASS Issued / Check 1 / Check 2 / Release names and ISO dates on all page types, fitted drawing-head cells, preserved custom metadata, JSON and full PDF');

    // Permanent deletion cascades through a master on all sheets; normal Delete still unplaces.
    const assembly={title:'Assembly deletion',sheets:[{id:'delete-main',title:'Assembly',parts:[
      {id:'p5000',type:'io-module',deviceCode:'A1',label:'A1',x:12*GRID,y:12*GRID,pinNumbers:['24V','0V','I1','I2'],portSides:['left','left','right','right']},
      {id:'p5001',type:'resistor',deviceCode:'R1',label:'R1',masterId:'p5000',x:30*GRID,y:12*GRID},
      {id:'p5002',type:'lamp',deviceCode:'H1',label:'H1',masterId:'p5001',x:40*GRID,y:12*GRID,unplaced:true},
      {id:'p5010',type:'coil',deviceCode:'K1',label:'K1',x:50*GRID,y:30*GRID},
      {id:'p5030',type:'reference',deviceCode:'Source1',label:'Source1',x:12*GRID,y:28*GRID,targetSheetId:'delete-other',targetPartId:'p5004'},
      ...Array.from({length:30},(_,i)=>({id:'p'+(5100+i),type:'lamp',deviceCode:'H'+(i+10),label:'H'+(i+10),masterId:'p5000',x:10*GRID,y:10*GRID,unplaced:true})),
    ],wires:[{id:'w5050',a:'p5001:1',b:'p5010:0',points:[]},{id:'w5051',a:'p5000:0',b:'p5010:1',points:[]}]},
    {id:'delete-other',title:'Slaves on another sheet',parts:[
      {id:'p5003',type:'lamp',deviceCode:'H2',label:'H2',masterId:'p5000',x:15*GRID,y:15*GRID},
      {id:'p5004',type:'diode',deviceCode:'D1',label:'D1',masterId:'p5003',x:40*GRID,y:15*GRID},
      {id:'p5020',type:'resistor',deviceCode:'R2',label:'R2',x:55*GRID,y:15*GRID},
    ],wires:[{id:'w5052',a:'p5004:1',b:'p5020:0',points:[]}]}],activeSheet:0};
    await load(assembly);await page.locator('[data-overview="sheets"]').click();
    assert.equal(await page.locator('.sheetItem[data-sheet-kind="device-list"]').count(),1);
    await page.locator('.sheetItem[data-sheet-kind="device-list"]').click();
    assert.deepEqual(await page.locator('.device-list-link').evaluateAll(nodes=>nodes.map(n=>n.dataset.partId)),['p5000','p5010','p5020']);
    await page.locator('.device-list-link[data-part-id="p5000"]').click();
    await page.locator('#parts > g[data-id="p5001"] .part-body').click();await page.keyboard.press('Delete');
    assert.equal(parts(await save()).find(p=>p.id==='p5001').unplaced,true);
    await page.keyboard.press('Control+z');await assertAttached();
    await page.locator('[data-overview="devices"]').click();assert.equal(await page.locator('.device-node[data-device-id="p5000"] .device-node').count(),34);
    const beforeRemoval=await save(),removeMaster=page.locator('.device-node[data-device-id="p5000"] > summary > .device-delete');
    page.once('dialog',d=>d.dismiss());await removeMaster.click();assert.deepEqual(drawings(await save()),drawings(beforeRemoval));
    page.once('dialog',async d=>{assert.match(d.message(),/34 sub-items/);await d.accept()});await removeMaster.click();
    let removed=await save();assert.deepEqual(parts(removed).map(p=>p.id).sort(),['p5010','p5020','p5030']);
    assert.deepEqual(drawings(removed).map(s=>s.wires.length),drawings(beforeRemoval).map(s=>s.wires.length));assert.deepEqual(drawings(removed).map(s=>s.looseEnds.length),[2,1]);assert.ok(drawings(removed).every(s=>s.wires.every(w=>[w.a,w.b].some(ref=>ref.startsWith('~')))));assert.equal(parts(removed).find(p=>p.id==='p5030').targetPartId,undefined);
    assert.equal(await page.locator('.device-node[data-device-id="p5000"]').count(),0);
    await page.keyboard.press('Control+z');assert.deepEqual(drawings(await save()),drawings(beforeRemoval));await assertAttached();
    await page.keyboard.press('Control+y');assert.deepEqual(parts(await save()).map(p=>p.id).sort(),['p5010','p5020','p5030']);
    const removedFile=await save();await page.reload();await load(removedFile);assert.deepEqual(parts(await save()).map(p=>p.id).sort(),['p5010','p5020','p5030']);
    // A placed independent device can also be deleted from its tree entry.
    await page.locator('[data-overview="devices"]').click();page.once('dialog',d=>d.accept());await page.locator('.device-node[data-device-id="p5010"] > summary > .device-delete').click();
    assert.ok(!parts(await save()).some(p=>p.id==='p5010'));
    console.log('PASS master-only directory/pagination with 34 slaves, full device tree, ordinary unplacement, permanent tree deletion, cancellation, cross-sheet descendants/reference cleanup and preserved wires/open ends, undo/redo and JSON');

    assert.deepEqual(errors, []);
    console.log('PASS fit-aware horizontal/vertical bridge labels, automatic reveal/hide after movement, persistent routes and no browser/asset errors');
    console.log('PASS pink active buttons/symbols/wires, Ctrl/Cmd+A for the current sheet, native input guards, group movement/edit/delete/undo, unplaced/other-sheet isolation, Escape and PDF selection restoration');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
