# Cabel-Studio / Leitwerk

A local browser schematic editor for A4 landscape drawings, written in HTML, CSS and JavaScript. The current application version is **1.14.1**, shown beside the application name and in the browser title.

## Run

Open `index.html` in a browser, or serve this directory with any static web server. The checked-in manufacturer bundle works with both HTTP and `file://`; there are no runtime dependencies or required build steps. Project files and exports are downloaded locally.

## Drawing and editing

- Expand a component folder, then click a symbol to insert it or drag it onto the sheet. Symbols and terminals follow the 4 mm grid; hold **Alt** for a temporary 2 mm grid. Toggle grid visibility with **Grid**.
- Select **Connect**, click a terminal, choose intermediate grid points, and finish at another terminal. Routes are orthogonal. Moving a component stretches its attached sections and adjusts adjacent bends while leaving the rest of the route in place. Drag horizontal or vertical wire sections to move them perpendicular to their direction.
- Right-click a symbol, device-tree entry or terminal-list row to edit its properties. Equipment tags, values, AKS, pins and references each have a visibility switch beside the corresponding field. Equipment tag and displayed label use the same value. Text remains upright and unmirrored above the symbol, ordered AKS → equipment tag → value/type.
- Selected objects and active buttons are highlighted in pink. Press **Ctrl/⌘+A** to select all placed objects and visible connections on the current drawing sheet, or drag a rectangle over multiple objects to select them. Move, edit common properties, or delete the selection together. Deleting electrical devices from the drawing marks them **unplaced** in yellow in the device tree; placed devices appear in light blue. Click or drag a tree entry back onto a drawing to place it again.
- Switch the right sidebar between sheets and devices. AKS fields use dots for nested folders, for example `+TU001.01`. Ctrl/⌘-click a symbol or terminal to reveal its device-tree position.
- Edit manufacturer numbers, SAP numbers, pin names and master/slave relationships in properties. Device lists include article numbers and links back to symbols. Slaves can be placed independently.

Generic symbols include passive components, diodes/LEDs, NO/NC/changeover contacts, relays and motors. AC motors are available as single-phase **L/N/PE**, three-phase **U1/V1/W1/PE**, and six-lead **U1/V1/W1/U2/V2/W2/PE** variants.

## Terminals, relays and cross-references

**Create terminal strip** adds a master and its terminals. Use the strip's **+** action to add a terminal, or a terminal's **×** action to remove it permanently. A strip can contain different terminal types. Individual pins, whole terminals and the strip master can be placed separately. Pins retain the strip equipment tag, for example **X1 :1a**. A terminal's pins and its dedicated brown bridge port lie on one line.

**Terminal bridge** creates a thicker brown connection within one strip. Bridges appear graphically in terminal lists. Bridge text is hidden when its straight section has insufficient room, and reappears when the section becomes long enough. The bridge and its connection data remain intact; select its line and use **Wire properties** to edit it when the text is hidden. Other conductor labels retain their white background and align automatically with the horizontal or vertical section on the grid.

Relays provide a vertical complete symbol, a rectangular coil and independently placeable contact slaves. Generic relays have three changeover contacts; manufacturer family templates can have one, two or three. Links on the complete symbol open/place the sub-symbols, and sub-symbol references return to the complete symbol. All share its equipment tag.

Placed separate terminal pins leave the main symbol's terminals available. Reciprocal live references use **/0003.A3** notation throughout the application. Source and destination arrows can be paired in properties. Click a reference or press **J** to jump to its target. Stacked terminals of the same strip suppress repeated AKS/equipment tags; the terminal type repeats at the top of a stack and at each type change.

## Manufacturer libraries

Each manufacturer's editable source is a separate JSON file:

