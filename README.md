# Cabel-Studio / Leitwerk

A browser schematic editor with optional Firebase cloud projects for A4 landscape drawings, written in HTML, CSS and JavaScript. The current application version is **1.40.0**, shown beside the application name and in the browser title.

[Open Leitwerk in your browser](https://theyogi1999.github.io/Cabel-Studio/) · [Symbol editor](https://theyogi1999.github.io/Cabel-Studio/symbol-editor.html)

The interface and generated document headings are English. The editor runs entirely in the browser. Work locally with JSON/PDF, or use **Projects** to sign in and synchronize a cloud project between iPad and desktop. Download JSON to keep an independent editable backup.

- [Run and quick start](#run-and-quick-start)
- [Drawing and editing](#drawing-and-editing)
- [Component properties and device overview](#component-properties-and-device-overview)
- [Selecting connections and line segments](#selecting-connections-and-line-segments)
- [Library and terminal type selection](#compact-library-and-terminal-type-selection)
- [Cables and conductors](#cables-and-conductors)
- [Fiber optics and open connection ends](#fiber-optics-and-open-connection-ends)
- [Drawing sheet numbers and Field deletion](#drawing-sheet-numbers-and-field-deletion)
- [Branches and root connections](#branches-and-root-connections)
- [Page properties and AKS fields](#page-properties-and-aks-fields)
- [Symbol proposals](#symbol-proposals)
- [Terminals, relays and cross-references](#terminals-relays-and-cross-references)
- [Manufacturer references](#manufacturer-libraries)
- [Documents and project files](#documents-and-project-files)
- [Supply and load calculations](#supply-and-load-calculations)
- [All shortcuts and gestures](#shortcuts)
- [Project layout](#project-layout)
- [Cloud projects](#cloud-projects)
- [Firebase limits and data usage](#firebase-limits-and-data-usage)
- [Checks](#checks)

## Run and quick start

Open `index.html` in a browser, or serve this directory with any static web server. The checked-in manufacturer bundle works with both HTTP and `file://`. All required browser scripts are included; no package installation or build step is required to use the editor. Project files and exports are downloaded locally. Use the hosted HTTPS app or a local HTTP server for cloud sign-in; `file://` is intended for local editing.

For a local HTTP server, run this in the project directory and open <http://localhost:8080>:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

1. Choose **Generic** or **Products** in the left library. Search or expand a group, then click or drag a component onto a drawing sheet.
2. Use **Connect** to join ports. It automatically selects wire, bridge or fiber from the starting port. Use **Select** to edit objects and line segments.
3. Use **Sheets**, **Devices** and **Cables** in the right overview to manage the project. Add drawings with **+** in Sheets; edit titles and numbers with **Page properties**.
4. Use **Project info** for document metadata, **Lists** for generated tables/CSV, **Calculations** for supply/load and fault scenarios, **Save** for editable JSON, and **Export PDF** for the complete document.
5. For cloud work, open **Projects**, sign in, then choose **New empty project**, save the current drawing, or open/duplicate an existing project. Sign in with the same account on the other device and open that project. Firebase setup is described under [Cloud projects](#cloud-projects).

On iPad, entries can be dragged with a finger/Pencil or tapped and then placed on the paper. Two fingers pan/zoom in every tool. For an app-style window, launch the site through **Safari → Share → Add to Home Screen**. Detailed touch and fullscreen behaviour is described below.

## Supply and load calculations

**Edit component** has separate **Device** and **Calculation** tabs. Device contains designation, type/value, material numbers, terminals, references and text visibility. Calculation contains load inputs/assignment, internal conductive paths and, for source devices, the supply/fault settings shortcut. Opening a device from **Calculations** selects Calculation directly. Non-electrical annotations and optical-only devices omit the empty calculation tab. Tab changes retain unsaved input; **Apply** commits both tabs together and **Cancel** discards both. Invalid inputs reveal their tab. Tabs support touch and Left/Right/Home/End keys; one Apply can be undone/redone as a whole.

**AC/DC power supplies detect their DC output loads automatically.** The generic AC/DC symbol and supported Phoenix UNO/TRIO/QUINT products need no separate supply setup. Wire both DC poles to the consumer's actual power inputs: for example the 24 V/0 V supply ports of a Beckhoff module or the two lamp ports. Equivalent duplicate DC output terminals belong to the same rail. Switch contacts, GPIO, DC OK and fiber ports do not substitute for power inputs. Existing product placements without a saved power-port model use the matching library model.

Open the power supply's **Calculation → DC output loads** section to see detected devices, their entered consumption and status. **Apply & view connected loads** opens its circuit directly. The separate **Input load (upstream supply)** section calculates the converter's input watts from those output loads, using the efficiency and any additional fixed loss entered for the supply. Choose **Enter input power/current manually** to use a measured or separately calculated input instead. Devices with unknown consumption appear as **Not entered** and make the load total incomplete; enter their input W or A to include them in the demand total. No consumption or available output current is guessed from a product name.

Each eligible power supply has a derived DC circuit with a stable identity. Catalogue output-voltage metadata supplies its nominal voltage; otherwise the generic profile starts at **24 V DC**, clearly marked for confirmation. **Edit supply / fault data** saves voltage, reserve, available current and fault settings as an explicit circuit. Existing configured circuits and output mappings take precedence, so a physical source is not duplicated. **Remove supply** disables automatic output detection for that device; this opt-out survives JSON/cloud/history. Re-enable it through **Apply & enable output load detection** in its Calculation tab. Unplacing/re-placing the source preserves its identity. Detection is based on schematic connections and does not simulate whether the AC input is currently energized or certify voltage compatibility.

Automatic profiles use `@psu:<partId>` IDs and are derived without modifying the saved `projectInfo.electricalCalculations.circuits` inputs. Editing a profile writes an explicit circuit. Optional `disabledSourcePartIds: [partId, ...]` in the calculation settings records disabled automatic sources. Simultaneous edits to source settings and relevant port names, product power models or output-voltage metadata are reviewed as an electrical cloud conflict.

**Automatic power-supply input watts:** in **Calculation → Input load (upstream supply)** choose **Calculate from DC output loads**, enter **Efficiency (%)**, and optionally **Additional fixed loss (W)**. The live result shows installed input and operating demand separately. `Input = output / (efficiency / 100) + fixed loss`. For example, 36 W output demand at 90% efficiency gives 40 W input demand before any additional fixed loss. Add only losses not already covered by the entered efficiency. Blank efficiency stays unknown and prevents a complete upstream capacity comparison. Use the existing AC power-factor and input-terminal fields to calculate upstream phase currents.

Downstream load factors are retained: installed output watts and demand watts are converted separately. Fixed loss is included once in each input figure; the effective converter demand factor is derived rather than applying the downstream factors twice. **Output reserve sizes the output circuit and is not extra input consumption.** Upstream reserve is applied to upstream demand. Cascaded converters are calculated from their final consumers back to the incoming supply. Dependency cycles, incomplete output wiring, missing consumption or disabled output detection give an incomplete converter input and no upstream capacity margin. No-load/startup transients and load-dependent efficiency curves are outside this fixed-efficiency model.

New supplies and supplies with no numeric input default to automatic watts. Existing numeric input entries remain manual until Automatic is selected. Automatic mode saves only `powerConversion: {mode: "automatic", efficiencyPct?, fixedLossW?}` and the input assignment/ports/power factor; calculated watts and effective load factors are derived afresh, never stored as replacement input data. Explicit manual mode uses `{mode: "manual"}` with the normal `loadCalculation` input. Missing efficiency can be saved to complete later. JSON, cloud copies/revisions, undo/redo and CSV/linked text PDF retain parameters and report calculation bases. Concurrent converter-parameter and source-setting edits trigger electrical conflict review.

Open **Calculations** in the upper toolbar and choose **Add supply**. DC, single-phase AC and three-phase AC start at 24 V, 230 V and 400 V respectively; voltage is editable. Enter a circuit name, continuous available current and reserve percentage. Automatic assignment needs a placed, linked source. A manual/external supply remains available for explicitly overridden planning loads. Three-phase voltage is **L–L**; single-phase voltage is **L–N**. Current ratings apply per phase.

To draw an incoming supply, select **Calculations → Place supply**, then click/tap the drawing to choose its position. **Escape** or **Cancel** abandons placement without creating a device. **Show source** jumps to an already placed source; an unplaced source is re-used with the same ID. Alternatively, use **Generic → Connections → Supply** (click, drag-and-drop, or tap then place). A new generic Supply creates a linked 24 V DC calculation circuit in the same undo step. Choose **Apply & edit supply / fault data** in its properties to configure it.

Supply symbols have actual wire ports: **+/−/PE** for DC, **L/N/PE** for single-phase AC, and **L1/L2/L3/N/PE** for three-phase AC. Connect them using the normal Connect tool; terminals, routing, branches, component movement, rotation/reflection, open ends, JSON and vector PDF behave as for other electrical devices. Supply pin roles/media follow the selected system. Change the supply system before wiring; changing it while the source is wired or has separately placed pins is prevented. Editing voltage/current updates its caption without replacing connection IDs. A Supply symbol can be unplaced/re-placed without deleting its existing wires. Circuit definitions and source-device links are saved in JSON/cloud and retained in undo/redo. Copper wiring now determines automatic load membership and phase. Screen distances do not determine feeder impedances.

**Automatic connections:** connect power inputs to a placed Supply. **Calculations → Connected devices** lists devices, actual terminal/source-pole relationships and status, including transit terminals and PE/return-only connections. DC requires + and −, single-phase AC requires L/N, a two-wire load on a three-phase source requires one phase and N, and a balanced three-phase load requires three distinct phases. Phase order, polarity, nominal-voltage compatibility and physical manufacturer pinouts are not verified. Two-live-conductor single-phase loads and circuit/voltage-drop simulation through consuming components are outside this model.

In **Edit component → Calculation → Load calculation**, **Automatic · follow copper wiring** is the default for load symbols. Enter known **electrical input power (W)** or **current (A per phase)**, a demand/simultaneity factor from 0 to 1 and, for sinusoidal AC, **cos φ** and lagging/leading behaviour. Electrical values are never inferred from Device Value text or a catalogue description. Blank input stays unknown and prevents a complete capacity comparison for the connected circuit. Select the actual two or three **power input terminals** for custom/multiport devices; PE, signals and converter outputs are not load inputs. Generic load templates and supported product models supply the normal inputs. Beckhoff I/O, Raspberry Pi 5 V/GND rails, ESP32/NodeMCU alternatives, EAO lamps, optocouplers and Phoenix AC/DC inputs use explicit schematic port models. Unknown products and six-lead/custom motors require input selection. Use **Use product power inputs** to reset an old explicit override; overrides are otherwise retained. The wiring status refreshes when input terminals change, and the input-value label identifies W or A. **Exclude from load totals** records an exclusion while retaining the device in the connected-device directory. **Manual override · circuit name** explicitly retains a planning assignment and phase; an override that contradicts a detected source is flagged.

Detection follows actual endpoint IDs on copper wires and terminal bridges, saved dot/45° junctions, terminal-pin slaves and paired source/destination references across sheets. A source/destination reference must target the opposite reference object; ordinary navigation links do not conduct. Terminal rails conduct as drawn, including their bridge ports; a disconnect knife splits its first input from the right/bridge side. Fuses and breaker/RCD pole pairs are modelled closed for the demand scenario. NO contacts are open and NC two-terminal contacts conduct in their normal state. Relays/changeover contacts and custom operating states can be defined with **Edit component → Calculation → Internal electrical paths → Custom conductive pairs**. These assumptions appear in the calculation sheets. Paths model the schematic, not verified physical hardware or trip timing. Wires that merely cross, same equipment tags, same cable/core labels and ordinary master membership do not join nets. Fiber never carries electrical supply. A terminal pin is an alias of its physical main terminal; relay coil/contact representations retain their specific parent pin aliases without joining unrelated coil/contact ports. The complete relay and its coil count as one physical load. The master load value is authoritative; existing separate-coil data is reused if the master has none. Editing either representation writes the canonical master load without deleting old separate-coil data. A coil shown in a placed complete relay is recognized even while its separate symbol is unplaced, and a placed separate coil can represent an unplaced master.

A DC power supply can consume AC on its input and be the source of a separate DC circuit. In **Edit supply / fault data → Source output terminals**, supported product sources use their schematic output model by default; explicit output selections take precedence. Phoenix duplicate DC output pairs are grouped as matching rails, while their AC inputs and auxiliary signal contacts remain separate. Other source devices need an explicit output mapping. Converter terminals stay electrically separate. Automatic input watts propagate as one converter load into the upstream circuit; the circuits keep their own voltages and currents. Efficiency is entered explicitly. Motor mechanical output must be converted to electrical input before entry. Avoid entering the same physical consumption on a master and its slaves twice.

Rewiring, changing conductive paths, removing/unplacing sources, undo/redo, reopening JSON and incoming cloud changes recompute assignments. Missing returns, mixed sources, shorted source poles and parallel live supplies produce diagnostics, not an automatic assignment. Shared return/PE nets alone do not parallel active sources. Partial totals remain visible; an incomplete load total has no capacity margin. Automatic loads need complete power-input connections; manual overrides can include unplaced devices. Existing load records without an explicit `assignment: "manual"` now follow wiring using their saved electrical values. Their original circuit IDs are not rewritten just by viewing/calculating.

The panel reports installed input, demand input, reactive power and phase currents. For each load, current input converts to apparent power using `S = U × I` (DC/single phase) or `S = √3 × U(L–L) × I` (balanced three phase). Power input uses `S = P / cos φ` and signed `Q = ±√(S² − P²)`. The demand factor multiplies both P and Q. Balanced loads split equally across three phases; phase-to-neutral loads use `U(L–L) / √3`. Phase currents come from the vector sum of that phase's P/Q. The highest phase current determines required supply current. **Reserve is added to demand**, e.g. `required current = demand current × (1 + reserve % / 100)`. An entered rating is compared with required current; no rating means no capacity comparison. The arithmetic installed-VA total and vector demand-VA total are labelled separately. Neutral current, harmonics, motor starting/inrush and thermal calculations are outside this model.

**Short-circuit scenarios** are optional and independent of the operating load total. In **Edit supply / fault data**, choose:

- **Radial impedance model**: enter source and feeder R/X in **mΩ**, including the complete upstream equivalent source. Three-phase inputs are **per phase**, and calculate a balanced three-phase bolted fault with `I = c × U(L–L) / (√3 × |Z|)`. Single-phase inputs cover the **complete outgoing-and-neutral loop**, using `I = c × U(L–N) / |Z(loop)|`. DC uses the complete outgoing-and-return resistance and `I = U / R(loop)`. Source and feeder resistances/reactances are summed separately, then `|Z| = √(R² + X²)`. The AC voltage multiplier c is an explicit scenario input, initially 1; it is not an automatically selected IEC maximum/minimum factor. Enter impedances appropriate to the conductor temperature and source condition of the scenario. Blank inputs remain unknown; justified zero values must be entered explicitly. Zero total impedance produces no result.
- **DC manufacturer value**: enter the documented sustained short-circuit current **at the supply terminals** for a current-limited electronic supply. The result is labelled **Declared**, not calculated. It is not an inferred downstream fault current. Boost peaks, duration, foldback/hiccup and feeder voltage drop require the supply characteristic. The resistive DC model is intended for an explicitly modelled resistive/Thevenin source, not a regulated electronic supply.

These are explicit engineering estimates for a single radial equivalent source, not a complete IEC 60909 study. Motor/generator/inverter contributions are not discovered automatically. They do not verify earth faults, protective-device breaking capacity, selectivity or disconnection times. Missing/incompatible loads produce a **partial total**, and missing fault data produces an incomplete result rather than a guessed number. Missing supply assignments remain visible for repair. Removing a supply with explicit manual assignments is prevented; undo/redo restores supply and load edits together.

Formula references: Schneider Electric's Electrical Installation Guide describes [installed apparent power and load current](https://www.electrical-installation.org/enwiki/Installed_apparent_power_%28kVA%29), [the radial R/X impedance method](https://www.electrical-installation.org/enwiki/3-phase_short-circuit_current_%28Isc%29_at_any_point_within_a_LV_installation) and the [400 kVA / 420 V / 4% transformer example](https://www.electrical-installation.org/enwiki/Short-circuit_current_at_the_secondary_terminals_of_a_MV/LV_distribution_transformer) used as an independent numerical check.

Each configured supply adds automatically paginated **Electrical calculations** sheets at the end of the document. They include entered inputs, detected connections and phases, conductive-path assumptions, unresolved devices, explicit overrides, results, formulas and model limits. These export as selectable text/vector tables in the regular A4 PDF; device rows link back to placed components. **View report sheet** opens the selected circuit's report. **Export CSV** exports inputs/results/basis for every configured supply. Circuit definitions live in optional `projectInfo.electricalCalculations: { version: 1, circuits: [...] }`; component load inputs live in optional `loadCalculation`. Automatic records use `assignment: "automatic"`, `circuitId: "@auto"`, `phase: "auto"`, optional input `value` and a two-/three-element `powerPins` array of zero-based terminal indices. Explicit overrides use `assignment: "manual"` and the chosen circuit/phase. Optional `loadExcluded: true` excludes a load. Optional `calculationLinks: [[a,b], ...]` overrides conductive paths (an empty array means open). Other source devices map `sourcePins` on their circuit; fixed Supply symbols use canonical pole order. Derived circuits, phases and connected-device rows are never persisted as replacement input data. JSON, cloud projects, project copies, released revisions and undo/redo retain them. Concurrent edits to supply definitions and electrical topology/load data trigger review together; edits to independent drawing sheets still merge normally. Cloud viewers can inspect reports and download CSV without editing calculation inputs.

## Drawing and editing

The top bar keeps drawing tools, selection actions and undo/redo. **Project info** and **Lists** sit to the left of **Save** in the top row; **Page properties** and **Grid** stay in the editing toolbar. Compact previous/current/next sheet controls float at the top centre of the drawing, while zoom out, the percentage, zoom in and fit/centre float at the bottom right. Add a sheet with **+** in the sheet overview heading. The compact sheet overview shows only four-digit numbers and names. The component library and sheet/device overview stay visible beside the drawing on iPad and desktop, including portrait orientation and full screen. Buttons and property fields use larger touch targets. Mirror and fit buttons use SVG icons.

With a finger or Pencil, drag components from the generic/product libraries or device overview onto the paper. Start sideways to drag immediately; hold briefly before a vertical drag so vertical library scrolling still works. A preview follows the contact and an invalid/outside drop changes nothing. You can also tap a library entry and then tap the paper. In **Select**, drag a symbol, wire section, label or Field handle to edit it directly. Hold an object to open its properties, or choose **Properties**. There is no separate Touch edit switch. Mouse click placement, HTML drag-and-drop, right-click, blank-paper area selection and keyboard shortcuts continue to work.

**Select** uses an empty-paper drag for a selection box, including with a finger or Pencil. **Connect** uses taps for terminals and route points; dragging does not automatically pan. With a Pencil/pen, the first contact on or near a pin starts the route immediately. Slight movement before lifting does not discard that pin. Drag directly to a different pin and lift to complete, or lift over empty paper and continue with normal waypoint/target taps. A touched target pin is retained through release jitter. Cancelled first contacts and window blur restore the previous draft without creating a connection or Undo step. Select/Pan gestures keep their existing behavior. Choose **Pan** to move the view with one finger, Pencil or mouse, including when starting on a component. Two fingers pan and zoom in every tool around their midpoint; an unfinished finger edit is cancelled before navigation begins. Over the drawing, **mouse wheel / two-axis trackpad scrolling** pans vertically and horizontally. **Shift+wheel** pans horizontally on a conventional mouse. Line/page wheel units are normalized; sidebars keep their own normal scrolling. **Ctrl/⌘+wheel** still zooms around the cursor. View navigation pauses during an object/stroke/resize gesture, while a dialog is open, and during PDF export. Navigation does not change the project or add undo steps. Zoom buttons and Ctrl/⌘+wheel preserve the position under the view centre/cursor. Finger contacts on the paper are ignored while a Pencil gesture is active. **Cancel** abandons a pending placement or drawing tool.

**SpaceMouse:** choose **3D** in the floating zoom controls at the bottom right, then **Connect**. Leitwerk connects to the installed **3DxWare Navigation Library Server**, using the **3DconnexionJS 0.8.0 browser client bundled with Leitwerk**. The JavaScript loads from Leitwerk itself, not from a presumed JavaScript endpoint on the local driver. This is model-independent, including SpaceMouse Pro and other models supported by that driver; it is not a raw-HID or gamepad mapping. Close the dialog to pan/zoom the current drawing, cover or generated list. The sheet stays flat (rotation is locked), and navigation also works in viewer/revision views. The driver exposes **Fit sheet** as a configurable button action. Inputs, dialogs, inactive browser windows and unfinished pointer edits suspend device navigation. **Disconnect** releases the controller; connection errors show a retryable explanation. No driver probe or SDK request occurs until Connect is selected, and no project schema/geometry/history changes are involved.

Install/update the desktop 3Dconnexion driver with its Navigation Library Server. Browser support depends on that driver/server and its local certificate; allow local-network access for Leitwerk if the browser requests it. This path targets driver-supported desktop systems such as Windows and macOS; Linux, iPad and browsers without access to that driver are not promised native SpaceMouse support. Standard mouse/trackpad and touch navigation remain available independently. The connection first loads the local browser library, then checks the navigation endpoint with the SDK’s JSON Accept header, then creates the secure WAMP controller. Errors identify the failed stage (**browser library**, **local service**, **secure connection** or **navigation controller**) instead of reporting every failure as a missing driver. A manual address-bar request may show **Illegal request-target**; the app uses the SDK request format. Numeric and numeric-string advertised ports are accepted. SDK 0.8.0’s accompanying requirements list Windows 3DxWare 10.8.12 or newer; this is a published minimum, not certification of a particular driver/hardware combination. The protocol test uses the unmodified shipped client with real HTTPS discovery and WSS/WAMP messages against a local test service. **Physical SpaceMouse hardware / the installed Windows driver has not been tested here**. See [3Dconnexion’s browser integration guidance](https://forum.3dconnexion.com/viewtopic.php?t=53728) and [official JavaScript sample](https://3dconnexion.com/technical_support/web_threejs.html).

**Library → Annotations → Image** inserts a public image URL on a drawing sheet or the **title/cover sheet**. The Image action is kept in Annotations, outside the upper toolbar. On the cover, new images start near the upper-right corner and can be freely repositioned; generated project text remains in place. Choose a direct HTTPS PNG, JPEG, WebP or GIF link (up to **5 MB / 16 megapixels**); the host must permit cross-origin access. GIFs use a still frame. Projects, cloud synchronization and revisions store **only the URL, name, dimensions and placement**, with no image upload or Base64 data in the JSON. Drag images in Select, resize with the four corner handles, or use Properties/right-click/hold to edit the URL and millimetre dimensions. Aspect ratio is locked by default. Rotation/reflection, multi-selection/movement, clipboard, Delete and Undo/Redo also apply. Images are annotations and do not appear as devices or materials. Cover images use the same selection, movement, corner resizing, Properties, clipboard, Delete and Undo/Redo controls as drawing images. They remain on the title sheet when generated lists are rebuilt and survive JSON reopening, cloud synchronization, project copies and revision snapshots. Export PDF embeds a local image copy (resampled to at most 1600 pixels on its longest side), while schematic text and lines stay vector. Unavailable, unsupported or access-blocked images stop PDF export with an error instead of silently producing an incomplete document. Remote images can change or disappear; a released revision freezes the URL/placement, **not the remotely hosted image**. Archive its PDF for a fixed visual copy. Local/browser caching does not guarantee offline availability after reopening.

**Red pen** keeps its name and opens a separate annotation mode with its own tool row. **Draw** uses the red pen; **Yellow**, **Blue** and **Green** use broad transparent highlighters (16 drawing units wide, versus 2 for the red pen). Each colour has its own layer. **Layers** shows visibility controls; hidden layers are excluded from selection, whole-stroke erasing and PDF output. Choosing a colour shows its layer again. Visibility is a workspace view setting, while JSON always retains every stroke. **Draw** creates a freehand red stroke per gesture, without snapping, using a finger, Pencil or mouse. **Erase stroke** removes each whole stroke touched or crossed by the eraser. **Select strokes** selects visible strokes by tap or selection box; drag a selected stroke to move the selection, or drag a corner to scale it uniformly. **Smaller** and **Larger** scale selected strokes to 80% and 125%; **Delete strokes** removes the selection. Ctrl/⌘+A selects all visible strokes in this mode. Drawing, erasing, moving and scaling each undo as one gesture. Esc cancels an unfinished gesture; otherwise it exits Red pen. Starting two-finger navigation cancels an unfinished finger mark or erasure. Annotations belong to drawing sheets and leave electrical objects alone; select **Select**, **Connect**, **Pan** or **Red pen** again to leave the mode.

**Full screen** uses the browser's fullscreen API when available and keeps both side panels visible. **Exit…** asks before leaving. The drawing view refreshes after fullscreen and viewport size changes while keeping its zoom and position. Safari zoom gestures on the paper are handled inside the editor. If the browser nevertheless exits native fullscreen, the focus view, drawing position and document remain in place; **Resume full screen** re-enters with a fresh tap. Browser/iPadOS system gestures cannot be locked by a web page. For a stable iPad app window without Safari's fullscreen controls, use **Safari → Share → Add to Home Screen**, then launch Leitwerk from that icon. The checked-in manifest and Apple icon enable standalone display; this does not add offline caching.

- Choose **Generic** for dummy symbols or **Products** for manufacturer-specific components in the library. Expand a folder, then click a component to insert it or drag it onto the sheet. The shared search stays at the top of the sidebar and searches names, models and manufacturer/article numbers in the selected view. Without `*`, it finds any matching substring. Use `S201*` for a prefix, `*0074` for an ending, `*024*` for a middle section, or `60.*.024.*` for several unknown sections. Searches ignore case; other punctuation is literal. Symbols and terminals follow the 4 mm grid; hold **Alt** for a temporary 2 mm grid. Toggle grid visibility with **Grid**.
- Select **Connect**, click/tap a terminal or existing connection, choose intermediate grid points, and finish at another terminal or connection. The same button changes to **Wire** at normal terminals, **Fiber** at orange optical ports or **Bridge** at brown bridge ports/existing bridges. Bridge ports connect only to bridge ports in the same terminal strip; ordinary ports create conductors. Routes are orthogonal by default. Hold **Shift** while choosing a point, or enable **45°** beside Connect on a tablet, to draw diagonally with an axis-aligned remainder when needed to reach the exact target. Moving a component stretches its attached sections and adjusts adjacent bends while leaving the rest of the route in place. Drag wire sections perpendicular to their direction, including diagonal sections.
- Right-click a symbol, device-tree entry or terminal-list row to edit its properties. Device Designations, values, AKS, pins and references each have a visibility switch beside the corresponding field. Device Designation and displayed label use the same value. Text remains upright and unmirrored above the symbol, ordered AKS → Device Designation → page-reference links → device type/electrical value. Links sit above the type, with additional spacing to avoid overlap. Pin labels grow outward from the connection point, so long pin names do not extend into the component; their alignment follows rotated or mirrored ports while the text stays readable.
- Connections use **#B62400** in the drawing and PDF, independently of conductor colour codes or designations. This includes wires, terminal bridges, fiber links, junction dots, open-end outlines and cable conductor marks. Fiber links keep their long dashes and bridges their thicker lines. Blue drawing labels, pin numbers and references use **#0000FF**. Conductor colours remain material data in properties/lists.
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

Use **Generic → Connections → Fiber optic device / patch panel** for configurable optical equipment. Port-block properties expose **Port media (wire/fiber, semicolon separated)** alongside port names/sides; changing a wired port's medium is blocked. A single fiber can remain an independent connection, with optional fiber type in its properties. For several fibers, create a cable with **Medium → Fiber optic** and an optional fiber type (e.g. OS2/OM3), then name, add, remove and assign its individual fibers like copper conductors. Optical cables do not require a copper cross-section or shielding. The cable slash and cable/fiber caption remain visible. Copper and fiber cable assignments must match the connection medium. Cable/connection pages and CSV include all media, bridges and open connections.

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

**Connect** automatically creates a thicker bridge when starting at a brown bridge port. Bridges appear graphically in terminal lists. Bridge text is hidden when its straight section has insufficient room, and reappears when the section becomes long enough. The bridge and its connection data remain intact; select its line and use **Properties** to edit it when the text is hidden. Other conductor labels retain their white background and align automatically with the horizontal or vertical section on the grid. Previously saved bridges on regular pins remain readable and editable.

Relays provide a vertical complete symbol, a rectangular coil and independently placeable contact slaves. Generic relays have three changeover contacts; manufacturer family templates can have one, two or three. Links on the complete symbol open/place the sub-symbols, and sub-symbol references return to the complete symbol. All share its equipment tag.

Placed separate terminal pins leave the main symbol's terminals available. Reciprocal live references use **/0003.A3** notation throughout the application. Source and destination arrows can be paired in properties. Click a reference or press **J** to jump to its target. Stacked terminals of the same strip suppress repeated AKS/equipment tags; the terminal type repeats at the top of a stack and at each type change. References to separately placed pins on lower terminals move above the first terminal in the stack, retain their pin identifiers and remain clickable. In the text above a symbol, links appear before the Device Type, from top to bottom. Only the first terminal's designation/AKS block moves up to make room for collected links; its type remains the last line nearest the symbol. Type captions on lower terminals stay at their original symbols, including mixed-type stacks and multiple separately placed pins.

## Manufacturer libraries

**262 reference entries in eight libraries** are bundled with v1.40.0. Each manufacturer or board collection has a separate editable JSON source:

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

Optional `attributes.loadModel` declares a versioned **schematic** calculation model: `portNames`, alternative `inputs` (two-/three-terminal groups), `groups` (equivalent rail terminals), `outputs` (`dc`, `ac1`, `ac3` pole mappings) and `scope`. Indices refer to the template's named ports, not a claim of verified physical numbering. Models are copied with new placements; existing placements without a snapshot use the current matching library model without rewriting the project. Port names must match unambiguously; changed/unknown names require an explicit override. GPIO, bus and optical ports are not inferred as power inputs. Models provide no guessed consumption, efficiency or supply-compatibility certification. The library builder validates all models and generates `libraries/catalog.js`.


## Documents and project files

The document automatically maintains a cover, table of contents, drawing sheets, device lists, terminal lists, cable lists and a connection list. Device lists start directly with the table, without the automatic-directory/generated-master headings. All columns wrap long text, including types, electrical values and unbroken material numbers. Row heights follow their contents; additional pages and marked continuations preserve oversized entries. Compact pages keep up to 22 rows. Cable and connection lists use the same measured wrapping, variable row heights and marked page continuations. Their duplicate large headings and explanatory subtitle are omitted; cable identifiers, properties and material data remain compact above the conductor table. Long endpoint names and cable/conductor identifiers wrap within their columns. The same layouts and clickable references are preserved in vector PDF export. Generated device-directory pages include only top-level masters (including independent devices); their slaves remain in the device overview, detailed **Lists** tables/CSV and terminal lists. A missing parent makes a device an independent entry. Each terminal strip starts a new list page. Page numbers always use four digits and appear separately from the sheet title. New drawings default to **Schematic**; automatic sheet titles do not contain page numbers. Existing user-entered titles stay unchanged. The drawing head has a prominent **Sheet title** cell and four compact approval cells for **Issued**, **Check 1**, **Check 2** and **Release**, each with a name and date on every page. Edit document metadata with **Project info** and sheet titles with **Page properties**. Dates entered in the approval fields use `YYYY-MM-DD`. Issued falls back to the older Drawn by/Date fields when blank. The optional metadata keys are `issuedName`/`issuedDate`, `check1Name`/`check1Date`, `check2Name`/`check2Date`, and `releaseName`/`releaseDate`. **Lists** opens live tables and CSV download. **Export PDF** downloads the complete document as an A4 landscape **vector PDF**, independently of screen zoom/pan. Text stays selectable/searchable with embedded DejaVu Sans fonts; symbols, connections and review strokes remain vector lines. The drawing grid and editing overlays are automatically omitted. Internal links remain clickable: source/destination references, relay and terminal references, contents, directory/list rows and the previous/next sheet numbers. Destinations use the physical PDF page and drawing location, including when sheet numbers have gaps. Missing/unplaced targets have no active link. Export restores the current view, sheet, selection and grid setting afterward. The renderer and fonts are bundled locally; exporting needs no external service or CDN.

The cover body omits its former standalone **Date** row. Approval names/dates still appear in the shared title block. Printed format/raster captions are removed. **Leitwerk Version 1.40.0** sits beside **Company**. The drawing title block has **two main rows**. At the bottom right, **PREVIOUS**, **CURRENT**, **NEXT** and **TOTAL** each have their own cell, with the heading above its value. Page identifiers remain four digits; **TOTAL** uses the actual document size as plain text, for example **7 SHEETS**. Numbering gaps do not affect this count. PREVIOUS/NEXT follow document order and show `—` at the boundaries. These fields update after generated-page pagination and are included in PDF export.

**Save** saves JSON and **Open** reloads it. Projects retain `appVersion`, metadata, sheets, parts, wire endpoints (`a` / `b`), ordered route `points: [{x,y}]`, labels, transformations, placement state, hierarchy and references. Manufacturer products add a `manufacturer` and `catalog` object to the existing part format; normal `manufacturerNumber`, `sapNumber`, `pinNumbers`, `masterId`, `terminalType` and `value` fields remain editable. Existing projects without these optional fields remain readable. User-entered text is preserved as entered; the application UI, generated headings and default text are English.

Optional `projectInfo.coverImages` stores title-sheet image placements in the same format as drawing parts with `type: "image"`. The generated cover page itself still has empty serialized `parts`; rebuilding generated pages restores its images from this metadata. Cover image IDs must be unique across the whole project. Projects without cover images need no additional field.

Drawing sheets may also contain `redlines: [{id, points: [{x,y}], layer?}]`, with `layer` set to `red`, `yellow`, `blue` or `green`. Missing layers retain the original red-pen appearance. These freehand points use the same paper coordinates as the schematic, independently of screen zoom. Old projects without `redlines` need no migration. Annotations survive JSON roundtrips, sheet changes and undo/redo, and appear in their layer colours/transparency in PDF exports without selection boxes or handles. They do not add entries to device, terminal or connection lists.

## Shortcuts

This list covers the implemented application shortcuts. **Ctrl/⌘** means **Ctrl** on Windows/Linux or **Command (⌘)** on macOS; **Alt** corresponds to **Option (⌥)** on a Mac. Focus the drawing workspace before using its shortcuts. Inputs retain normal text-editing commands. Editing commands require an editable drawing; cloud viewers and saved/released revision views are read only.

[Main editor](#main-editor-keyboard) · [Selection and pointer shortcuts](#selection-and-pointer-shortcuts) · [Red Pen](#red-pen-shortcuts) · [Forms and links](#forms-and-keyboard-navigation) · [iPad/Pencil gestures](#ipad-and-pencil-gestures) · [Separate symbol editor](#symbol-editor-keyboard)

### Main editor keyboard

| Shortcut | Action and scope |
| --- | --- |
| **V** | Switch to **Select**; cancel an unfinished connection, placement or drawing tool. |
| **C** or **W** | Switch to **Connect**. The starting port/connection determines wire, bridge or fiber. |
| **R** | Rotate the currently selected symbol by 90°. |
| **X** | Mirror the currently selected symbol horizontally. |
| **Y** | Mirror the currently selected symbol vertically. |
| **T** | Insert a text annotation through the text prompt. |
| **J** | Follow the selected object's reference target. Otherwise open **Go to sheet**; an unassigned source/destination reference asks for its target to be configured first. |
| **Page Up** | Previous sheet, stopping at the first sheet. |
| **Page Down** | Next sheet, stopping at the last sheet. |
| Hold **Alt / Option** | Temporarily use the 2 mm grid instead of 4 mm. Release to restore 4 mm. |
| Hold **Shift** while connecting | Allow a 45° leg for a wire, fiber or bridge; an axis-aligned remainder can still be needed to reach the exact port. |
| **Ctrl/⌘+A** | Select placed symbols/text/references, valid connections, junctions and open ends on the current drawing sheet. Fields and Red Pen strokes are not included in this electrical selection. |
| **Ctrl/⌘+C** | Copy the currently selected symbol/text/reference into the editor clipboard. |
| **Ctrl/⌘+X** | Cut that object; attached connections remain as open ends. |
| **Ctrl/⌘+V** | Paste the editor clipboard, including onto another drawing sheet. A copy receives a new identity; a cut retains its identity for its first paste. |
| **Ctrl/⌘+Z** | Undo a document change or completed gesture. |
| **Ctrl/⌘+Y** or **Ctrl/⌘+Shift+Z** | Redo. |
| **Delete** or **Backspace** | Unplace selected electrical devices, or remove selected text/references, Fields, whole connections, junctions or open ends. Deleting a junction/end removes its attached connections; deleting a Field preserves its contents. |
| **Esc** | Cancel an unfinished gesture/connection/placement or close the active property dialog. In the drawing, also clear the selection and return to Select. Cancelling a drag restores its initial geometry. |

**R/X/Y and the clipboard act on the current individual symbol**, not on every object in an area selection. Group movement, common-property editing and deletion use the selection tools. A selection containing only individual line segments cannot delete the whole connection: double-click the connection first. Incoming cloud document changes clear local Undo/Redo so an older local snapshot cannot undo another device's work.

### Selection and pointer shortcuts

These actions refer to the main schematic editor. A click can be a mouse click or a tap where the active tool supports it.

| Input | Action |
| --- | --- |
| Click a symbol, junction, open end or Field border/heading in **Select** | Select that object. |
| Drag empty paper in **Select** | Draw a selection box. Enclosed connection legs can be selected independently; fully enclosed routes are selected as whole connections. |
| **Ctrl/⌘+click** a symbol/pin in **Select** | Toggle it in the selection **and** reveal the clicked device/pin in **Devices**. Existing additive selections remain. |
| **Ctrl/⌘+click** a junction or open end in **Select** | Add/remove that item from the selection. |
| Click a connection leg in **Select** | Select one straight segment. |
| **Ctrl/⌘+click** a connection leg in **Select** | Add/remove that segment, including several segments of the same connection. |
| Double-click / double-tap a connection in **Select** | Select the entire logical connection across its split sections; other branches stay separate. |
| **Ctrl+Alt+click / Command+Option+click** a symbol/pin | Reveal it in **Devices**, without the additive-selection toggle. |
| **Ctrl+Alt+click / Command+Option+click** a cable-assigned route | Reveal its cable/conductor/fiber in **Cables**. |
| **Ctrl/⌘+click** a cable caption | Reveal its assigned conductor/fiber in **Cables**. |
| Right-click a symbol, device entry, terminal-list row, connection, junction or Field | Open the corresponding properties. |
| Double-click a symbol | Quick-edit its Device Designation/text and value. Right-click opens the full property form. |
| Double-click a connection label or junction | Open its properties. |
| Click a page/reference link | Follow its target. Relay links can also place an unplaced coil/contact. |
| Double-click empty paper in **Connect** | Finish the current route with an open end; without a pending route, start a provisional free end. Single clicks still add route points. |
| Mouse wheel / two-axis trackpad scroll over the drawing | Pan vertically/horizontally; sidebars retain normal scrolling. |
| **Shift+mouse wheel** over the drawing | Pan horizontally on a conventional mouse. |
| **Ctrl/⌘+mouse wheel** over the drawing | Zoom around the cursor. |
| Middle-button drag | Pan the drawing without moving objects. |

### Red Pen shortcuts

Choose **Red pen** in the toolbar first. These commands apply to annotations, not to electrical devices.

| Shortcut / gesture | Action |
| --- | --- |
| **Ctrl/⌘+A** | Select all strokes on visible annotation layers and switch to **Select strokes**. |
| **Shift+click** a stroke in **Select strokes** | Add/remove the stroke from the selection. |
| **Shift+drag** an empty-paper selection box in **Select strokes** | Add intersecting visible strokes to the current selection. |
| **Delete / Backspace** | Delete selected whole strokes. |
| **Ctrl/⌘+Z** | Undo a completed annotation gesture. |
| **Ctrl/⌘+Y** or **Ctrl/⌘+Shift+Z** | Redo it. |
| **Esc** during drawing, erasing, moving or scaling | Cancel the gesture and restore its starting state. |
| **Esc** while no gesture is active | Leave Red Pen mode. |
| **V**, **C/W** or **T** | Leave Red Pen and select the corresponding main-editor tool. |
| Drag in **Draw / Yellow / Blue / Green** | Add one freehand stroke per gesture. |
| Drag in **Erase stroke** | Remove each whole visible stroke touched or crossed. |
| Drag a selected stroke / a corner handle | Move the stroke selection / scale it uniformly. |
| Two-finger pan/pinch | Navigate; an unfinished finger annotation is cancelled before navigation. |

Brush colours, layer visibility and **Smaller/Larger** use the Red Pen toolbar. There are no dedicated letter shortcuts for individual brushes, Pan, Fields or full screen.

### Forms and keyboard navigation

| Input | Action |
| --- | --- |
| **Tab / Shift+Tab** | Move between focusable fields, buttons and links using normal browser navigation. |
| **Enter** on a focused form submit button or in a submit-ready single-line form | Submit the form, for example sign-in, project creation or a property change. |
| **Arrow Up / Arrow Down** in terminal **Device Type** search | Open/browse the matching terminal types. |
| **Enter** in an open terminal-type result list | Choose the highlighted match; the component form still needs **Apply**. |
| **Esc** in a component property dialog | Close the dialog and discard unapplied changes, including an open type-result list. |
| **Enter** on a keyboard-focusable generated-list/reference/relay link | Follow that link; a focused junction editing target opens its properties. |
| **Left/Right**, **Home/End** on a component settings tab | Switch between **Device** and **Calculation** without submitting the form. |

Use the application buttons for **Save**, **Open**, **Export PDF**, **Grid**, **Pan**, **Field**, **Red pen**, **Full screen** and **Fit/centre**. There are currently no dedicated app mappings for **Ctrl/⌘+S**, **Ctrl/⌘+O**, **Ctrl/⌘+P**, **F11**, **+/-** or arrow-key object movement. The browser/operating system may handle these keys itself. Clipboard operations in the drawing use Leitwerk's object clipboard; they are not a system-clipboard project export.

### iPad and Pencil gestures

| Gesture / control | Action |
| --- | --- |
| Tap a library entry, then the paper | Place a component. |
| Drag sideways from the library or overview | Place/move the item; hold briefly before dragging vertically to preserve scrolling. |
| One-finger/Pencil drag in **Select** | Move an object, connection segment, label or Field handle; empty paper starts a selection box. |
| One-finger/Pencil drag in **Pan** | Pan, including when starting over an object. |
| Two-finger drag / pinch in any tool | Pan / zoom around the fingers' midpoint. |
| Hold an object, or select it and tap **Properties** | Open its properties. |
| Tap ports/lines and route points in **Connect** | Draw a wire, bridge or fiber chosen from the starting port. |
| Pencil/pen contact on a pin in **Connect** | Start immediately, even with small movement before lifting; the nearest pin is used for a slight near miss. |
| Pencil/pen drag from one pin to another in **Connect** | Complete the connection on release; lifting over empty paper keeps the draft for route-point taps. |
| Double-tap empty paper in **Connect** | Start/finish an open connection end. |
| Double-tap a connection in **Select** | Select its whole logical route. |
| **45°** button beside Connect | Tablet alternative to holding Shift for diagonal routing. |
| **Cancel** button | Cancel a pending placement or drawing tool. |
| Floating **− / + / Fit** controls | Zoom out/in or fit and centre the page. |
| Floating previous/next sheet controls | Change sheets; tapping the current sheet indicator opens **Sheets**. |

A hardware keyboard can provide the keyboard shortcuts above when the browser forwards the keys. Pencil gestures ignore stray finger contacts; using **Pan** with the Pencil remains available. For standalone display use Safari's **Add to Home Screen**; browser/system fullscreen gestures cannot be disabled by Leitwerk.

### Symbol editor keyboard

These shortcuts apply only to the separate [symbol editor](symbol-editor.html), not to the main schematic editor.

| Shortcut | Action |
| --- | --- |
| **V** | Select/move a geometry object or terminal. |
| **L** | Draw a line. |
| **B** | Draw a rectangle. |
| **O** | Draw a circle. |
| **P** | Place a named terminal on the 4 mm grid. |
| **T** | Place the text from **Text to insert**. |
| **Ctrl/⌘+Z** | Undo. |
| **Ctrl/⌘+Y** or **Ctrl/⌘+Shift+Z** | Redo. |
| **Delete / Backspace** | Remove the selected geometry object or terminal. |
| **Esc** | Cancel an unfinished gesture, clear selection and return to Select. |

The symbol editor ignores its drawing shortcuts while a form field is focused. Use its buttons to open/save proposal JSON and export an SVG preview. Main-editor clipboard, page-navigation and connection shortcuts do not apply here.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html` | Main application and inline editor logic; extension order matters |
| `styles/workspace.css` | Responsive desktop/tablet workspace and library styling |
| `scripts/workspace-ui.js` | Toolbars, touch/Pencil input, navigation and fullscreen |
| `scripts/connection-graph.js` | Junctions, branch/root routing and route geometry |
| `scripts/cables.js` | Cable/conductor data, assignments and generated connection lists |
| `scripts/linked-images.js` | Validated linked-image loading/cache, URL-only annotations, properties and proportional corner resizing |
| `scripts/spacemouse.js`, `vendor/3dconnexion-0.8.0.min.js` | Optional 3DconnexionJS driver connection, staged diagnostics and flat camera navigation; the pinned browser client is shipped with the app |
| `scripts/red-pen.js`, `scripts/sheet-numbers.js` | Annotation layers and drawing-sheet numbering |
| `scripts/electrical-network.js` | Copper-net and phase inference, conductive templates/overrides, source/return conflicts, terminal/reference aliases and converter isolation |
| `scripts/electrical-demand.js` | Derived converter installed/demand watts, explicit efficiency/fixed loss, upstream propagation, dependency/cycle diagnostics and circuit results without rewriting saved inputs |
| `scripts/electrical-core.js`, `scripts/electrical-ui.js`, `styles/electrical.css` | Explicit DC/AC supplies, device loads, demand/reserve and radial fault scenarios, reports/CSV |
| `scripts/table-layout.js` | Shared measured wrapping and variable-height pagination for device, cable and connection lists |
| `scripts/pdf-entry.js`, `scripts/build-pdf.cjs`, `vendor/pdf.js`, `assets/fonts/` | Local vector PDF renderer, embedded fonts and internal PDF links; rebuild with `npm run build:pdf` |
| `scripts/cloud-projects.js`, `styles/cloud.css` | Sign-in, cloud project overview, sharing, revisions and responsive cloud UI |
| `scripts/cloud-core.js` | Atomic-sheet three-way merge and cloud session synchronization |
| `firebase-config.js`, `firebase/database.rules.json`, `firebase/SETUP.md` | Public Web App settings, database access rules and setup/quotas guide |
| `scripts/firebase-entry.js`, `scripts/build-firebase.cjs`, `vendor/firebase.js` | Pinned Firebase SDK entry, local bundle builder and checked-in browser bundle |
| `firebase.json`, `.github/workflows/cloud-tests.yml` | Local emulator configuration and Firebase/browser CI checks |
| `libraries/*.json` | Editable reference library sources |
| `libraries/catalog.js`, `scripts/build-libraries.cjs` | Generated browser bundle and its build/check script |
| `symbol-editor.html`, `scripts/symbol-editor.js`, `scripts/symbol-format.js` | Separate symbol editor and shared proposal format |
| `tests/*-smoke.cjs` | Browser and interaction regression checks |

## Cloud projects

**Projects** opens the optional Firebase project overview. Sign in on iPad and PC with the same account and open the same cloud project. Finished edits synchronize automatically; different drawing sheets merge, while overlapping sheet changes require review. Zoom, pan and the current sheet remain independent on each device. Local JSON and PDF work without Firebase.

The sign-in window has a dedicated form, password visibility control, a separate password-reset action, pending-request feedback and readable authentication errors. **Projects** always opens the project overview; the footer cloud status opens the current project details. The responsive project overview shows document cards with document numbers and a current-project marker. Its search matches project names, document numbers and project IDs. Search filters loaded project details locally, without additional database reads while typing. The overview checks each saved drawing’s sequence and reads its JSON only when that sequence changed or the number has not been loaded in this session; no new database rules are needed. Search text/focus survive asynchronous metadata updates; late updates do not replace a create/shared-project form. Cloud setup remains available from sign-in and the account toolbar.

To use the project space:

1. Sign in through **Projects**. Use **Forgot password?** if needed; **Cloud setup** edits the browser's connection settings.
2. Choose **New empty project** for one blank drawing sheet, **Save current project to cloud** to keep the drawing open in the editor, **Duplicate** on an existing card to copy its saved working state, or **Open shared project** / **Open**. Creation asks for a project name and an optional document number; the number also remains editable through **Project info**. A duplicate preserves drawing sheets, devices, connections, cables, annotations and project information, with the name/number you choose. It has a new project ID, makes you the owner, and starts with no collaborators or revision history. Unsynchronized changes and historical releases are not copied; the source stays unchanged. Viewers can create their own independent copy of a project they can read. Pending unsynchronized work must be saved or recovered before switching projects. The opened project is marked **Current project**; the editor's own **Save** button still downloads JSON.
3. Open the same project with the same account on iPad and PC. Use **Project / revisions** on the overview or click the footer cloud status for its details.
4. In **Project access**, owners add another account's user ID as **Editor** or **Viewer**. For an existing member, use the dropdown directly beside their ID to switch **Editor ↔ Viewer**; the change saves automatically with **Saving… / Saved** feedback. Failed/offline changes revert to the confirmed role. The owner has a fixed **Owner** label. Membership updates and the affected account's editing permission update live. **Copy my user ID** is in the overview's account toolbar. An account alone does not grant access to another person's project.
5. Use **Save revision / release** for a named immutable snapshot, **Revision history** to open it read only, and **Open working copy** to resume editing. A restore first saves the previous working state as a draft.

Owners manage **Editor / Viewer** access and create immutable **Released** revisions. Editors can save draft revisions. Revision history opens snapshots read only; restoration preserves the previous working copy as a draft. Device recovery stores pending work separately in IndexedDB. Incoming cloud documents clear local Undo/Redo to protect the other device's work.

A Firebase project, email/password Authentication, Realtime Database and the supplied access rules must be configured before cloud features can connect. The hosted app includes the public Web App configuration for `leitwerk-prod-dffe5`. Firebase Authentication and the supplied database rules must still be enabled/published in the owning Firebase Console. No private service-account credentials are shipped. See [Firebase setup and collaboration behavior](firebase/SETUP.md) for exact steps, roles, conflict handling, recovery, data layout and limits.

## Firebase limits and data usage

For the **Spark** plan, the [Firebase pricing table](https://firebase.google.com/pricing) lists the following Realtime Database allowances. They apply to the entire Firebase project/database, shared by all Leitwerk projects and accounts.

| Resource | Spark allowance |
| --- | --- |
| Stored data | **1 GB** |
| Downloads to clients | **10 GB per month** |
| Simultaneous connections | **100**; a connected browser tab/device typically uses one connection |

Realtime Database usage is mainly storage and transferred data, with additional [operation/rate limits](https://firebase.google.com/docs/database/usage/limits). It is not a Firestore-style daily document-read/write allowance. Protocol/encryption traffic also contributes to usage. Check the actual plan and **Realtime Database → Usage** in the owning Firebase Console. Blaze permits more usage with usage-based billing; consult current pricing before changing plans.

Leitwerk currently limits each project/revision snapshot to **4,000,000 JSON string characters**. Named revisions store full snapshots, and synchronization transmits full working states after finished edits. Large projects, many saved revisions and multiple devices therefore consume storage/download allowance even when there are only a few projects. Project search filters already-loaded details locally. Loading the overview checks saved sequences and downloads each working drawing once when its sequence is new or changed to extract its document number; these downloads also count toward usage. Reopening an unchanged overview in the same session reuses the cached number. The app does not have administrative access to account-wide usage metrics; see [Firebase setup, data layout and recovery](firebase/SETUP.md) for details.

## Checks

Browser checks require Node.js, the `playwright` module and Chromium. Use **Node.js 24.12+** and **Java 21+** for the Firebase emulator checks. Install the pinned development dependencies with `npm ci` when preparing a test workspace. These are development dependencies; running the app does not require them. Each browser check starts a temporary local server and closes it and the browser afterward. Run from the repository root:

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
node tests/component-tabs-smoke.cjs
node tests/pin-label-smoke.cjs
node tests/pdf-export-smoke.cjs
node tests/navigation-input-smoke.cjs
node tests/spacemouse-driver-smoke.cjs
node tests/pen-connections-smoke.cjs
node tests/linked-images-smoke.cjs
node tests/device-list-smoke.cjs
node tests/connection-lists-smoke.cjs
node tests/document-navigation-smoke.cjs
node tests/product-loads.cjs
node tests/power-supply-loads.cjs
node tests/power-supply-loads-smoke.cjs
node tests/power-supply-input.cjs
node tests/power-supply-input-smoke.cjs
node tests/product-loads-smoke.cjs
node tests/electrical-network.cjs
node tests/electrical-network-ui-smoke.cjs
node tests/electrical-core.cjs
node tests/electrical-ui-smoke.cjs
node tests/supply-symbol-smoke.cjs
node tests/cloud-local-smoke.cjs
node tests/cloud-ui-smoke.cjs
npm run test:cloud
npm run test:firebase
```

| Check | Main coverage |
| --- | --- |
| `power-supply-input.cjs` / `power-supply-input-smoke.cjs` | Converter installed/demand watts, efficiency/fixed loss, retained load factors, independent reserves, phase/PF/current, cascades/cycles, missing inputs, manual overrides, live desktop/iPad preview, actual rewiring, JSON/history/material preservation, cloud parameter races and CSV/linked vector-text PDF |
| `power-supply-loads.cjs` / `power-supply-loads-smoke.cjs` | Generic/current/legacy product PSU outputs, automatic Beckhoff/lamp consumers, missing consumption, AC/DC separation, output aliases, custom source settings, source conflicts, real rewiring and source re-placement, persisted disable/re-enable, material/JSON/history, cloud model races and linked PDF on desktop/iPad |
| `component-tabs-smoke.cjs` | Desktop/iPad Device and Calculation tabs, retained drafts, combined Apply/Cancel and history, hidden-field validation, direct calculation entry, supply shortcut, keyboard and narrow layout |
| `connection-lists-smoke.cjs` | Compact cable/connection tables, retained cable metadata, long endpoint/identifier wrapping and continuations, bounded screen/PDF cells, copper/fiber/bridges, empty/unassigned conductors and retained links on desktop/iPad |
| `device-list-smoke.cjs` | Wrapped cell/page bounds, variable row heights and pagination, very long values and material IDs, retained links and complete vector-PDF text on desktop/iPad |
| `pen-connections-smoke.cjs` | Native browser pen contact/jitter, immediate first-pin start, pin-to-pin drag, waypoint continuation, near-pin snapping, cancellation/blur/Escape, one-step history, media/strip validation, existing open-end continuation and preserved Select/Pan |
| `spacemouse-driver-smoke.cjs` | Unmodified SDK hash, real HTTPS/WSS/WAMP handshake and RPCs, app-hosted library (local script URL deliberately unavailable), SDK request headers, numeric-string ports, orthographic callbacks/transactions/frames/Fit, staged failures and retry; simulated driver service, no physical hardware claim |
| `navigation-input-smoke.cjs` | Native two-axis/Shift wheel pan, normalized line/page units, anchored zoom, sidebar/modal/drag isolation, unchanged history/document, optional driver connection/error/retry/disconnect, simulated orthographic camera/transactions/focus/frames/rotation lock/Fit/fullscreen; no physical hardware certification |
| `linked-images-smoke.cjs` | URL/content/CORS validation, cancelled loading, native iPad movement/resize, properties/history/clipboard, title-sheet images and generated-page rebuilding, lightweight JSON, device/BOM exclusion, embedded cover/drawing PDF images and explicit unavailable-image failures |
| `pdf-export-smoke.cjs` | Independent PDF.js inspection of real exported files: selectable Unicode text, vector paths without images, internal links across numbering gaps, transparent highlights, LWL dashes, grid-free output, failed-load retry and preserved desktop/iPad state |
| `pin-label-smoke.cjs` | Long pin labels outside device bodies through rotation/reflection, zoom, desktop/iPad properties, history and PDF |
| `cloud-local-smoke.cjs` | Offline/local workflows, optional Firebase setup and public defaults initializing with production network access blocked |
| `cloud-core.cjs` | Atomic-sheet merging, explicit conflicts, offline retention, gesture deferral and edits during in-flight synchronization |
| `firebase-cloud.cjs` / `npm run test:firebase` | Real local Auth/Realtime Database emulators: access rules, role enforcement, independent PC/iPad sessions, conflict choices, offline recovery, sharing, immutable revisions and JSON/PDF |
| `cloud-ui-smoke.cjs` | Desktop/iPad/phone sign-in/project layout, password visibility/reset, delayed authentication failures and duplicate submits, escaped card titles, local search/focus, form/metadata races, current project and overflow |
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

The SpaceMouse protocol check needs `openssl` and an unused `127.51.68.120:8181` for its local test service. It creates temporary self-signed certificates and relaxes certificate checks only inside its isolated Playwright test context; the production app uses normal browser TLS checks.

Screenshots and PDFs are written under `/tmp`, outside the repository. The dedicated PDF check parses actual exported documents with PDF.js, verifies A4 landscape page sizes, extracts text, checks vector operators and link destinations, and compares grid-on/grid-off exports. The bundled DejaVu fonts retain their license in `assets/fonts/LICENSE-DejaVu.txt`; JavaScript notices are in `vendor/pdf.js.LEGAL.txt`. The manufacturer `file://` check explicitly skips when Chromium administrator policy blocks local-file navigation; HTTP checks still run.

The Firebase CI workflow runs the cloud core, local/cloud UI and pin-label checks, PDF file inspection, deterministic SDK/PDF bundle builds and Auth/Realtime Database emulator checks against **demo-leitwerk**. These checks do not modify the production Firebase database. Deployment of the supplied access rules and console-side account/API configuration are separate setup steps.

### 3Dconnexion browser client attribution

3D input device development tools and related technology are provided under license from 3Dconnexion. © 3Dconnexion 1992 - 2021. All rights reserved. The unmodified minified 3DconnexionJS 0.8.0 client retains its bundled third-party notices; its SDK license is included at [`vendor/3dconnexion-SDK-LICENSE.txt`](vendor/3dconnexion-SDK-LICENSE.txt). Source snapshot: [3DxWare SDK browser sample](https://github.com/Akwaland/3DxWareSDK/blob/f8cbba96f4ece95de5b2445b420800edfc6657ee/web/samples/scripts/3dconnexion.min.js), SHA-256 `35bd5fc592b23c3d2ddbe3af1382611656c0db8cca60364d90f6d35589b4152d`. The SDK remains under its own license.
