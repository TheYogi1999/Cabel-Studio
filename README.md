# Cabel-Studio / Leitwerk

A local browser schematic editor for A4 landscape drawings, written in HTML, CSS and JavaScript. The current application version is **1.18.0**, shown beside the application name and in the browser title.

## Run

Open `index.html` in a browser, or serve this directory with any static web server. The checked-in manufacturer bundle works with both HTTP and `file://`; there are no runtime dependencies or required build steps. Project files and exports are downloaded locally.

## Drawing and editing

The workspace keeps drawing tools, selection actions, undo/redo, sheet navigation and zoom in the top bar. **Library** and **Overview** toggle the side panels; on iPad and smaller displays they open as drawers over the drawing. Buttons and property fields use larger touch targets, and the layout follows portrait/landscape orientation and the browser's available height.

With a Pencil or other pen, choose a library entry and tap the drawing to place it. Drag symbols, wire sections, labels and Field handles with the pen. Connection terminals accept nearby pen/finger taps without moving their actual electrical anchors. Hold an object to open its properties, or select it and choose **Properties**. Mouse click placement, drag-and-drop, right-click and keyboard shortcuts continue to work.

Fingers pan the drawing by default; two fingers pan and pinch to zoom around their midpoint. Finger gestures do not change the project or add undo steps. Finger contacts are ignored while a pen is pressed on the drawing. **Touch edit** enables single-finger editing instead of finger navigation; **Pan** also lets you navigate with a mouse or pen. **Cancel** abandons a pending placement or drawing tool. **Full screen** uses the browser's fullscreen API when available; otherwise it opens a focus view with the panels and status bar hidden. Its exit button remains available, and Escape exits the fallback focus view.

- Choose **Generic** for dummy symbols or **Products** for manufacturer-specific components in the library. Expand a folder, then click a component to insert it or drag it onto the sheet. The shared search stays at the top of the sidebar and searches names, models and manufacturer/article numbers in the selected view. Without `*`, it finds any matching substring. Use `S201*` for a prefix, `*0074` for an ending, `*024*` for a middle section, or `60.*.024.*` for several unknown sections. Searches ignore case; other punctuation is literal. Symbols and terminals follow the 4 mm grid; hold **Alt** for a temporary 2 mm grid. Toggle grid visibility with **Grid**.
- Select **Connect**, click a terminal, choose intermediate grid points, and finish at another terminal. Routes are orthogonal. Moving a component stretches its attached sections and adjusts adjacent bends while leaving the rest of the route in place. Drag horizontal or vertical wire sections to move them perpendicular to their direction.
- Right-click a symbol, device-tree entry or terminal-list row to edit its properties. Equipment tags, values, AKS, pins and references each have a visibility switch beside the corresponding field. Equipment tag and displayed label use the same value. Text remains upright and unmirrored above the symbol, ordered AKS → equipment tag → value/type.
- Selected objects and active buttons are highlighted in pink. Press **Ctrl/⌘+A** to select all placed objects and visible connections on the current drawing sheet, or drag a rectangle over multiple objects to select them. Move, edit common properties, or delete the selection together. Deleting electrical devices from the drawing marks them **unplaced** in yellow in the device tree; placed devices appear in light blue. Click or drag a tree entry back onto a drawing to place it again. The **×** button in the device tree permanently deletes a device and its descendants across all drawing sheets after confirmation, including attached connections and stale references. Undo restores the whole operation; deleting from the drawing still only unplaces a device.
- Switch the right sidebar between sheets and devices. AKS fields use dots for nested folders, for example `+TU001.01`. Ctrl/⌘-click a symbol or terminal to reveal its device-tree position.
- Edit manufacturer numbers, SAP numbers, pin names and master/slave relationships in properties. Device lists include article numbers and links back to symbols. Slaves can be placed independently.

Generic symbols include passive components, diodes/LEDs, NO/NC/changeover contacts, relays, optocouplers, AC/DC power supplies, I/O modules, controller boards, 2-/4-pole RCDs (FI) and motors. AC motors are available as single-phase **L/N/PE**, three-phase **U1/V1/W1/PE**, and six-lead **U1/V1/W1/U2/V2/W2/PE** variants.

## Page properties and AKS fields

Use **Page properties** for the current drawing sheet, or right-click the blank sheet background or a drawing in the sheet overview to edit its title and optional **Function (=)** / **Location (+)** AKS context. The page context is printed near the top of the sheet. **Hide matching AKS aspects on symbols** suppresses only matching aspects; differing aspects remain visible. When both match, the AKS caption disappears and the equipment tag stays visible. Complete identifiers remain in properties, the device tree and project lists. Individual text-visibility switches still apply.

