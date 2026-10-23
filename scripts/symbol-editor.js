(() => {
  const $=s=>document.querySelector(s),NS='http://www.w3.org/2000/svg',canvas=$('#editorCanvas'),format=CabelSymbol;
  let state={kind:'cabel-symbol',schemaVersion:1,units:'mm',id:'user-symbol',name:'New symbol',group:'Switchgear',tagPrefix:'U',defaultValue:'',widthMm:48,heightMm:48,geometry:[],terminals:[]},selected=null,tool='select',gesture=null;
  const undo=[],redo=[],clone=o=>structuredClone(o),snapshot=()=>JSON.stringify(state),status=s=>$('#editorStatus').textContent=s;
  function node(tag,attrs,parent=canvas){const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n}
  const all=()=>[...state.geometry,...state.terminals],find=()=>all().find(o=>o.id===selected);
  function persist(){try{localStorage.setItem('cabel-symbol-draft',snapshot())}catch{}}
  function record(before){if(before===snapshot())return;undo.push(before);if(undo.length>100)undo.shift();redo.length=0;persist()}
  function restore(text){state=format.validate(JSON.parse(text));selected=null;gesture=null;syncFields();render();persist()}
  function history(back){const from=back?undo:redo,to=back?redo:undo;if(!from.length)return;to.push(snapshot());restore(from.pop())}
  function syncFields(){for(const [id,key]of Object.entries({symbolName:'name',symbolId:'id',symbolGroup:'group',tagPrefix:'tagPrefix',defaultValue:'defaultValue',canvasWidth:'widthMm',canvasHeight:'heightMm'}))$('#'+id).value=state[key]}
  for(const group of format.groups){const o=document.createElement('option');o.value=o.textContent=group;$('#symbolGroup').append(o)}
  function readFields(){const next={...state,name:$('#symbolName').value,id:$('#symbolId').value,group:$('#symbolGroup').value,tagPrefix:$('#tagPrefix').value,defaultValue:$('#defaultValue').value,widthMm:+$('#canvasWidth').value,heightMm:+$('#canvasHeight').value};state=format.validate(next)}
  for(const id of ['symbolName','symbolId','symbolGroup','tagPrefix','defaultValue','canvasWidth','canvasHeight'])$('#'+id).onchange=()=>{const before=snapshot();try{readFields();record(before);render();status('Symbol updated')}catch(e){state=JSON.parse(before);syncFields();status(e.message)}};
  function render(){
    canvas.replaceChildren();canvas.setAttribute('viewBox',[-state.widthMm/2,-state.heightMm/2,state.widthMm,state.heightMm].join(' '));
    const defs=node('defs',{}),pattern=node('pattern',{id:'editorGrid',width:4,height:4,patternUnits:'userSpaceOnUse'},defs);node('path',{d:'M 0 4 V 0 H 4',fill:'none',stroke:'#aebfcb','stroke-width':.08},pattern);
    node('rect',{x:-state.widthMm/2,y:-state.heightMm/2,width:state.widthMm,height:state.heightMm,fill:'url(#editorGrid)'});
    node('path',{d:`M ${-state.widthMm/2} 0 H ${state.widthMm/2} M 0 ${-state.heightMm/2} V ${state.heightMm/2}`,fill:'none',stroke:'#aebfcb','stroke-width':.12,'stroke-dasharray':'.4 .5'});
    format.draw(canvas,state);
    for(const t of state.terminals){node('circle',{cx:t.x,cy:t.y,r:.65,fill:'#07977e',stroke:'#fff','stroke-width':.15,'data-object-id':t.id});node('text',{x:t.x,y:t.y-1,'text-anchor':'middle','font-size':1.6,fill:'#2463b5','pointer-events':'none'}).textContent=':'+t.name}
    for(const n of canvas.querySelectorAll('[data-object-id]'))n.classList.toggle('selected',n.dataset.objectId===selected);
    $('#objectList').replaceChildren();
    for(const o of all()){const b=document.createElement('button');b.type='button';b.className='object'+(selected===o.id?' selected':'');b.dataset.objectId=o.id;b.textContent=o.type==='text'?'Text: '+o.text:o.name?'Terminal: '+o.name:o.type;b.onclick=()=>{selected=o.id;render()};$('#objectList').append(b)}
    const form=$('#inspector');form.replaceChildren();const o=find();
    if(o){const keys=o.name?['name','x','y']:({line:['x1','y1','x2','y2'],rect:['x','y','width','height'],circle:['cx','cy','r'],text:['x','y','text','fontSize']}[o.type]);
      for(const key of keys){const label=document.createElement('label');label.textContent=key;const input=document.createElement('input');input.name=key;input.type=typeof o[key]==='number'?'number':'text';input.step=o.name&&['x','y'].includes(key)?'4':'.25';input.value=o[key];label.append(input);form.append(label)}
      const apply=document.createElement('button');apply.textContent='Apply object';form.append(apply);
      form.onsubmit=e=>{e.preventDefault();const before=snapshot();for(const key of keys)o[key]=typeof o[key]==='number'?+form.elements[key].value:form.elements[key].value;try{state=format.validate(state);record(before);render();status('Object updated')}catch(error){state=JSON.parse(before);render();status(error.message)}};
    }
    document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$('#undoSymbol').disabled=!undo.length;$('#redoSymbol').disabled=!redo.length;
  }
  function point(e,spacing=+$('#shapeGrid').value){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(canvas.getScreenCTM().inverse());return{x:Math.max(-state.widthMm/2,Math.min(state.widthMm/2,Math.round(p.x/spacing)*spacing)),y:Math.max(-state.heightMm/2,Math.min(state.heightMm/2,Math.round(p.y/spacing)*spacing))}}
  function setTool(value){if(gesture){state=JSON.parse(gesture.before);gesture=null;selected=null}tool=value;render();status(value==='terminal'?'Click a 4 mm grid point to add a terminal':'Tool: '+value)}
  document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;e.preventDefault();const p=point(e,tool==='terminal'?4:+$('#shapeGrid').value),before=snapshot(),id=crypto.randomUUID();
    if(tool==='select'){selected=e.target.closest('[data-object-id]')?.dataset.objectId||null;const o=find();if(o){gesture={before,start:point(e,o.name?4:+$('#shapeGrid').value),object:clone(o),id:o.id};canvas.setPointerCapture(e.pointerId)}render();return}
    if(tool==='terminal'){const name=$('#terminalName').value.trim();if(!name||state.terminals.some(t=>t.name===name)){status('Choose a unique terminal name');return}state.terminals.push({id,name,...p});selected=id;if(/^\d+$/.test(name))$('#terminalName').value=String(+name+1);record(before);render();return}
    if(tool==='text'){state.geometry.push({id,type:'text',...p,text:$('#insertText').value,fontSize:2});selected=id;record(before);render();return}
    const o=tool==='line'?{id,type:tool,x1:p.x,y1:p.y,x2:p.x,y2:p.y}:tool==='rect'?{id,type:tool,...p,width:0,height:0}:{id,type:'circle',cx:p.x,cy:p.y,r:0};state.geometry.push(o);selected=id;gesture={before,start:p,id,creating:true};canvas.setPointerCapture(e.pointerId);render();
  });
  canvas.addEventListener('pointermove',e=>{
    if(!gesture)return;const o=find(),p=point(e,o.name?4:+$('#shapeGrid').value),s=gesture.start;
    if(gesture.creating){if(o.type==='line'){o.x2=p.x;o.y2=p.y}else if(o.type==='rect'){o.x=Math.min(s.x,p.x);o.y=Math.min(s.y,p.y);o.width=Math.abs(p.x-s.x);o.height=Math.abs(p.y-s.y)}else o.r=Math.min(Math.hypot(p.x-s.x,p.y-s.y),state.widthMm/2-Math.abs(o.cx),state.heightMm/2-Math.abs(o.cy))}
    else{const dx=p.x-s.x,dy=p.y-s.y,old=gesture.object;for(const key of ['x','x1','x2','cx'])if(key in o)o[key]=old[key]+dx;for(const key of ['y','y1','y2','cy'])if(key in o)o[key]=old[key]+dy}
    render();
  });
  canvas.addEventListener('pointerup',e=>{if(!gesture)return;const before=gesture.before;gesture=null;try{state=format.validate(state);record(before)}catch{state=JSON.parse(before);selected=null}if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);render()});
  canvas.addEventListener('pointercancel',()=>{if(gesture){state=JSON.parse(gesture.before);gesture=null;selected=null;render()}});
  function remove(){if(!selected)return;const before=snapshot();state.geometry=state.geometry.filter(o=>o.id!==selected);state.terminals=state.terminals.filter(o=>o.id!==selected);selected=null;record(before);render()}
  $('#deleteObject').onclick=remove;$('#undoSymbol').onclick=()=>history(true);$('#redoSymbol').onclick=()=>history(false);
  $('#clearSymbol').onclick=()=>{const before=snapshot();state.geometry=[];state.terminals=[];selected=null;record(before);render()};
  function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  $('#saveProposal').onclick=()=>{try{readFields();download(JSON.stringify(format.validate(state),null,2),state.id+'.cabel-symbol.json','application/json');status('Symbol proposal downloaded')}catch(e){status(e.message)}};
  $('#savePreview').onclick=()=>{try{readFields();download(format.svgText(state),state.id+'.svg','image/svg+xml');status('SVG preview downloaded')}catch(e){status(e.message)}};
  $('#openProposal').onclick=()=>$('#proposalFile').click();$('#proposalFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('File is too large');const next=format.validate(JSON.parse(await file.text())),before=snapshot();state=next;selected=null;record(before);syncFields();render();status('Symbol proposal opened')}catch(error){status(error.message)}e.target.value=''};
  document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,[contenteditable]'))return;const key=e.key.toLowerCase();if(e.ctrlKey||e.metaKey){if(key==='z'||key==='y'){e.preventDefault();history(key==='z'&&!e.shiftKey)}return}if(key==='delete'||key==='backspace'){e.preventDefault();remove()}if(key==='escape'){if(gesture){state=JSON.parse(gesture.before);gesture=null}selected=null;setTool('select')}const tools={v:'select',l:'line',b:'rect',o:'circle',p:'terminal',t:'text'};if(tools[key]){e.preventDefault();setTool(tools[key])}});
  try{const draft=localStorage.getItem('cabel-symbol-draft');if(draft)state=format.validate(JSON.parse(draft))}catch{}
  syncFields();render();
})();
