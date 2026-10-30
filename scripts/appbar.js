/* Keep existing controls and their handlers, grouped by purpose. */
globalThis.CabelAppbar={init(){
 const $=s=>document.querySelector(s),tools=$('.workspace-appbar .tools');
 function group(label,ids,className=''){const g=document.createElement('div');g.className='appbar-group '+className;g.setAttribute('role','group');g.setAttribute('aria-label',label);for(const id of ids){const b=$('#'+id);if(b)g.append(b);}tools.append(g);return g;}
 group('Project',['cloudProjectsBtn','projectInfoBtn','autoLists','calculationsBtn']);
 group('Files',['openBtn','saveBtn','exportBtn','fileInput']);
 group('View',['schematicSearchBtn','phoneViewerToggle','fullscreenBtn','exitFullscreenBtn','settingsBtn'],'appbar-view');
 const account=$('#workspaceAccount');if(account)$('.workspace-appbar').append(account);
 tools.setAttribute('role','group');tools.setAttribute('aria-label','Project, files and view');
 const save=$('#saveBtn');save.replaceChildren(document.createTextNode('Save'));$('#openBtn').replaceChildren(document.createTextNode('Open'));
 for(const id of['schematicSearchBtn','phoneSearchBtn']){const button=$('#'+id),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('control-icon');path.setAttribute('d','M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0');svg.append(path);button.prepend(svg);}
 const toolbar=$('#workspaceToolbar'),history=toolbar.querySelector('[aria-label="History"]'),drawing=toolbar.querySelector('[aria-label="Drawing tools"]'),oldSelection=toolbar.querySelector('[aria-label="Selection actions"]');
 function drawingGroup(label,ids){const g=document.createElement('div');g.className='tool-group';g.setAttribute('role','group');g.setAttribute('aria-label',label);for(const id of ids)g.append($('#'+id));return g;}
 drawing.append($('#cancelActionBtn'));
 const annotations=drawingGroup('Annotations',['textBtn','redPenTool']),transform=drawingGroup('Properties and transform',['propertiesBtn','rotateBtn','mirrorXBtn','mirrorYBtn']),clipboard=drawingGroup('Clipboard and delete',['copyBtn','cutBtn','pasteBtn','deleteBtn']),sheet=drawingGroup('Sheet display',['pagePropertiesBtn','gridToggle']);
 toolbar.append(history,drawing,annotations,$('#redPenTools'),$('#multiConnectControls'),transform,clipboard,sheet);oldSelection.remove();
 document.body.classList.add('appbar-ready');
}};
