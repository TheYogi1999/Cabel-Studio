# Cabel-Studio / Leitwerk

A local browser schematic editor for A4 landscape drawings, written in HTML, CSS and JavaScript. The current application version is **1.28.1**, shown beside the application name and in the browser title.

[Open Leitwerk in your browser](https://theyogi1999.github.io/Cabel-Studio/) · [Symbol editor](https://theyogi1999.github.io/Cabel-Studio/symbol-editor.html)

The interface and generated document headings are English. The app runs entirely in the browser; save your project as JSON to keep an editable copy.

- [Run and quick start](#run-and-quick-start)
- [Drawing and editing](#drawing-and-editing)
- [Selecting connections and line segments](#selecting-connections-and-line-segments)
- [Library and terminal type selection](#compact-library-and-terminal-type-selection)
- [Manufacturer references](#manufacturer-libraries)
- [Documents and project files](#documents-and-project-files)
- [Shortcuts](#shortcuts)
- [Project layout](#project-layout)
- [Checks](#checks)

## Run and quick start

Open `index.html` in a browser, or serve this directory with any static web server. The checked-in manufacturer bundle works with both HTTP and `file://`; there are no runtime dependencies or required build steps. Project files and exports are downloaded locally.

For a local HTTP server, run this in the project directory and open <http://localhost:8080>:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

1. Choose **Generic** or **Products** in the left library. Search or expand a group, then click or drag a component onto a drawing sheet.
2. Use **Connect** to join ports. It automatically selects wire, bridge or fiber from the starting port. Use **Select** to edit objects and line segments.
3. Use **Sheets**, **Devices** and **Cables** in the right overview to manage the project. Add drawings with **+** in Sheets; edit titles and numbers with **Page properties**.
4. Use **Project info** for document metadata, **Lists** for generated tables/CSV, **Save** for editable JSON, and **Export PDF** for the complete document.

On iPad, entries can be dragged with a finger/Pencil or tapped and then placed on the paper. Two fingers pan/zoom in every tool. For an app-style window, launch the site through **Safari → Share → Add to Home Screen**. Detailed touch and fullscreen behaviour is described below.

## Drawing and editing

The top bar keeps drawing tools, selection actions and undo/redo. **Project info** and **Lists** sit to the left of **Save** in the top row; **Page properties** and **Grid** stay in the editing toolbar. Compact previous/current/next sheet controls float at the top centre of the drawing, while zoom out, the percentage, zoom in and fit/centre float at the bottom right. Add a sheet with **+** in the sheet overview heading. The compact sheet overview shows only four-digit numbers and names. The component library and sheet/device overview stay visible beside the drawing on iPad and desktop, including portrait orientation and full screen. Buttons and property fields use larger touch targets. Mirror and fit buttons use SVG icons.

With a finger or Pencil, drag components from the generic/product libraries or device overview onto the paper. Start sideways to drag immediately; hold briefly before a vertical drag so vertical library scrolling still works. A preview follows the contact and an invalid/outside drop changes nothing. You can also tap a library entry and then tap the paper. In **Select**, drag a symbol, wire section, label or Field handle to edit it directly. Hold an object to open its properties, or choose **Properties**. There is no separate Touch edit switch. Mouse click placement, HTML drag-and-drop, right-click, blank-paper area selection and keyboard shortcuts continue to work.

**Select** uses an empty-paper drag for a selection box, including with a finger or Pencil. **Connect** uses taps for terminals and route points; dragging does not automatically pan. Choose **Pan** to move the view with one finger, Pencil or mouse, including when starting on a component. Two fingers pan and zoom in every tool around their midpoint; an unfinished finger edit is cancelled before navigation begins. Navigation does not change the project or add undo steps. Zoom buttons and Ctrl/⌘+wheel preserve the position under the view centre/cursor. Finger contacts on the paper are ignored while a Pencil gesture is active. **Cancel** abandons a pending placement or drawing tool.

**Red pen** keeps its name and opens a separate annotation mode with its own tool row. **Draw** uses the red pen; **Yellow**, **Blue** and **Green** use broad transparent highlighters (16 drawing units wide, versus 2 for the red pen). Each colour has its own layer. **Layers** shows visibility controls; hidden layers are excluded from selection, whole-stroke erasing and PDF output. Choosing a colour shows its layer again. Visibility is a workspace view setting, while JSON always retains every stroke. **Draw** creates a freehand red stroke per gesture, without snapping, using a finger, Pencil or mouse. **Erase stroke** removes each whole stroke touched or crossed by the eraser. **Select strokes** selects visible strokes by tap or selection box; drag a selected stroke to move the selection, or drag a corner to scale it uniformly. **Smaller** and **Larger** scale selected strokes to 80% and 125%; **Delete strokes** removes the selection. Ctrl/⌘+A selects all visible strokes in this mode. Drawing, erasing, moving and scaling each undo as one gesture. Esc cancels an unfinished gesture; otherwise it exits Red pen. Starting two-finger navigation cancels an unfinished finger mark or erasure. Annotations belong to drawing sheets and leave electrical objects alone; select **Select**, **Connect**, **Pan** or **Red pen** again to leave the mode.

**Full screen** uses the browser's fullscreen API when available and keeps both side panels visible. **Exit…** asks before leaving. The drawing view refreshes after fullscreen and viewport size changes while keeping its zoom and position. Safari zoom gestures on the paper are handled inside the editor. If the browser nevertheless exits native fullscreen, the focus view, drawing position and document remain in place; **Resume full screen** re-enters with a fresh tap. Browser/iPadOS system gestures cannot be locked by a web page. For a stable iPad app window without Safari's fullscreen controls, use **Safari → Share → Add to Home Screen**, then launch Leitwerk from that icon. The checked-in manifest and Apple icon enable standalone display; this does not add offline caching.

- Choose **Generic** for dummy symbols or **Products** for manufacturer-specific components in the library. Expand a folder, then click a component to insert it or drag it onto the sheet. The shared search stays at the top of the sidebar and searches names, models and manufacturer/article numbers in the selected view. Without `*`, it finds any matching substring. Use `S201*` for a prefix, `*0074` for an ending, `*024*` for a middle section, or `60.*.024.*` for several unknown sections. Searches ignore case; other punctuation is literal. Symbols and terminals follow the 4 mm grid; hold **Alt** for a temporary 2 mm grid. Toggle grid visibility with **Grid**.
- Select **Connect**, click/tap a terminal or existing connection, choose intermediate grid points, and finish at another terminal or connection. The same button changes to **Wire** at normal terminals, **Fiber** at orange optical ports or **Bridge** at brown bridge ports/existing bridges. Bridge ports connect only to bridge ports in the same terminal strip; ordinary ports create conductors. Routes are orthogonal by default. Hold **Shift** while choosing a point, or enable **45°** beside Connect on a tablet, to draw diagonally with an axis-aligned remainder when needed to reach the exact target. Moving a component stretches its attached sections and adjusts adjacent bends while leaving the rest of the route in place. Drag wire sections perpendicular to their direction, including diagonal sections.
- Right-click a symbol, device-tree entry or terminal-list row to edit its properties. Device Designations, values, AKS, pins and references each have a visibility switch beside the corresponding field. Device Designation and displayed label use the same value. Text remains upright and unmirrored above the symbol, ordered AKS → Device Designation → device type/electrical value.
- Selected objects and active buttons are highlighted in pink. Press **Ctrl/⌘+A** to select all placed objects and visible connections on the current drawing sheet, or drag a rectangle over multiple objects to select them. Move, edit common properties, or delete the selection together. Deleting electrical devices from the drawing marks them **unplaced** in yellow in the device tree; placed devices appear in light blue. Click or drag a tree entry back onto a drawing to place it again. The **×** button in the device tree permanently deletes a device and its descendants across all drawing sheets after confirmation, clearing stale references and retaining attached connections as open ends. Undo restores the whole operation; deleting from the drawing still only unplaces a device.
- Switch the right sidebar between **Sheets**, **Devices** and **Cables**. AKS fields use dots for nested folders, for example `+TU001.01`. Ctrl/⌘-click symbols in Select to add or remove them individually **and** reveal the clicked device/pin in Devices. Revealing does not replace the drawing selection. Ctrl+Alt-click (Command+Option-click) remains a reveal-only shortcut.
- Edit manufacturer numbers, SAP numbers, pin names and master/slave relationships in properties. Device lists include article numbers and links back to symbols. Slaves can be placed independently.

## Component properties and device overview

**Edit component** uses **Function (=)**, **Location (+)**, **Device Designation (-)**, **Value**, **Device Type**, **Manufacturer number**, **SAP number**, **Pin numbers**, **Reference target (object)** and **Master / parent component**. **Terminal number** appears only for terminals. The duplicate terminal-strip field is removed: a terminal uses its strip master's Device Designation. Edit that designation on the master; a terminal retains its own ordinal and pin identifiers.

**Device Type** identifies the model/type independently of **Value**, which stores electrical characteristics such as voltage, current or resistance. New catalogue placements derive known values from the reference data; missing characteristics remain blank. The original JSON geometry discriminator `type` is unchanged; the displayed model/type is stored in `deviceType`, electrical data in `value`. Terminals also keep their internal `terminalType` for terminal-specific behaviour. Lists, BOM grouping, captions and PDFs use the separate type/value fields.

Pin names use **semicolons**, for example `13; 14; X1; X2`. Ordered port-side/media lists use the same separator in properties; JSON still stores arrays. Terminal type selection prepares the matching electrical value and manufacturer number along with its pins. SAP numbers are project-specific material identifiers and are never inferred from catalogue data. A new material starts with a blank SAP number; changing Device Type or Manufacturer number clears the previous material's SAP number unless a new one is entered explicitly. Cancelling retains the original data.

The device overview shows each device's icon and **Device Designation**, with Function and Location in the enclosing AKS folders. Terminal/pin identifiers remain visible where needed to distinguish them. Only the identity button is yellow for unplaced devices or light blue for placed devices; expandable containers stay neutral. A tooltip retains the complete AKS identifier.

Manufacturer-backed additions include [Phoenix ST 2,5](https://www.phoenixcontact.com/en-us/products/feed-through-terminal-block-st-25-3031212): **3031212**, nominal **800 V / 24 A**; and the [ABB S201-C16 catalogue entry](https://library.e.abb.com/public/e1feaf53e4b99c8ac1257e36003719a4/Modular%20DIN%20Comps%20MCB%20RCB%20Meters%20Surge%209AKK106354A1400.pdf): **2CDS251001R0164**, **16 A**. The ABB source is a historical catalogue and does not establish current availability.

## Selecting connections and line segments

In **Select**, a single click selects one straight line segment. A selection rectangle includes fully enclosed individual legs even when the rest of that connection lies outside. Ctrl/Command-click adds or removes individual segments, including several legs of the same connection. Drag the selected segments to offset them together while their terminal endpoints remain attached; Escape cancels, and Undo restores the complete gesture. Double-click (double-tap with a finger/Pencil) selects every section of the same logical connection across junctions; other branches remain separate. Selection itself changes no JSON or history and is hidden from PDF export. Whole-connection deletion requires selecting the whole connection. Ctrl+Alt-click a cable route, or Ctrl-click its caption, still reveals the assigned cable.

## Compact library and terminal type selection

The library uses compact rows, consistent group headings with counts, and a manufacturer filter in **Products**. Generic controls and indicators are grouped together. Manufacturer/family expansion is retained while filtering or switching views. Shared wildcard search, import/export and finger/Pencil drag/drop remain available; touch rows retain at least 44 px height.

**EAO** adds 33 configurable schematic references for Series **04 / 704**, **14**, **45**, **61** and **84** in `libraries/eao.json`. EAO's [selector configurator](https://www.eao.com/catalog/function/selector_switch/en/selector-switch?a_hmi_function=Selector+switch) and [indicator configurator](https://www.eao.com/catalog/function/indicator/en/indicator?a_hmi_function=Indicator&a_series_assignment=Series+04) identify the 704 prefix as Series 04. References include NO/NC pushbuttons, illuminated pushbuttons with independent contact and lamp ports, indicators, and selector/keylock templates in the applicable groups. Series 84 includes pushbutton/illumination/indicator templates. Symbols distinguish push, selector and key actuators. Logical terminal names and selected contact counts describe the schematic template; they are **not verified physical pinouts or complete orderable assemblies**. Exact article numbers, contacts, lamps, colour/voltage and accessory compatibility must be checked in EAO's configurator. No invented full ordering codes are supplied. Sources and their limited verification scope are stored in the library.

In a terminal's **Properties**, type into **Device Type** to search all terminal products by manufacturer, model or article number, or use the adjacent dropdown to browse. Arrow keys and Enter select a match; custom names remain possible. The choice prepares its model, pin count and catalogue data in the form; **Apply** commits it and **Cancel** changes nothing. BMK, strip/master, terminal ordinal, existing pin names, connection IDs, cable assignments and separate pin placement remain intact. Adding pins extends the existing names. A type cannot remove a wired or separately placed pin. Port geometry changes stretch existing routes in one undoable operation, and switching to/from ST-MT updates the disconnect symbol. Generic/custom types clear stale catalogue identity; only explicit catalogue choices attach catalogue metadata. Manufacturer filtering does not limit the terminal picker.

## Cables and conductors

Open **Cables → +** to create a cable with a unique number, initially **W1**, **W2**, etc. Numbers can be changed freely but must stay unique across the project, ignoring case. Cable properties include optional Function/Location AKS, cable type, default conductor cross-section, length in metres, shielding, manufacturer/article and project-specific SAP numbers, and a description. Choose the initial conductor count; **+** beside a cable adds individual conductors. Each conductor is a child of its cable, with a stable ID and its own unique designation, colour and optional cross-section override. Use **…** for conductor properties and **×** to remove a conductor. **Use cable cross-section** makes the conductor follow changes to its parent cable; uncheck it to enter a separate size. Unassigned conductors are yellow, assigned conductors light blue, and a selected connection's conductor pink.

Assign an existing wire in **Properties → Cable / Conductor**, or use **Create cable for this connection** to create and assign it in one undo step. You can also drag a conductor from Cables onto a connection; on iPad, tap a conductor then tap its target connection, or drag with a finger/Pencil. Terminal bridges cannot be cable conductors. A cable-assigned connection has a diagonal slash and a caption such as **W1 :L1 · 0.75RD**. Moving its label also moves the slash. Cable/conductor renaming and property changes update every representation. Split sections of a branched main connection retain one conductor identity and one caption. A new branch has its own assignment. The same conductor can be represented on more than one drawing sheet; conductor properties list all of its connections and their references.

Removing a conductor or cable clears its assignments and preserves the drawn wires. Removing a drawn wire leaves the conductor in the cable, available for reassignment. Cable creation, editing, assignment, add/remove and deletion support undo/redo. Properties validate duplicate numbers/designations and positive cross-sections, including fractional sizes such as 0.75 mm². Legacy projects without cables still open normally.

The document ends with automatically generated **Cable list** pages followed by a **Connection list**. Each cable gets its own pages with cable properties and every declared conductor, including unassigned conductors, actual From/To terminal identifiers, wire data and live drawing references. The connection list includes ordinary wires, copper/fiber cable conductors, standalone fiber connections and terminal bridges across all drawing sheets; split sections are grouped into their original connection. Long endpoint text wraps and lists paginate. Clicking rows opens their drawing connection; right-clicking edits properties. Both lists are included in the table of contents, title blocks and full A4 landscape PDF export. **Lists → Save cables and connections as CSV** exports cable properties, individual conductors and the complete connection list.

JSON projects add optional top-level `cables: [{id, number, cores: [{id, masterId, designation, colorCode, diameter?}], crossSection, ...}]`. `masterId` identifies the owning cable. Wires optionally reference `cableId` and `coreId`; existing endpoints and route points are unchanged. IDs remain stable across save/open and undo/redo. Generated `cable-list` and `connection-list` sheets are regenerated from project data. Cable membership does not alter wire routing or create extra geometry at junctions.

## Fiber optics and open connection ends

**Connect** automatically chooses a wire, terminal bridge or **Fiber** connection from the starting port. Optical ports are orange; optical connections have long dashes (18 drawing units on, 7 off). Connect matching media; ordinary electrical/bridge ports cannot be connected to optical ports. Fiber links support grid routes, Shift/45° routing, junction dots, root junctions, movement and undo in the same way as other connections. Crossing lines do not create junctions or model an optical splitter automatically.

Use **Generic → Connections → Fiber optic device / patch panel** for configurable optical equipment. Port-block properties expose **Port media (wire/fiber, comma separated)** alongside port names/sides; changing a wired port's medium is blocked. A single fiber can remain an independent connection, with optional fiber type in its properties. For several fibers, create a cable with **Medium → Fiber optic** and an optional fiber type (e.g. OS2/OM3), then name, add, remove and assign its individual fibers like copper conductors. Optical cables do not require a copper cross-section or shielding. The cable slash and cable/fiber caption remain visible. Copper and fiber cable assignments must match the connection medium. Cable/connection pages and CSV include all media, bridges and open connections.

**Ctrl+Alt-click** (Command+Option-click) a cable-assigned route, or **Ctrl-click** (Command-click) its caption to open **Cables**, expand its cable and scroll to the selected conductor/fiber. This only changes the view/selection.

Deleting or cutting a device, removing a terminal and permanently deleting a device/master preserve its attached connections, route geometry and cable assignments. The former ports become visible **open ends** at their original positions; the connection list identifies them as `Open end (formerly …)`. Placing or dropping a component with a matching port exactly on an open end reconnects it automatically. Choose **Connect**, click an open end, add route points if needed, then finish at a matching port, connection or by double-clicking a new free end. This extends the existing connection and retains its ID, cable/conductor assignment, properties and label position. It also works when drawing from a new port/free start to an existing open end. Wire, fiber and bridge media must match; bridges also stay in their terminal strip. Shared open ends retain the existing branches while the continued section belongs to the existing conductor. Cancelling an unfinished continuation changes nothing. Deleting a selected wire, junction or sheet still explicitly removes those selected connections. Area deletion also deletes explicitly selected wires. Undo restores the device and original port references.

**Double-click** an empty drawing point in **Connect** to finish a route with an open end. Double-clicking without a pending route starts a provisional free end; finish at a port, another connection or with a further double-click. Finger/Pencil users can double-tap. Single taps still add route points. Escape cancels a provisional start without changing the project. Wire, fiber and bridge routes retain their medium and bridge-strip identity.

Open ends use smaller visible circles with the same large finger/Pencil hit area. In **Select**, open ends and T/root junctions can be dragged individually. Ctrl/Command-click toggles individual symbols, junctions or open ends in the selection; an ordinary existing single selection is retained when adding the next object. A selection box and Ctrl/Command+A include junctions and open ends; fully enclosed routes are selected too. Drag a selected component, junction, end or route to move the group. Explicitly selected junctions move with the group; unselected external junctions stay put and only their adjacent route stretches change. Moving a single end stretches only its adjacent route, while complete selected connections move together. A larger invisible hit target helps finger/Pencil selection. Delete on a selected end explicitly removes its attached connections.

Projects add optional per-sheet `looseEnds: [{id, x, y, kind, formerRef?, formerLabel, strip?}]`; `~<id>:0` references these ends. Shared former ports retain a shared open endpoint. Connections add `kind: "fiber"` and optional `fiberType`; cable masters add `medium: "fiber"` and optional `fiberType`. Per-port `portKinds` uses `wire` or `fiber`; missing media retain the electrical defaults. Existing pin indices and copper project formats remain compatible. These fields are included in JSON, history and PDF rendering.

An earlier fiber-interface review covered the original 228 electrical reference entries by model and interface category; this count predates the EK1501 and EAO additions. No documented built-in fiber interface was identified in those entries: in particular, the [Beckhoff EK1100 uses RJ45/M8 copper interfaces](https://infosys.beckhoff.com/content/1033/ek110x_ek15xx/7634446091.html), and [Raspberry Pi 4/5 networking uses Ethernet/Wi-Fi](https://www.raspberrypi.com/documentation/computers/getting-started.html). An optocoupler's internal isolation is not an external fiber port. Existing copper pins therefore have no invented optical additions. The new [Beckhoff EK1501 reference](https://www.beckhoff.com/en-en/products/i-o/ethercat-terminals/ek1xxx-bk1xx0-ethercat-coupler/ek1501.html) supplies two documented multi-mode SC duplex interfaces, represented as four logical Tx/Rx fiber ports. Optical interface presence is documented; physical power-pin numbering, Tx/Rx orientation, exact ordering codes and accessory compatibility remain unverified. Generic/custom ports are user-defined.

Component placement joins all compatible coincident open ends after the final symbol geometry is known, including generic/manufacturer/custom symbols, device/pin overview placement, finger/Pencil drops and moved components. Rotation and reflection are respected. Passing over an end or cancelling a drag does not connect it. Connections retain their IDs and cable assignments, and the entire placement/connection operation undoes in one step. Copper/fiber mismatches, bridges from another strip and an end that would join to the very same opposite port are left open.

## Drawing sheet numbers and Field deletion

Open **Page properties** from a drawing or by right-clicking/holding its entry in **Sheets**. **Sheet number** changes its unique four-digit number independently of its title. Drawings sort numerically, with gaps allowed; the active sheet stays open. Cover/contents pages remain first, and generated lists follow the highest drawing number. Duplicate drawing numbers are rejected, and front matter is reserved. Title blocks, sheet navigation, contents, CSV/list references, source/destination links and PDF order follow the assigned numbers. New drawings receive the next available number. Legacy projects retain automatic consecutive numbering until a number is changed. Drawing JSON adds optional integer `number`; generated display numbers are regenerated. Renumbering supports undo/redo and JSON reopening.

In **Select**, click/tap a Field border or heading to select it, then use **Delete/Backspace** or the toolbar **Delete**. Field deletion preserves the components and connections inside it. Field movement/resizing still uses its existing handles, and deletion is undoable.

## Branches and root connections

Start or finish a connection on an existing wire/bridge to insert a junction. A junction can have several branches, and each branch can have further junctions. A crossing by itself does not join connections. Starting on a line and cancelling leaves the line untouched; completing a branch splits it into electrically connected sections in one undo step. Main-line sections share their conductor properties and show one label; new branches have their own properties. Ordinary ports and brown bridge ports cannot be mixed, and bridges remain within their terminal strip.

Junctions normally show a visible **dot**. In Select mode, select a junction and choose **Properties**, right-click/double-click it, or hold it on a tablet. Choose **45° root** and a **Root connection**: that section stays straight and perpendicular branches enter it diagonally. Selecting the other main-line section reverses the entry direction. Already diagonal/non-perpendicular entries keep their route. Wire properties also link to their endpoint junctions, including when a dot is hidden. Drag a junction to move it and stretch the attached ends. Deleting one branch preserves the remaining connections; deleting a junction explicitly removes its attached sections. Undo restores either operation.

While dragging a component, group or junction, route adjustments always use the geometry captured at the start of the gesture. Intermediate finger/Pencil/mouse positions cannot accumulate bends. Diagonal routes stretch their adjacent bends; when a bend falls behind the moved endpoint, a short replacement connects to the next fixed vertex. Returning to the starting position restores the route.

Drawing sheets optionally store `junctions: [{id, x, y, style: "dot" | "root", rootWireId}]`. Wire endpoints remain strings: normal ports use `partId:pinIndex`, junctions use `@junctionId:0`. Split main-line sections share `runId`; `labelHidden` suppresses repeated labels. `routing: "octilinear"` enables 45° segments in the existing ordered `points` array. Older projects need no migration. These fields survive movement, JSON save/open and undo/redo; PDF exports contain the rendered dots/entries without editing targets. Terminal and connection lists resolve junctions to connected ports.

Generic symbols include pushbuttons, illuminated pushbuttons with separate lamp ports, selector/keylock switches, indicators, passive components, diodes/LEDs, NO/NC/changeover contacts, relays, optocouplers, AC/DC power supplies, I/O modules, controller boards, 2-/4-pole RCDs (FI) and motors. AC motors are available as single-phase **L/N/PE**, three-phase **U1/V1/W1/PE**, and six-lead **U1/V1/W1/U2/V2/W2/PE** variants.

## Page properties and AKS fields

Use **Page properties** for the current drawing sheet, or right-click the blank sheet background or a drawing in the sheet overview to edit its title and optional **Function (=)** / **Location (+)** AKS context. The page context is printed near the top of the sheet. **Hide matching AKS aspects on symbols** suppresses only matching aspects; differing aspects remain visible. When both match, the AKS caption disappears and the equipment tag stays visible. Complete identifiers remain in properties, the device tree and project lists. Individual text-visibility switches still apply.

Choose **Field**, then drag a rectangle and assign its title and AKS. Fields align to the drawing grid. In Select mode, drag a field's border or heading to move it, or drag one of its eight corner/edge handles to resize it; the opposite edge stays anchored. Hold **Alt** for 2 mm steps. Fields stay inside the drawing, with a minimum size of one current grid step. Components and connections stay in place, and matching AKS captions update as the field moves or changes size. Undo/redo restores a move or resize as one step; Esc cancels it. Dimensions can also be entered in properties. Field headings stay inside their rectangle, with long headings shortened to fit and their full text available on hover.

Right-click anywhere inside a field, on its border or heading to edit its properties, or use its **Edit** action in Page properties. Symbols inside fields retain their own right-click properties. Smaller overlapping fields take precedence for their assigned aspects and inherit unspecified aspects from enclosing fields/the page. Select its border/heading and press **Delete**, use toolbar **Delete**, or delete it in Page properties. Its contained components and connections remain; Undo restores the Field. Property dialogs stay open when clicking outside them; use **Apply**, **Cancel**, **Close** or **Esc** to finish.

New components inherit the function/location at their placement point. Existing identifiers stay unchanged by default. Check **Assign to existing components in this context** to explicitly apply assigned aspects to existing components on the page or inside the rectangle; linked slaves continue to follow their master. Moving a component into/out of a field changes its displayed caption without renaming it. Cancel/Esc discards an unfinished field.

Page contexts and rectangles retain the optional `aks` and `aksAreas` keys on drawing sheets. They are preserved by save/open, undo/redo and PDF export. Old projects without these keys keep their explicit AKS captions.

## Symbol proposals

Open **Custom symbol proposals → Open symbol editor**, or open [`symbol-editor.html`](symbol-editor.html) directly. This separate local editor supports lines, rectangles, circles, text, named terminals, selection/movement, exact numeric properties, deletion and undo/redo. Geometry uses a selectable 1/2/4 mm drawing grid; terminals always use the 4 mm grid. Canvas dimensions are editable, and a local browser draft is retained.

**Download JSON** saves an editable `.cabel-symbol.json` proposal that can be shared for review. **Download SVG** creates a preview; schematic export in the main app remains PDF. **Open JSON** reopens proposals. In the main app, **Import symbol JSON** adds a click/drag-placeable library entry. Placed symbols retain their definition in the project, so reopening does not require reimporting the library. Their terminals support ordinary routing, rotation and reflection; text stays readable. Properties can download a placed symbol's original proposal again.

The shared format in [`scripts/symbol-format.js`](scripts/symbol-format.js) uses `kind: "cabel-symbol"`, `schemaVersion: 1`, `units: "mm"`, a stable ID/name/group/equipment prefix, canvas dimensions, structured `geometry` primitives and `terminals`. Coordinates are relative to the symbol origin. Imports validate known shapes, finite dimensions, unique terminal names and 4 mm terminal positions; raw SVG/HTML/scripts are not imported. Geometry text remains literal text. Limits are 256 shapes and 64 terminals.

## Terminals, relays and cross-references

**Create terminal strip** adds a master and its terminals. Use the strip's **+** action to add a terminal, or a terminal's **×** action to remove it permanently. A strip can contain different terminal types. Individual pins, whole terminals and the strip master can be placed separately. Pins retain the strip equipment tag, for example **X1 :1a**. A terminal's pins and its dedicated brown bridge port lie on one line.

Phoenix **ST 2,5-MT** and **ST 4-MT** disconnect terminals show an open knife-disconnect symbol. Existing placed ST-MT references and terminals added from the same strip template use this drawing as well.

**Connect** automatically creates a thicker brown bridge when starting at a brown bridge port. Bridges appear graphically in terminal lists. Bridge text is hidden when its straight section has insufficient room, and reappears when the section becomes long enough. The bridge and its connection data remain intact; select its line and use **Properties** to edit it when the text is hidden. Other conductor labels retain their white background and align automatically with the horizontal or vertical section on the grid. Previously saved bridges on regular pins remain readable and editable.

Relays provide a vertical complete symbol, a rectangular coil and independently placeable contact slaves. Generic relays have three changeover contacts; manufacturer family templates can have one, two or three. Links on the complete symbol open/place the sub-symbols, and sub-symbol references return to the complete symbol. All share its equipment tag.

Placed separate terminal pins leave the main symbol's terminals available. Reciprocal live references use **/0003.A3** notation throughout the application. Source and destination arrows can be paired in properties. Click a reference or press **J** to jump to its target. Stacked terminals of the same strip suppress repeated AKS/equipment tags; the terminal type repeats at the top of a stack and at each type change. References to separately placed pins on lower terminals move above the first terminal in the stack, retain their pin identifiers and remain clickable. In the text above a symbol, links appear before the Device Type, from top to bottom. Only the first terminal's designation/AKS block moves up to make room for collected links; its type remains the last line nearest the symbol. Type captions on lower terminals stay at their original symbols, including mixed-type stacks and multiple separately placed pins.

## Manufacturer libraries

**262 reference entries in eight libraries** are bundled with v1.28.1. Each manufacturer or board collection has a separate editable JSON source:

| File | Included reference entries |
| --- | --- |
| [`libraries/abb.json`](libraries/abb.json) | 148: common S201–S204 B/C/D 6–63 A combinations, S200 accessories/busbars, AF four-pole contactors and F202/F204 RCD references |
| [`libraries/phoenix-contact.json`](libraries/phoenix-contact.json) | 65: ST terminals/accessories, UNO/TRIO/QUINT 24 V power supplies and a PLC optocoupler interface |
| [`libraries/beckhoff.json`](libraries/beckhoff.json) | 8: EK1100, EK1501 with documented optical interfaces, EL1008/EL2008, EL1809/EL2809, EL3062 and EL4002 logical module references |
| [`libraries/raspberry-pi.json`](libraries/raspberry-pi.json) | 2: Raspberry Pi 4 Model B and Pi 5 with 40 GPIO-header anchors |
| [`libraries/generic-boards.json`](libraries/generic-boards.json) | 1: ESP32 D1 mini logical GPIO template; board vendor/variant unspecified |
| [`libraries/joy-it.json`](libraries/joy-it.json) | 1: Joy-it NodeMCU V2 LUA / ESP8266 WiFi logical port template |
| [`libraries/finder.json`](libraries/finder.json) | 4: Series 60.11 / 60.12 / 60.13 templates and the supplied **60.13.9.024.0074**, with a 24 V DC coil and three changeover contacts |
| [`libraries/eao.json`](libraries/eao.json) | 33: Series 04/704, 14, 45, 61 and 84 pushbutton, illuminated pushbutton, indicator and applicable selector/keylock schematic templates |

**These are reference libraries, not verified complete manufacturer catalogues.** Most original references could not be verified when manufacturer websites were blocked by the cloud outbound policy. The EK1501 optical interface was subsequently checked against the linked manufacturer documentation; this does not verify the rest of its physical pinout or the other references. EAO family functions and the 704/Series 04 naming were researched separately; the schematic templates still have unverified physical pinouts and assembly configurations. Source URLs, incomplete coverage and verification status are recorded in the files and shown in the library UI. Variant availability, coil suffixes, ratings, physical pin diagrams and accessory compatibility require manufacturer confirmation. Power-supply entries now include family-specific functional templates: duplicate DC outputs on UNO, DC OK contacts on TRIO, and additional configurable signal IN/OUT ports on QUINT4. These do not claim verified physical terminal designations for every variant. Unknown ordering numbers remain blank. Manufacturer numbers are supplied for the user-specified Finder article, Phoenix ST 2,5 (3031212) and ABB S201-C16 (2CDS251001R0164). The latter two have a narrowly scoped manufacturer-source check recorded in their library data; other specifications and physical pinouts remain unverified. SAP numbers remain project-specific.

Twelve additional Phoenix Contact article numbers are documented in manufacturer sources. Each record includes its `manufacturerNumberSource`, the documented fields and a narrowly scoped source note; physical pinout, current availability and accessory compatibility remain unverified. Family templates without an unambiguous complete ordering code retain blank manufacturer numbers.

| Reference | Manufacturer number |
| --- | --- |
| ST 2,5 BU | 3031225 |
| ST 2,5 PE | 3031238 |
| ST 4 | 3031364 |
| ST 4 BU | 3031377 |
| ST 4 PE | 3031380 |
| ST 6 | 3031487 |
| ST 6 BU | 3031490 |
| ST 2,5-MT | 3036343 |
| ST 4-MT | 3038875 |
| FBS 2-5 | 3030161 |
| UNO-PS/1AC/24DC/60W | 2902992 |
| UNO-PS/1AC/24DC/100W | 2902993 |

Choose **Products**, optionally filter by manufacturer, then expand a manufacturer/family or search by manufacturer, model or article number. Click or drag a product onto the drawing. Placed entries retain manufacturer, model, attributes, source URLs and verification status in the project. Phoenix terminals are added to the selected terminal/strip's master; otherwise a new unplaced strip master is created. Finder family templates create the appropriate number of contact slaves. Relay sub-symbols appear in the device tree but do not duplicate the purchased assembly in the bill of materials.

Power supplies, I/O modules and controller boards have editable port names and up to 64 grid-aligned anchors. Optional `portSides` keeps input/output ports on the chosen sides. The power-supply drawing uses an AC/DC divider, AC wave and DC mark fitted to its enclosure. For an older placed supply, use **Add missing outputs / signals** in properties and then **Apply** to append template ports while preserving existing terminal indices. Port sides are editable as one L/R value per pin. New generic symbols provide sensible defaults; catalogue entries retain their configured ports. Wired ports cannot be removed in properties. These are functional schematic representations: Beckhoff bus/channel ports and ESP32/NodeMCU ports do not claim to reproduce physical connector counts or header layouts. Port-mapping notes appear in properties.

Each folder can download its JSON source. **Import manufacturer library** accepts the same format and replaces a library with the same ID for the current browser session. Imported libraries do not modify the repository; placed components retain their data after saving and reopening even without that library being loaded.

To update bundled entries, edit the appropriate JSON source and rebuild the deterministic offline bundle:

```sh
node scripts/build-libraries.cjs
node scripts/build-libraries.cjs --check
```

Library format: `schemaVersion: 1`, a stable `id`, `manufacturer`, `coverage`, `sources` and `families`. Each family contains `id`, `name`, optional `scope`, and `products`. Products have stable `id`, `model`, `symbol`, optional `name`, `manufacturerNumber`, `value`, `pinNumbers`, `portSides`, `portKinds`, `attributes` and `verification`. Relay entries may specify `relayContactCount` and `coilValue`; terminal entries may specify `terminalType`. Imports validate IDs, known symbol types and terminal/relay counts. The checked-in `libraries/catalog.js` is generated from the manufacturer JSON source files; do not edit it directly.

## Documents and project files

The document automatically maintains a cover, table of contents, drawing sheets, device lists, terminal lists, cable lists and a connection list. Generated device-directory pages include only top-level masters (including independent devices); their slaves remain in the device overview, detailed **Lists** tables/CSV and terminal lists. A missing parent makes a device an independent entry. Each terminal strip starts a new list page. Page numbers always use four digits and appear separately from the sheet title. New drawings default to **Schematic**; automatic sheet titles do not contain page numbers. Existing user-entered titles stay unchanged. The drawing head has a prominent **Sheet title** cell and four compact approval cells for **Issued**, **Check 1**, **Check 2** and **Release**, each with a name and date on every page. Edit document metadata with **Project info** and sheet titles with **Page properties**. Dates entered in the approval fields use `YYYY-MM-DD`. Issued falls back to the older Drawn by/Date fields when blank. The optional metadata keys are `issuedName`/`issuedDate`, `check1Name`/`check1Date`, `check2Name`/`check2Date`, and `releaseName`/`releaseDate`. **Lists** opens live tables and CSV download. **Export PDF** downloads the complete document as an A4 landscape PDF, independently of screen zoom/pan, and restores the current view afterward.

The cover body omits its former standalone **Date** row. Approval names/dates still appear in the shared title block. Printed format/raster captions are removed. **Leitwerk Version 1.28.1** sits beside **Company**. The drawing title block has **two main rows**. At the bottom right, **PREVIOUS**, **CURRENT**, **NEXT** and **TOTAL** each have their own cell, with the heading above its value. Page identifiers remain four digits; **TOTAL** uses the actual document size as plain text, for example **7 SHEETS**. Numbering gaps do not affect this count. PREVIOUS/NEXT follow document order and show `—` at the boundaries. These fields update after generated-page pagination and are included in PDF export.

**Save** saves JSON and **Open** reloads it. Projects retain `appVersion`, metadata, sheets, parts, wire endpoints (`a` / `b`), ordered route `points: [{x,y}]`, labels, transformations, placement state, hierarchy and references. Manufacturer products add a `manufacturer` and `catalog` object to the existing part format; normal `manufacturerNumber`, `sapNumber`, `pinNumbers`, `masterId`, `terminalType` and `value` fields remain editable. Existing projects without these optional fields remain readable. User-entered text is preserved as entered; the application UI, generated headings and default text are English.

Drawing sheets may also contain `redlines: [{id, points: [{x,y}], layer?}]`, with `layer` set to `red`, `yellow`, `blue` or `green`. Missing layers retain the original red-pen appearance. These freehand points use the same paper coordinates as the schematic, independently of screen zoom. Old projects without `redlines` need no migration. Annotations survive JSON roundtrips, sheet changes and undo/redo, and appear in their layer colours/transparency in PDF exports without selection boxes or handles. They do not add entries to device, terminal or connection lists.

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
| Hold Shift while connecting | Draw the next wire/fiber/bridge leg at 45° |
| Ctrl/⌘+A | Select placed symbols, connections, junctions and open ends on the current drawing sheet |
| Click a connection in Select | Select one straight line segment |
| Ctrl/⌘+click in Select | Add/remove symbols, junctions, open ends or line segments; clicking a symbol/pin also reveals it in Devices |
| Double-click / double-tap a connection in Select | Select the whole logical connection, leaving other branches separate |
| Ctrl+Alt+click / Command+Option+click | Reveal a symbol/terminal in Devices, or an assigned cable route in Cables |
| Ctrl/⌘+click a cable caption | Reveal the assigned conductor/fiber in Cables |
| Ctrl/⌘+C / X / V | Copy / cut / paste selected object |
| Ctrl/⌘+Z | Undo |
| Ctrl/⌘+Y or Ctrl/⌘+Shift+Z | Redo |
| Delete / Backspace | Unplace electrical devices or delete selected text, references, Fields, whole connections, junctions or open ends |
| Esc | Cancel the current operation or dialog |
| Ctrl/⌘ + mouse wheel | Zoom |
| Middle-button drag | Pan the sheet |

Shortcuts leave normal text editing intact while an input or dialog is active. In the terminal-type search, **Arrow Up/Down** and **Enter** choose a result; **Esc** closes its result list before closing the dialog. Partial line selection does not delete a whole connection: double-click it first when deleting the whole connection is intended.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html` | Main application and inline editor logic; extension order matters |
| `styles/workspace.css` | Responsive desktop/tablet workspace and library styling |
| `scripts/workspace-ui.js` | Toolbars, touch/Pencil input, navigation and fullscreen |
| `scripts/connection-graph.js` | Junctions, branch/root routing and route geometry |
| `scripts/cables.js` | Cable/conductor data, assignments and generated connection lists |
| `scripts/red-pen.js`, `scripts/sheet-numbers.js` | Annotation layers and drawing-sheet numbering |
| `libraries/*.json` | Editable reference library sources |
| `libraries/catalog.js`, `scripts/build-libraries.cjs` | Generated browser bundle and its build/check script |
| `symbol-editor.html`, `scripts/symbol-editor.js`, `scripts/symbol-format.js` | Separate symbol editor and shared proposal format |
| `tests/*-smoke.cjs` | Browser and interaction regression checks |

## Checks

Checks require Node.js, the `playwright` module and Chromium. These are development dependencies; running the app does not require them. Each browser check starts a temporary local server and closes it and the browser afterward. Run from the repository root:

```sh
node scripts/build-libraries.cjs --check
node tests/browser-smoke.cjs
node tests/manufacturer-smoke.cjs
node tests/symbol-page-smoke.cjs
node tests/tablet-input-smoke.cjs
node tests/workspace-view-smoke.cjs
node tests/red-pen-smoke.cjs
node tests/connection-branch-smoke.cjs
node tests/routing-move-smoke.cjs
node tests/cables-smoke.cjs
node tests/fiber-open-ends-smoke.cjs
node tests/review-tools-smoke.cjs
node tests/selection-continuation-smoke.cjs
node tests/segment-selection-smoke.cjs
node tests/library-types-smoke.cjs
node tests/component-properties-smoke.cjs
node tests/document-navigation-smoke.cjs
```

| Check | Main coverage |
| --- | --- |
| `browser-smoke.cjs` | Placement, properties, routing/segment movement, clipboard, transformations, selection, history, devices/slaves, terminals/bridges, references, lists, JSON and PDF |
| `manufacturer-smoke.cjs` | JSON/bundle agreement, search, imports/downloads, product placement/ports, symbol geometry, metadata, device deletion, lists/pagination, approvals and PDF |
| `symbol-page-smoke.cjs` | Symbol editor/import/export, custom symbols, port upgrades, page/Field AKS, Field movement/resizing, text visibility, cancellation, history and PDF |
| `tablet-input-smoke.cjs` | Finger/Pencil placement and editing, actual rendered zoom/pan, pinch rollback, persistent panels, connection media, fullscreen, standalone metadata and PDF |
| `workspace-view-smoke.cjs` | Painted drawing pixels and stable camera/document through fullscreen, viewport changes, browser exit and resume without corrective zoom |
| `red-pen-smoke.cjs` | Freehand strokes, whole-stroke erasing, selection, movement/scaling, cancellation, palm rejection, pinch rollback, history and JSON/PDF |
| `connection-branch-smoke.cjs` | Deferred splits, nested branches, junction dots and 45° roots, root choice, movement/deletion, bridged branches, references, JSON and PDF |
| `routing-move-smoke.cjs` | Bounded bends and stable routes across pointer detours, component/junction/group movement, cancellation, undo, JSON/PDF and touch/Pencil input |
| `cables-smoke.cjs` | Cable/conductor identity, properties, assignment, slash/captions, deletion/undo, multi-sheet representations, pagination, CSV, JSON/PDF and tablet input |
| `fiber-open-ends-smoke.cjs` | Optical ports/dashes, media compatibility, fiber cables, preserved open ends, reconnection, cable navigation, EK1501, lists/CSV/PDF and tablet input |
| `review-tools-smoke.cjs` | Highlighter layers, visibility, sheet numbering/references, Field deletion, free-end double-click/tap creation and movement, history and PDF |
| `selection-continuation-smoke.cjs` | Ctrl selection, T-node/group movement, continuing existing connection IDs, compatible automatic port attachment, cancelled drops, history, JSON/PDF and touch/Pencil input |
| `segment-selection-smoke.cjs` | Individual/box-selected legs, Ctrl toggling, multi-leg movement, endpoints, whole-run double-click/double-tap, branch isolation, cancellation, history and PDF restoration |
| `document-navigation-smoke.cjs` | Combined Ctrl/Cmd selection and device/pin reveal, numbering gaps and physical page totals, previous/next boundaries, title block/cover cleanup, sourced article numbers, native Ctrl+Pencil and JSON/PDF |
| `component-properties-smoke.cjs` | Device Designation/type/value separation, semicolon pins, terminal-only fields, material SAP resets, device-tree labels/colours, history, JSON/PDF and tablet input |
| `library-types-smoke.cjs` | Compact library filtering/state, EAO symbol variants, transactional terminal-type changes, wired/slave pin guards, metadata, keyboard/tablet input, history and PDF |

Chromium defaults to `/usr/bin/chromium`. Most older checks support `CHROMIUM_PATH` to select another Chromium executable; `fiber-open-ends`, `review-tools`, `selection-continuation`, `segment-selection`, `library-types`, `component-properties` and `document-navigation` currently use the default path directly. The workspace-view check also accepts `CHROMIUM_PATH` pointing at Brave and `PLAYWRIGHT_HEADED=1` when a display server is available.

`PLAYWRIGHT_BROWSER=webkit node tests/tablet-input-smoke.cjs` uses an installed Playwright WebKit engine for that check. Chromium iPad emulation, native browser touch/pen events and synthetic original-target Touch Events help cover redraws and gesture cancellation; they do not replace testing on a physical iPad with Safari and Apple Pencil.

Screenshots and PDFs are written under `/tmp`, outside the repository. PDF checks cover document state and exports; generated files can additionally be inspected for expected page counts and A4 landscape dimensions. The manufacturer `file://` check explicitly skips when Chromium administrator policy blocks local-file navigation; HTTP checks still run.
