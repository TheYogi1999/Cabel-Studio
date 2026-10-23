/* Responsive chrome and pointer gestures. No document-format fields live here. */
globalThis.CabelWorkspaceUI = {
  init(api) {
    const $ = selector => document.querySelector(selector);
    const app = $('.app'), header = $('header'), main = $('main'), svg = api.svg;
    const compact = matchMedia('(max-width:1279px), (pointer:coarse)');
    const appbar = document.createElement('div');
    appbar.className = 'workspace-appbar';
    appbar.append(...header.children); header.append(appbar);
    const toolbar = document.createElement('div');
    toolbar.id = 'workspaceToolbar'; toolbar.className = 'workspace-toolbar';
    toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', 'Drawing and editing');
    const utility = document.createElement('div'); utility.className = 'workspace-utility';
    header.append(toolbar, utility);
    const group = label => {
      const node = document.createElement('div'); node.className = 'tool-group';
      node.setAttribute('role', 'group'); node.setAttribute('aria-label', label); toolbar.append(node); return node;
    };
    const button = (id, label, title, parent, action) => {
      const node = document.createElement('button'); node.type = 'button'; node.id = id;
      node.className = 'tool-button'; node.textContent = label; node.title = title || label;
      node.setAttribute('aria-label', title || label); if (action) node.onclick = action;
      parent.append(node); return node;
    };
    const modes = group('Drawing tools');
    modes.append($('#selectTool'), $('#wireTool'), $('#bridgeTool'), $('#aksAreaTool'));
    for (const node of modes.children) node.classList.add('tool-button');
    $('#bridgeTool').textContent = 'Bridge'; $('#aksAreaTool').textContent = 'Field';
    let hand = false, touchEdit = false, placement = null, placementPointer = null;
    const handButton = button('panTool', '✥ Pan', 'Pan the drawing with a mouse, finger or Pencil', modes, () => {
      hand = !hand; placement = null; api.cancel(); refresh();
    });
    const touchButton = button('touchEditToggle', 'Touch edit', 'Enable finger editing; switch off for finger pan and pinch zoom', modes, () => {
      touchEdit = !touchEdit; refresh();
    });
    touchButton.hidden = !(navigator.maxTouchPoints || matchMedia('(any-pointer:coarse)').matches);
    const editing = group('Selection actions');
    const properties = button('propertiesBtn', 'Properties', 'Edit selection or page properties', editing, () => api.editSelection());
    for (const [id, label, title, action] of [
      ['rotateBtn', '↻ Rotate', 'Rotate selection by 90°', 'rotate'],
      ['mirrorXBtn', '↔ Mirror', 'Mirror horizontally', 'flipX'],
      ['mirrorYBtn', '↕ Mirror', 'Mirror vertically', 'flipY'],
      ['copyBtn', 'Copy', 'Copy selection', 'copy'], ['cutBtn', 'Cut', 'Cut selection', 'cut'],
      ['pasteBtn', 'Paste', 'Paste copied object', 'paste'], ['deleteBtn', 'Delete', 'Remove selection from the drawing', 'delete']
    ]) button(id, label, title, editing, () => api.action(action));
    const history = group('History and annotations');
    const undo = button('undoBtn', '↶ Undo', 'Undo last change', history, () => api.action('undo'));
    const redo = button('redoBtn', '↷ Redo', 'Redo last change', history, () => api.action('redo'));
    button('textBtn', 'Text', 'Insert text annotation', history, () => api.action('text'));
    const cancel = button('cancelActionBtn', 'Cancel', 'Cancel placement or current drawing tool', history, () => {
      placement = null; placementPointer = null; hand = false; api.cancel(); refresh();
    });
    toolbar.prepend(history);
    // Move the existing controls so their handlers and keyboard shortcuts stay intact.
    api.nav.append($('#pagePropertiesBtn'), $('#projectInfoBtn'), $('#autoLists'));
    utility.append(api.nav, $('.zoom-controls'));
    $('#sheetPrev').title = 'Previous sheet'; $('#sheetPrev').setAttribute('aria-label', 'Previous sheet');
    $('#sheetNext').title = 'Next sheet'; $('#sheetNext').setAttribute('aria-label', 'Next sheet');
    $('#sheetCurrent').title = 'Show sheets'; $('#sheetCurrent').setAttribute('aria-label', 'Show sheets');
    $('#fitBtn').title = 'Fit the whole page'; $('#fitBtn').setAttribute('aria-label', 'Fit the whole page');
    $('#saveBtn .wide').textContent = 'Save';
    const tools = $('.tools');
    const libraryButton = button('libraryToggle', 'Library', 'Show or hide the component library', tools, () => setPanel('library', !panelOpen('library')));
    const overviewButton = button('overviewToggle', 'Overview', 'Show or hide sheets and devices', tools, () => setPanel('overview', !panelOpen('overview')));
    libraryButton.setAttribute('aria-controls', 'componentSidebar'); $('.sidebar').id = 'componentSidebar';
    overviewButton.setAttribute('aria-controls', 'sheetPanel');
    tools.prepend(libraryButton, overviewButton);
    const fullscreenButton = button('fullscreenBtn', '⛶ Full screen', 'Enter full screen', tools, toggleFullscreen);
    const scrim = document.createElement('button'); scrim.className = 'panel-scrim';
    scrim.type = 'button'; scrim.tabIndex = -1; scrim.setAttribute('aria-label', 'Close sidebar');
    scrim.onclick = closePanels; main.append(scrim);
    const inputHelp = document.createElement('span'); inputHelp.className = 'right';
    inputHelp.textContent = 'Pencil: edit · Fingers: pan / pinch · Hold to edit properties';
    if (navigator.maxTouchPoints) $('footer .right').replaceWith(inputHelp);
    $('.hint').textContent = 'Choose a component, then place it with your Pencil or finger. Hold an object to edit it, or select it and choose Properties. Fingers pan and pinch to zoom; Touch edit enables finger editing. Right-click and keyboard shortcuts also work with a mouse.';
    $('#statusText').setAttribute('role', 'status'); $('#statusText').setAttribute('aria-live', 'polite');
    let focusFallback = false, savedPanels = null;
    function panelOpen(name) { return app.dataset[name + 'Open'] === 'true'; }
    function setPanel(name, open) {
      if (compact.matches && open) app.dataset[(name === 'library' ? 'overview' : 'library') + 'Open'] = 'false';
      app.dataset[name + 'Open'] = String(open); refresh();
    }
    function closePanels() { app.dataset.libraryOpen = app.dataset.overviewOpen = 'false'; refresh(); }
    function resetPanels() {
      app.dataset.libraryOpen = app.dataset.overviewOpen = String(!compact.matches); refresh();
    }
    function fullscreenElement() { return document.fullscreenElement || document.webkitFullscreenElement; }
    function focusView(active) {
      app.classList.toggle('focus-mode', active);
      if (active && !savedPanels) {
        savedPanels = { library: panelOpen('library'), overview: panelOpen('overview') }; closePanels();
      } else if (!active && savedPanels) {
        app.dataset.libraryOpen = String(savedPanels.library); app.dataset.overviewOpen = String(savedPanels.overview); savedPanels = null;
      }
      refresh();
    }
    async function toggleFullscreen() {
      if (focusFallback) { focusFallback = false; focusView(false); return; }
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      const enter = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
      if (fullscreenElement()) {
        if (exit) { try { await exit.call(document); } catch { /* Keep the exit control available. */ } }
      } else if (enter) {
        try { await enter.call(document.documentElement); focusView(Boolean(fullscreenElement())); }
        catch { focusFallback = true; focusView(true); }
      } else { focusFallback = true; focusView(true); }
      refresh();
    }
    document.addEventListener('fullscreenchange', () => focusView(Boolean(fullscreenElement())));
    document.addEventListener('webkitfullscreenchange', () => focusView(Boolean(fullscreenElement())));
    compact.addEventListener('change', resetPanels);

    const touches = new Map(), ignored = new Set(), editingPointers = new Map();
    const pendingControls = new WeakMap(), fallbackClicks = new WeakMap();
    let navigation = null, activePen = null, lastInput = null, hold = null, suppressClick = null, controlContact = null;
    const point = e => ({ x: e.clientX, y: e.clientY });
    const stop = e => { e.preventDefault(); e.stopImmediatePropagation(); };
    const capture = id => { try { svg.setPointerCapture(id); } catch { /* Synthetic pointers have no capture. */ } };
    const release = id => { if (svg.hasPointerCapture(id)) svg.releasePointerCapture(id); };
    const inCanvas = target => target instanceof Element && Boolean(target.closest('#sheet'));
    function centroid() {
      const values = [...touches.values()], count = values.length;
      const p = { clientX: values.reduce((n, v) => n + v.x, 0) / count, clientY: values.reduce((n, v) => n + v.y, 0) / count };
      const a = values[0], b = values[1];
      return { ...api.svgPoint(p), distance: b ? Math.hypot(a.x - b.x, a.y - b.y) : 0 };
    }
    function rebaseNavigation() {
      if (!touches.size) { navigation = null; return; }
      const c = centroid(), view = api.view();
      navigation = { ...view, distance: c.distance, anchor: { x: (c.x - view.pan.x - 564 * (1 - view.zoom)) / view.zoom, y: (c.y - view.pan.y - 399 * (1 - view.zoom)) / view.zoom } };
    }
    function navigate() {
      if (!navigation) return;
      const c = centroid(), z = Math.max(.5, Math.min(4, navigation.zoom * (navigation.distance && c.distance ? c.distance / navigation.distance : 1)));
      api.setView({ zoom: z, pan: { x: c.x - 564 * (1 - z) - navigation.anchor.x * z, y: c.y - 399 * (1 - z) - navigation.anchor.y * z } });
    }
    function clearHold() { if (hold) clearTimeout(hold.timer); hold = null; }
    function startHold(e, checkpoint) {
      if (api.state().mode !== 'select' || api.state().fieldDrawing || placement || hand) return;
      const target = e.target;
      hold = { id: e.pointerId, ...point(e), target, timer: setTimeout(() => {
        const current = hold; if (!current) return; hold = null;
        ignored.add(current.id); editingPointers.delete(current.id);
        suppressClick = { x: current.x, y: current.y, until: performance.now() + 900 };
        api.cancelPointer(checkpoint); api.editTarget(target); release(current.id);
        if (compact.matches) closePanels();
      }, 550) };
    }
    function nearbyTerminal(e) {
      let best = null, distance = e.pointerType === 'touch' ? 22 : 14;
      for (const node of svg.querySelectorAll('.terminal')) {
        if (!api.terminal(node)) continue;
        const matrix = node.getScreenCTM(); if (!matrix) continue;
        const p = new DOMPoint(node.cx.baseVal.value, node.cy.baseVal.value).matrixTransform(matrix);
        const d = Math.hypot(p.x - e.clientX, p.y - e.clientY);
        if (d <= distance) { best = node; distance = d; }
      }
      return best;
    }
    document.addEventListener('pointerdown', e => {
      if (!(e.target instanceof Element)) return;
      lastInput = { type: e.pointerType, target: e.target, at: performance.now() };
      if (!inCanvas(e.target)) {
        const control = e.target.closest('button');
        if (e.pointerType !== 'mouse' && e.button === 0 && control && !control.disabled) {
          const old = pendingControls.get(control); if (old) old.handled = true;
          fallbackClicks.delete(control);
          controlContact = { id: e.pointerId, node: control, type: e.pointerType, ...point(e), moved: false, handled: false };
        }
        if (e.pointerType !== 'mouse' && e.target.closest('.device-jump,[data-right-sheet]')) startHold(e, null);
        return;
      }
      const state = api.state(); if (state.modalOpen || state.exporting || e.button !== 0) return;
      if (e.pointerType === 'touch' && (activePen !== null || editingPointers.size)) {
        stop(e); ignored.add(e.pointerId); return;
      }
      if (e.pointerType === 'pen') {
        activePen = e.pointerId;
        for (const id of touches.keys()) ignored.add(id);
        touches.clear(); navigation = null;
        if (placementPointer?.type === 'touch') { ignored.add(placementPointer.id); placementPointer = null; }
      }
      if (placement && !state.generated) {
        stop(e); clearHold(); capture(e.pointerId);
        if (e.pointerType === 'touch' && (touches.size || placementPointer?.type === 'touch')) {
          if (placementPointer) { touches.set(placementPointer.id, { x: placementPointer.x, y: placementPointer.y }); placementPointer = null; }
          touches.set(e.pointerId, point(e)); rebaseNavigation(); return;
        }
        placementPointer = { id: e.pointerId, ...point(e), type: e.pointerType, moved: false };
        return;
      }
      if (hand || e.pointerType === 'touch' && !touchEdit) {
        stop(e); clearHold(); touches.set(e.pointerId, point(e)); capture(e.pointerId); rebaseNavigation(); return;
      }
      if (e.pointerType === 'mouse') return;
      const checkpoint = api.checkpoint();
      editingPointers.set(e.pointerId, checkpoint); capture(e.pointerId); startHold(e, checkpoint);
      if (state.mode === 'wire' || state.mode === 'bridge') {
        const terminal = nearbyTerminal(e);
        if (terminal) { stop(e); api.connect(terminal); }
      }
    }, { capture: true, passive: false });
    document.addEventListener('pointermove', e => {
      if (ignored.has(e.pointerId)) { stop(e); return; }
      if (controlContact?.id === e.pointerId && Math.hypot(e.clientX - controlContact.x, e.clientY - controlContact.y) > 8) controlContact.moved = true;
      if (hold?.id === e.pointerId && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 8) clearHold();
      if (placementPointer?.id === e.pointerId) {
        stop(e); placementPointer.moved ||= Math.hypot(e.clientX - placementPointer.x, e.clientY - placementPointer.y) > 8;
        if (placementPointer.moved && placementPointer.type === 'touch' && !touchEdit) {
          touches.set(e.pointerId, { x: placementPointer.x, y: placementPointer.y }); rebaseNavigation();
          placementPointer = null; touches.set(e.pointerId, point(e)); navigate();
        }
        return;
      }
      if (touches.has(e.pointerId)) { stop(e); touches.set(e.pointerId, point(e)); navigate(); }
    }, { capture: true, passive: false });
    function finishPointer(e, cancelled = false) {
      if (hold?.id === e.pointerId) clearHold();
      if (activePen === e.pointerId) activePen = null;
      if (controlContact?.id === e.pointerId) {
        const contact = controlContact; controlContact = null;
        if (!cancelled && !contact.moved && !ignored.has(e.pointerId)) {
          pendingControls.set(contact.node, contact);
          // Some pen/touch transitions omit the compatibility click. Let a native
          // click win, then activate once if it never arrives. A new press clears
          // duplicate suppression, so intentional repeated taps still work.
          setTimeout(() => {
            if (contact.handled || !contact.node.isConnected || contact.node.disabled || document.elementFromPoint(e.clientX, e.clientY)?.closest('button') !== contact.node) return;
            pendingControls.delete(contact.node); fallbackClicks.set(contact.node, performance.now() + 800);
            contact.node.dispatchEvent(new PointerEvent('click', { bubbles: true, cancelable: true, pointerId: contact.id, pointerType: contact.type, detail: 1, clientX: e.clientX, clientY: e.clientY }));
          }, 80);
        }
      }
      if (ignored.delete(e.pointerId)) { stop(e); release(e.pointerId); return; }
      if (placementPointer?.id === e.pointerId) {
        stop(e); const gesture = placementPointer; placementPointer = null; release(e.pointerId);
        if (!cancelled && placement && (!gesture.moved || gesture.type === 'pen')) {
          const p = api.world(e);
          if (p.x >= 0 && p.x <= 1128 && p.y >= 0 && p.y <= 710) {
            const chosen = placement; placement = null; api.place(chosen.button, p); refresh();
          }
        }
        return;
      }
      if (touches.delete(e.pointerId)) { stop(e); release(e.pointerId); rebaseNavigation(); return; }
      if (editingPointers.has(e.pointerId)) {
        const checkpoint = editingPointers.get(e.pointerId); editingPointers.delete(e.pointerId);
        if (cancelled) { stop(e); api.cancelPointer(checkpoint); release(e.pointerId); }
      }
    }
    document.addEventListener('pointerup', e => finishPointer(e), { capture: true, passive: false });
    document.addEventListener('pointercancel', e => finishPointer(e, true), { capture: true, passive: false });
    svg.addEventListener('lostpointercapture', e => {
      if (editingPointers.has(e.pointerId)) {
        const checkpoint = editingPointers.get(e.pointerId); editingPointers.delete(e.pointerId);
        if (activePen === e.pointerId) activePen = null;
        clearHold(); api.cancelPointer(checkpoint);
      }
      if (touches.delete(e.pointerId)) rebaseNavigation();
      if (placementPointer?.id === e.pointerId) placementPointer = null;
    });
    document.addEventListener('contextmenu', e => {
      if (inCanvas(e.target) && (activePen !== null || touches.size)) e.preventDefault();
    }, true);
    document.addEventListener('click', e => {
      if (!(e.target instanceof Element)) return;
      const control = e.target.closest('button');
      if (control && e.isTrusted && (fallbackClicks.get(control) || 0) > performance.now()) { stop(e); return; }
      const contact = control && pendingControls.get(control);
      if (contact) { contact.handled = true; pendingControls.delete(control); }
      if (suppressClick && performance.now() < suppressClick.until && Math.hypot(e.clientX - suppressClick.x, e.clientY - suppressClick.y) < 12) { stop(e); return; }
      const entry = e.target.closest('.part[data-type],.catalog-part[data-catalog-product],.part[data-custom-symbol]');
      const pointerType = e.pointerType || (lastInput && performance.now() - lastInput.at < 1000 && (lastInput.target === e.target || entry?.contains(lastInput.target)) ? lastInput.type : 'mouse');
      if (entry && pointerType !== 'mouse' && e.detail !== 0) {
        stop(e); api.cancel(); api.preparePlacement(); hand = false;
        placement = { button: entry, label: entry.querySelector('.part-name,strong')?.textContent || entry.textContent.trim() };
        if (compact.matches) closePanels(); refresh(); return;
      }
      if (e.target.closest('#selectTool,#wireTool,#bridgeTool,#aksAreaTool')) { hand = false; placement = null; queueMicrotask(refresh); }
      if (compact.matches && e.target.closest('[data-right-sheet],.device-jump,.pin-node')) setTimeout(closePanels, 0);
    }, true);
    $('#sheetCurrent').onclick = () => { setPanel('overview', true); $('[data-overview="sheets"]')?.click(); };
    document.addEventListener('keydown', e => {
      if (!api.state().modalOpen && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.closest?.('input,textarea,select,[contenteditable="true"]') && ['v','c','w'].includes(e.key.toLowerCase())) {
        hand = false; placement = null; queueMicrotask(refresh);
      }
      if (e.key === 'Escape') {
        placement = null; placementPointer = null; hand = false; clearHold();
        if (focusFallback) { focusFallback = false; focusView(false); }
        if (compact.matches) closePanels(); refresh();
      }
    }, true);
    window.addEventListener('blur', () => {
      clearHold(); touches.clear(); navigation = null; placementPointer = null; activePen = null; ignored.clear();
      for (const [id, checkpoint] of editingPointers) { api.cancelPointer(checkpoint); release(id); }
      editingPointers.clear();
    });
    function refresh() {
      const state = api.state();
      libraryButton.setAttribute('aria-expanded', String(panelOpen('library')));
      overviewButton.setAttribute('aria-expanded', String(panelOpen('overview')));
      handButton.setAttribute('aria-pressed', String(hand)); touchButton.setAttribute('aria-pressed', String(touchEdit));
      $('#selectTool').setAttribute('aria-pressed', String(state.mode === 'select' && !hand && !state.fieldDrawing));
      $('#selectTool').classList.toggle('active', state.mode === 'select' && !hand && !state.fieldDrawing);
      $('#wireTool').setAttribute('aria-pressed', String(state.mode === 'wire'));
      $('#aksAreaTool').setAttribute('aria-pressed', String(state.fieldDrawing));
      svg.dataset.hand = String(hand); svg.dataset.placement = String(Boolean(placement));
      for (const id of ['rotateBtn','mirrorXBtn','mirrorYBtn','copyBtn','cutBtn']) $('#' + id).disabled = !state.partSelected || state.exporting;
      $('#deleteBtn').disabled = !state.hasSelection || state.exporting; $('#pasteBtn').disabled = !state.canPaste || state.exporting;
      undo.disabled = !state.canUndo || state.exporting; redo.disabled = !state.canRedo || state.exporting;
      properties.disabled = state.generated && !state.hasSelection || state.exporting;
      cancel.hidden = !placement && !state.connecting && !state.fieldDrawing && !hand;
      fullscreenButton.setAttribute('aria-pressed', String(Boolean(fullscreenElement()) || focusFallback));
      fullscreenButton.textContent = focusFallback ? '⛶ Exit focus' : fullscreenElement() ? '⛶ Exit full screen' : '⛶ Full screen';
      fullscreenButton.setAttribute('aria-label', focusFallback ? 'Exit focus view' : fullscreenElement() ? 'Exit full screen' : 'Enter full screen');
      fullscreenButton.title = fullscreenButton.getAttribute('aria-label');
      if (placement) api.status('Tap the drawing to place ' + placement.label + ' · Cancel to finish');
      else if (hand) api.status('Pan mode · Drag to move the view');
    }
    resetPanels(); document.body.classList.add('workspace-ready'); refresh();
    return { refresh, openOverview: () => setPanel('overview', true) };
  }
};