Choose **AKS field**, then drag a rectangle and assign its title and AKS. Fields align to the drawing grid. In Select mode, drag a field's border or heading to move it, or drag one of its eight corner/edge handles to resize it; the opposite edge stays anchored. Hold **Alt** for 2 mm steps. Fields stay inside the drawing, with a minimum size of one current grid step. Components and connections stay in place, and matching AKS captions update as the field moves or changes size. Undo/redo restores a move or resize as one step; Esc cancels it. Dimensions can also be entered in properties. Field headings stay inside their rectangle, with long headings shortened to fit and their full text available on hover.

Right-click anywhere inside a field, on its border or heading to edit its properties, or use its **Edit** action in Page properties. Symbols inside fields retain their own right-click properties. Smaller overlapping fields take precedence for their assigned aspects and inherit unspecified aspects from enclosing fields/the page. Delete a field in Page properties; Undo restores it. Property dialogs stay open when clicking outside them; use **Apply**, **Cancel**, **Close** or **Esc** to finish.

New components inherit the function/location at their placement point. Existing identifiers stay unchanged by default. Check **Assign to existing components in this context** to explicitly apply assigned aspects to existing components on the page or inside the rectangle; linked slaves continue to follow their master. Moving a component into/out of a field changes its displayed caption without renaming it. Cancel/Esc discards an unfinished field.

Page contexts and rectangles retain the optional `aks` and `aksAreas` keys on drawing sheets. They are preserved by save/open, undo/redo and PDF export. Old projects without these keys keep their explicit AKS captions.

## Symbol proposals

Open **Custom symbol proposals → Open symbol editor**, or open [`symbol-editor.html`](symbol-editor.html) directly. This separate local editor supports lines, rectangles, circles, text, named terminals, selection/movement, exact numeric properties, deletion and undo/redo. Geometry uses a selectable 1/2/4 mm drawing grid; terminals always use the 4 mm grid. Canvas dimensions are editable, and a local browser draft is retained.

**Download JSON** saves an editable `.cabel-symbol.json` proposal that can be shared for review. **Download SVG** creates a preview; schematic export in the main app remains PDF. **Open JSON** reopens proposals. In the main app, **Import symbol JSON** adds a click/drag-placeable library entry. Placed symbols retain their definition in the project, so reopening does not require reimporting the library. Their terminals support ordinary routing, rotation and reflection; text stays readable. Properties can download a placed symbol's original proposal again.

The shared format in [`scripts/symbol-format.js`](scripts/symbol-format.js) uses `kind: "cabel-symbol"`, `schemaVersion: 1`, `units: "mm"`, a stable ID/name/group/equipment prefix, canvas dimensions, structured `geometry` primitives and `terminals`. Coordinates are relative to the symbol origin. Imports validate known shapes, finite dimensions, unique terminal names and 4 mm terminal positions; raw SVG/HTML/scripts are not imported. Geometry text remains literal text. Limits are 256 shapes and 64 terminals.

## Terminals, relays and cross-references

**Create terminal strip** adds a master and its terminals. Use the strip's **+** action to add a terminal, or a terminal's **×** action to remove it permanently. A strip can contain different terminal types. Individual pins, whole terminals and the strip master can be placed separately. Pins retain the strip equipment tag, for example **X1 :1a**. A terminal's pins and its dedicated brown bridge port lie on one line.

**Terminal bridge** creates a thicker brown connection within one strip. Bridges appear graphically in terminal lists. Bridge text is hidden when its straight section has insufficient room, and reappears when the section becomes long enough. The bridge and its connection data remain intact; select its line and use **Wire properties** to edit it when the text is hidden. Other conductor labels retain their white background and align automatically with the horizontal or vertical section on the grid.

Relays provide a vertical complete symbol, a rectangular coil and independently placeable contact slaves. Generic relays have three changeover contacts; manufacturer family templates can have one, two or three. Links on the complete symbol open/place the sub-symbols, and sub-symbol references return to the complete symbol. All share its equipment tag.

Placed separate terminal pins leave the main symbol's terminals available. Reciprocal live references use **/0003.A3** notation throughout the application. Source and destination arrows can be paired in properties. Click a reference or press **J** to jump to its target. Stacked terminals of the same strip suppress repeated AKS/equipment tags; the terminal type repeats at the top of a stack and at each type change.

## Manufacturer libraries

Each manufacturer's editable source is a separate JSON file:

