/* Batch pin connections use existing endpoint references and wire records.
   The preview is view state; it never changes a drawing or cloud document. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CabelMultiConnect=value;})(globalThis,()=>{
  const EPS=.001;
  function plan({ports,selected,direction='horizontal',wires=[],routes=[]}){
    const along=direction==='vertical'?'y':'x',across=along==='x'?'y':'x',chosen=new Set(selected),parents=new Map(),skipped={existing:0,media:0,strip:0,overlap:0,unselected:0,coincident:0};
    function find(x){if(!parents.has(x))parents.set(x,x);let p=x;while(parents.get(p)!==p)p=parents.get(p);while(parents.get(x)!==x){const next=parents.get(x);parents.set(x,p);x=next;}return p;}
    const join=(a,b)=>parents.set(find(a),find(b));
    for(const w of wires)join((w.kind||'wire')+'\0'+w.a,(w.kind||'wire')+'\0'+w.b);
    const valid=[...new Map(ports.filter(p=>p&&typeof p.ref==='string'&&Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>[p.ref,p])).values()],picked=valid.filter(p=>chosen.has(p.ref)).sort((a,b)=>a[across]-b[across]||a[along]-b[along]||a.ref.localeCompare(b.ref)),groups=[];
    for(const p of picked){let group=groups.at(-1);if(!group||p[across]-group[0][across]>EPS)groups.push(group=[]);group.push(p);}
    const connections=[],used=new Set();
    for(const group of groups){group.sort((a,b)=>a[along]-b[along]||a.ref.localeCompare(b.ref));for(let i=1;i<group.length;i++){
      const a=group[i-1],b=group[i],kind=a.kind||'wire',left=a[along],right=b[along];
      if(right-left<=EPS||group.some(p=>p!==a&&p!==b&&(Math.abs(p[along]-left)<=EPS||Math.abs(p[along]-right)<=EPS))){skipped.coincident++;continue;}
      if(kind!==(b.kind||'wire')){skipped.media++;continue;}
      if(kind==='bridge'&&(!a.scope||a.scope!==b.scope)){skipped.strip++;continue;}
      if(find(kind+'\0'+a.ref)===find(kind+'\0'+b.ref)){skipped.existing++;continue;}
      // A line through an unselected port or over an existing collinear wire
      // would look connected without an explicit endpoint/junction. Leave it
      // for a deliberate manual connection instead of creating hidden joins.
      if(valid.some(p=>p.ref!==a.ref&&p.ref!==b.ref&&!chosen.has(p.ref)&&Math.abs(p[across]-a[across])<=EPS&&p[along]>=left-EPS&&p[along]<=right+EPS)){skipped.unselected++;continue;}
      if(routes.some(points=>points.slice(1).some((q,j)=>{const p=points[j];return Math.abs(p[across]-a[across])<=EPS&&Math.abs(q[across]-a[across])<=EPS&&Math.min(right,Math.max(p[along],q[along]))-Math.max(left,Math.min(p[along],q[along]))>EPS;}))){skipped.overlap++;continue;}
      connections.push({a:a.ref,b:b.ref,kind});used.add(a.ref);used.add(b.ref);join(kind+'\0'+a.ref,kind+'\0'+b.ref);
    }}
    return{connections,ports:picked,unused:picked.filter(p=>!used.has(p.ref)).length,skipped};
  }
  function init(api){
    api.svg.setAttribute('tabindex','0');
    const controls=document.createElement('div');controls.id='multiConnectControls';controls.className='tool-group';controls.setAttribute('role','group');controls.setAttribute('aria-label','Connect multiple pins');controls.hidden=true;
    let direction='horizontal',refs=new Set(),box=null,gesture=null,owner=null;
    const overlay=api.el('g',{id:'multiConnectOverlay',class:'screen-only','pointer-events':'none'},api.content);
    function button(id,label,title,action){const b=document.createElement('button');b.type='button';b.id=id;b.className='tool-button';b.textContent=label;b.title=title;b.onclick=action;controls.append(b);return b;}
    const h=button('multiConnectHorizontal','Horizontal','Connect adjacent selected pins in each row',()=>orient('horizontal')),
      v=button('multiConnectVertical','Vertical','Connect adjacent selected pins in each column',()=>orient('vertical')),
      summary=document.createElement('output');summary.id='multiConnectSummary';summary.setAttribute('aria-live','polite');controls.append(summary);
    const connect=button('multiConnectApply','Connect','Create all previewed connections as one undo step',apply),clear=button('multiConnectClear','Clear','Clear the pin selection',()=>{reset();refresh();});
    button('multiConnectCancel','Cancel','Leave multi-connect without creating connections',()=>{reset();api.exit();api.render();});
    const active=()=>api.mode()==='multi-connect',stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
    function reset(){gesture=null;refs.clear();box=null;owner=api.sheet();overlay.replaceChildren();}
    function cancelGesture(){if(!gesture)return;refs=new Set(gesture.before);box=gesture.box;gesture=null;refresh();}
    function orient(value){direction=value;refresh();}
    function current(){const ports=api.ports();return plan({ports,selected:refs,direction,wires:api.wires(),routes:api.wires().map(api.route)});}
    function refresh(){
      if(!active()||api.blocked()){reset();controls.hidden=true;return;}
      if(owner!==api.sheet())reset();controls.hidden=false;overlay.replaceChildren();
      h.setAttribute('aria-pressed',String(direction==='horizontal'));v.setAttribute('aria-pressed',String(direction==='vertical'));
      const result=current(),skips=Object.entries(result.skipped).filter(([reason])=>reason!=='existing').reduce((n,[,count])=>n+count,0),text=result.ports.length+' pins · '+result.connections.length+' new'+(result.skipped.existing?' · '+result.skipped.existing+' already connected':'')+(skips?' · '+skips+' skipped':'');
      summary.textContent=text;summary.title='Skipped: '+Object.entries(result.skipped).filter(([,n])=>n).map(([reason,n])=>reason+' '+n).join(', ');connect.disabled=!result.connections.length||Boolean(gesture);clear.disabled=!refs.size&&!box;
      const m=api.content.getScreenCTM(),scale=Math.hypot(m.a,m.b)||1,ports=api.ports(),byRef=new Map(ports.map(p=>[p.ref,p]));
      if(box)api.el('rect',{...box,fill:'#ff78b714',stroke:'#ff78b7','stroke-width':1/scale,'stroke-dasharray':5/scale+' '+3/scale},overlay);
      for(const p of ports)api.el('circle',{cx:p.x,cy:p.y,r:(refs.has(p.ref)?6:4)/scale,fill:refs.has(p.ref)?'#ff78b744':'none',stroke:refs.has(p.ref)?'#ff78b7':'#718692','stroke-width':1.3/scale},overlay);
      for(const edge of result.connections){const a=byRef.get(edge.a),b=byRef.get(edge.b);api.el('path',{d:'M '+a.x+' '+a.y+' L '+b.x+' '+b.y,fill:'none',stroke:'#ff78b7','stroke-width':(edge.kind==='bridge'?3:2)/scale,'stroke-dasharray':(edge.kind==='fiber'?'12 5':'5 3').split(' ').map(n=>n/scale).join(' ')},overlay);}
      api.status('Multi-connect: '+text+' · Drag a box or tap pins · Enter: connect · Escape: cancel');
    }
    function apply(){
      if(!active()||api.blocked()||gesture||owner!==api.sheet())return;
      const result=current();if(!result.connections.length)return;
      api.commit();api.create(result.connections);reset();api.render();api.commit();api.toast(result.connections.length+' connections created');
    }
    const point=e=>{const p=api.world(e);return{x:Math.max(0,Math.min(1128,p.x)),y:Math.max(0,Math.min(798,p.y))};};
    api.svg.addEventListener('pointerdown',e=>{
      if(!active()||api.blocked()||e.button!==0)return;const p=api.world(e);if(p.x<0||p.x>1128||p.y<0||p.y>798)return;stop(e);api.svg.focus({preventScroll:true});
      if(gesture)return;gesture={id:e.pointerId,start:p,screen:{x:e.clientX,y:e.clientY},before:[...refs],box,add:e.ctrlKey||e.metaKey||e.shiftKey};api.capture(e.pointerId);
    },true);
    api.svg.addEventListener('pointermove',e=>{
      if(!gesture||gesture.id!==e.pointerId)return;stop(e);if(api.blocked()){reset();return;}const p=point(e),a=gesture.start;box={x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),width:Math.abs(p.x-a.x),height:Math.abs(p.y-a.y)};
      refs=new Set(gesture.add?gesture.before:[]);for(const port of api.ports())if(port.x>=box.x-EPS&&port.x<=box.x+box.width+EPS&&port.y>=box.y-EPS&&port.y<=box.y+box.height+EPS)refs.add(port.ref);refresh();
    },true);
    api.svg.addEventListener('pointerup',e=>{
      if(!gesture||gesture.id!==e.pointerId)return;stop(e);if(api.blocked()){reset();return;}const g=gesture;gesture=null;
      if(Math.hypot(e.clientX-g.screen.x,e.clientY-g.screen.y)<5){const p=point(e),m=api.content.getScreenCTM(),tolerance=14/(Math.hypot(m.a,m.b)||1),port=api.ports().map(q=>({q,d:Math.hypot(q.x-p.x,q.y-p.y)})).filter(q=>q.d<=tolerance).sort((a,b)=>a.d-b.d)[0]?.q;refs=new Set(g.before);box=null;if(port){if(refs.has(port.ref))refs.delete(port.ref);else refs.add(port.ref);}}
      if(api.svg.hasPointerCapture(e.pointerId))api.svg.releasePointerCapture(e.pointerId);refresh();
    },true);
    api.svg.addEventListener('pointercancel',e=>{if(gesture){stop(e);cancelGesture();}},true);
    for(const type of ['click','dblclick','contextmenu'])api.svg.addEventListener(type,e=>{if(active())stop(e);},true);
    document.addEventListener('keydown',e=>{if(!active()||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;if(e.key==='Escape'){stop(e);reset();api.exit();api.render();}else if(e.key==='Enter'&&!e.target.closest('button')){stop(e);apply();}else if(['Delete','Backspace'].includes(e.key)){stop(e);reset();refresh();}else if((e.ctrlKey||e.metaKey)&&['z','y','x','v'].includes(e.key.toLowerCase()))reset();},true);
    window.addEventListener('blur',cancelGesture);
    document.addEventListener('click',e=>{if(active()&&e.target.closest('#cloudProjectsBtn,#cloudStatus,#exportBtn,#openBtn'))reset();},true);
    new MutationObserver(()=>{if(document.body.dataset.cloudReadOnly==='true'){reset();if(active()){api.exit();api.render();}}api.refresh();}).observe(document.body,{attributes:true,attributeFilter:['data-cloud-read-only']});
    return{controls,refresh,reset,cancelGesture,busy:()=>Boolean(gesture||refs.size),dragging:()=>Boolean(gesture),start:()=>{reset();api.start();refresh();}};
  }
  return{plan,init};
});