| File | Included reference entries |
| --- | --- |
| [`libraries/abb.json`](libraries/abb.json) | 142: common S201–S204 B/C/D 6–63 A combinations, S200 accessories and busbars, AF four-pole 4NO / 2NO2NC frame templates |
| [`libraries/phoenix-contact.json`](libraries/phoenix-contact.json) | 58: ST feed-through/neutral/PE, STTB/TWIN/QUATTRO, disconnect/fuse terminals and accessories |
| [`libraries/finder.json`](libraries/finder.json) | 4: Series 60.11 / 60.12 / 60.13 templates and the supplied **60.13.9.024.0074**, with a 24 V DC coil and three changeover contacts |

**These are reference libraries, not verified complete manufacturer catalogues.** Manufacturer websites were blocked by the cloud outbound policy during implementation. Source URLs, incomplete coverage and verification status are recorded in the files and shown in the library UI. Variant availability, coil suffixes, ratings, physical pin diagrams and accessory compatibility require manufacturer confirmation. Unknown ordering numbers remain blank; only the user-specified Finder article has its exact manufacturer number filled in. SAP numbers remain project-specific.

Expand **Manufacturer libraries** or search by manufacturer/model, then click or drag a product onto the drawing. Placed entries retain manufacturer, model, attributes, source URLs and verification status in the project. Phoenix terminals are added to the selected terminal/strip's master; otherwise a new unplaced strip master is created. Finder family templates create the appropriate number of contact slaves. Relay sub-symbols appear in the device tree but do not duplicate the purchased assembly in the bill of materials.

Each folder can download its JSON source. **Import manufacturer library** accepts the same format and replaces a library with the same ID for the current browser session. Imported libraries do not modify the repository; placed components retain their data after saving and reopening even without that library being loaded.

To update bundled entries, edit the appropriate JSON source and rebuild the deterministic offline bundle:

```sh
node scripts/build-libraries.cjs
node scripts/build-libraries.cjs --check
```

Library format: `schemaVersion: 1`, a stable `id`, `manufacturer`, `coverage`, `sources` and `families`. Each family contains `id`, `name`, optional `scope`, and `products`. Products have stable `id`, `model`, `symbol`, optional `name`, `manufacturerNumber`, `pinNumbers`, `attributes` and `verification`. Relay entries may specify `relayContactCount` and `coilValue`; terminal entries may specify `terminalType`. Imports validate IDs, known symbol types and terminal/relay counts. The checked-in `libraries/catalog.js` is generated from the three source files; do not edit it directly.

## Documents and project files

The document automatically maintains a cover, table of contents, drawing sheets, device lists and terminal lists. Each terminal strip starts a new list page. Page numbers always use four digits. Edit document metadata with **Project information**. **Lists** opens live tables and CSV download. **Export PDF** downloads the complete document as an A4 landscape PDF, independently of screen zoom/pan, and restores the current view afterward.

**Project** saves JSON and **Open** reloads it. Projects retain `appVersion`, metadata, sheets, parts, wire endpoints (`a` / `b`), ordered route `points: [{x,y}]`, labels, transformations, placement state, hierarchy and references. Manufacturer products add a `manufacturer` and `catalog` object to the existing part format; normal `manufacturerNumber`, `sapNumber`, `pinNumbers`, `masterId`, `terminalType` and `value` fields remain editable. Existing projects without these optional fields remain readable. User-entered text is preserved as entered; the application UI, generated headings and default text are English.

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
```

The main smoke check covers placement, editing, routing and segment movement, transformations, clipboard, history, multi-selection, device hierarchy, terminals/bridges, relays, cross-references, grids, generated lists, JSON roundtrips and PDF export. The manufacturer check additionally covers the JSON/bundle agreement, all AC motor variants, product drag/drop at zoom, ABB pole/contact geometry, mixed Phoenix terminals, Finder contact counts, metadata persistence, library download/import validation, offline file opening, English output, fit-aware bridge labels, pink selection, current-sheet Ctrl/⌘+A, S200 fixed-contact markings and relay-frame clearance. Screenshots and PDFs are written under `/tmp`, outside the repository. The `file://` check is explicitly skipped if Chromium administrator policy blocks local-file navigation; HTTP checks still run.