| File | Included reference entries |
| --- | --- |
| [`libraries/abb.json`](libraries/abb.json) | 148: common S201–S204 B/C/D 6–63 A combinations, S200 accessories/busbars, AF four-pole contactors and F202/F204 RCD references |
| [`libraries/phoenix-contact.json`](libraries/phoenix-contact.json) | 65: ST terminals/accessories, UNO/TRIO/QUINT 24 V power supplies and a PLC optocoupler interface |
| [`libraries/beckhoff.json`](libraries/beckhoff.json) | 7: EK1100, EL1008/EL2008, EL1809/EL2809, EL3062 and EL4002 logical module references |
| [`libraries/raspberry-pi.json`](libraries/raspberry-pi.json) | 2: Raspberry Pi 4 Model B and Pi 5 with 40 GPIO-header anchors |
| [`libraries/generic-boards.json`](libraries/generic-boards.json) | 1: ESP32 D1 mini logical GPIO template; board vendor/variant unspecified |
| [`libraries/joy-it.json`](libraries/joy-it.json) | 1: Joy-it NodeMCU V2 LUA / ESP8266 WiFi logical port template |
| [`libraries/finder.json`](libraries/finder.json) | 4: Series 60.11 / 60.12 / 60.13 templates and the supplied **60.13.9.024.0074**, with a 24 V DC coil and three changeover contacts |

**These are reference libraries, not verified complete manufacturer catalogues.** Manufacturer websites were blocked by the cloud outbound policy during implementation. Source URLs, incomplete coverage and verification status are recorded in the files and shown in the library UI. Variant availability, coil suffixes, ratings, physical pin diagrams and accessory compatibility require manufacturer confirmation. Power-supply entries now include family-specific functional templates: duplicate DC outputs on UNO, DC OK contacts on TRIO, and additional configurable signal IN/OUT ports on QUINT4. These do not claim verified physical terminal designations for every variant. Unknown ordering numbers remain blank; only the user-specified Finder article has its exact manufacturer number filled in. SAP numbers remain project-specific.

Choose **Products**, expand **Manufacturer libraries** or search by manufacturer/model/article number, then click or drag a product onto the drawing. Placed entries retain manufacturer, model, attributes, source URLs and verification status in the project. Phoenix terminals are added to the selected terminal/strip's master; otherwise a new unplaced strip master is created. Finder family templates create the appropriate number of contact slaves. Relay sub-symbols appear in the device tree but do not duplicate the purchased assembly in the bill of materials.

Power supplies, I/O modules and controller boards have editable port names and up to 64 grid-aligned anchors. Optional `portSides` keeps input/output ports on the chosen sides. The power-supply drawing uses an AC/DC divider, AC wave and DC mark fitted to its enclosure. For an older placed supply, use **Add missing outputs / signals** in properties and then **Apply** to append template ports while preserving existing terminal indices. Port sides are editable as one L/R value per pin. New generic symbols provide sensible defaults; catalogue entries retain their configured ports. Wired ports cannot be removed in properties. These are functional schematic representations: Beckhoff bus/channel ports and ESP32/NodeMCU ports do not claim to reproduce physical connector counts or header layouts. Port-mapping notes appear in properties.

Each folder can download its JSON source. **Import manufacturer library** accepts the same format and replaces a library with the same ID for the current browser session. Imported libraries do not modify the repository; placed components retain their data after saving and reopening even without that library being loaded.

To update bundled entries, edit the appropriate JSON source and rebuild the deterministic offline bundle:

```sh
node scripts/build-libraries.cjs
node scripts/build-libraries.cjs --check
```

Library format: `schemaVersion: 1`, a stable `id`, `manufacturer`, `coverage`, `sources` and `families`. Each family contains `id`, `name`, optional `scope`, and `products`. Products have stable `id`, `model`, `symbol`, optional `name`, `manufacturerNumber`, `pinNumbers`, `portSides`, `attributes` and `verification`. Relay entries may specify `relayContactCount` and `coilValue`; terminal entries may specify `terminalType`. Imports validate IDs, known symbol types and terminal/relay counts. The checked-in `libraries/catalog.js` is generated from the manufacturer JSON source files; do not edit it directly.

## Documents and project files

The document automatically maintains a cover, table of contents, drawing sheets, device lists and terminal lists. Generated device-directory pages include only top-level masters (including independent devices); their slaves remain in the device overview, detailed **Lists** tables/CSV and terminal lists. A missing parent makes a device an independent entry. Each terminal strip starts a new list page. Page numbers always use four digits and appear separately from the sheet title. New drawings default to **Schematic**; automatic sheet titles do not contain page numbers. Existing user-entered titles stay unchanged. The drawing head has a prominent **Sheet title** cell and four compact approval cells for **Issued**, **Check 1**, **Check 2** and **Release**, each with a name and date on every page. Edit document metadata with **Project information** and sheet titles with **Page properties**. Dates entered in the approval fields use `YYYY-MM-DD`. Issued falls back to the older Drawn by/Date fields when blank. The optional metadata keys are `issuedName`/`issuedDate`, `check1Name`/`check1Date`, `check2Name`/`check2Date`, and `releaseName`/`releaseDate`. **Lists** opens live tables and CSV download. **Export PDF** downloads the complete document as an A4 landscape PDF, independently of screen zoom/pan, and restores the current view afterward.

**Save** saves JSON and **Open** reloads it. Projects retain `appVersion`, metadata, sheets, parts, wire endpoints (`a` / `b`), ordered route `points: [{x,y}]`, labels, transformations, placement state, hierarchy and references. Manufacturer products add a `manufacturer` and `catalog` object to the existing part format; normal `manufacturerNumber`, `sapNumber`, `pinNumbers`, `masterId`, `terminalType` and `value` fields remain editable. Existing projects without these optional fields remain readable. User-entered text is preserved as entered; the application UI, generated headings and default text are English.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| V | Select |
| C / W | Connect terminals through grid points |
| R | Rotate selected object by 90° |
| X / Y | Mirror selected object horizontally / vertically |
| T | Insert text |
| J | Jump to a reference target or choose a sheet |
| Page Up / Page Down | Previous / next sheet |
| Hold Alt | Temporary 2 mm grid |
| Ctrl/⌘+A | Select all placed objects and visible connections on the current drawing sheet |
| Ctrl/⌘+C / X / V | Copy / cut / paste selected object |
| Ctrl/⌘+Z | Undo |
| Ctrl/⌘+Y or Ctrl/⌘+Shift+Z | Redo |
| Delete / Backspace | Unplace electrical devices or delete text/references/connections |
| Esc | Cancel the current operation or dialog |
| Ctrl/⌘ + mouse wheel | Zoom |
| Middle-button drag | Pan the sheet |

Shortcuts leave normal text editing intact while an input or dialog is active.

## Checks

Node.js, the `playwright` module and Chromium are required for browser checks. Chromium defaults to `/usr/bin/chromium`; override it with `CHROMIUM_PATH` if necessary. Each check starts a temporary local server and closes it and the browser afterward.

```sh
node scripts/build-libraries.cjs --check
node tests/browser-smoke.cjs
node tests/manufacturer-smoke.cjs
node tests/symbol-page-smoke.cjs
node tests/tablet-input-smoke.cjs
```

The main smoke check covers placement, editing, routing and segment movement, transformations, clipboard, history, multi-selection, device hierarchy, terminals/bridges, relays, cross-references, grids, generated lists, JSON roundtrips and PDF export. The manufacturer check additionally covers the JSON/bundle agreement, new hardware ports/routes, permanent deletion across sheets and undo/redo, master-only pagination, approval names/dates, all AC motor variants, product drag/drop at zoom, ABB pole/contact geometry, mixed Phoenix terminals, Finder contact counts, metadata persistence, library download/import validation, Generic/Products switching, wildcard name/number searches, offline file opening, English output, fit-aware bridge labels, pink selection, current-sheet Ctrl/⌘+A, S200 fixed-contact markings and relay-frame clearance. The symbol/page check covers the separate editor, proposal validation/placement/serialization, upright custom text, legacy supply-port upgrades and routes, page/field AKS precedence, explicit assignment, hiding, field movement/resizing on both grids, drawing bounds, single-step history, cancellation, context menus, headings inside fields, modal backdrop persistence, JSON roundtrips and PDF output. Screenshots and PDFs are written under `/tmp`, outside the repository. The `file://` check is explicitly skipped if Chromium administrator policy blocks local-file navigation; HTTP checks still run.

The tablet check uses Chromium with an iPad viewport, touch emulation and browser pen Pointer Events. It covers tap placement, pen dragging/connection targeting/Field resizing, finger pan and anchored pinch, concurrent-touch suppression, cancelled pen gestures, toolbar undo/redo, properties without right-click, both orientations, fullscreen/focus fallback, separate sheet titles/numbers, JSON roundtrips and PDF. This is browser emulation, not a physical iPad/Safari or Apple Pencil hardware test.
