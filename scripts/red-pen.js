/* Freehand annotations belong to a sheet, independently of electrical objects. */
globalThis.CabelRedPen={
  init(api){
    const NS='http://www.w3.org/2000/svg',BRUSHES={yellow:{color:'#ffdf00',width:16,opacity:.32},blue:{color:'#2299ff',width:16,opacity:.25},green:{color:'#40cf65',width:16,opacity:.3},red:{color:'#cf3030',width:2,opacity:1}};
    const visible=new Set(Object.keys(BRUSHES)),colorOf=s=>Object.hasOwn(BRUSHES,s.layer)?s.layer:'red',styleOf=s=>BRUSHES[colorOf(s)];
    const layer=document.createElementNS(NS,'g');layer.id='redPenLayer';api.pageContent.append(layer);
    const overlay=document.createElementNS(NS,'g');overlay.id='redPenSelection';overlay.classList.add('screen-only');api.pageContent.append(overlay);
    let tool=null,brush='red',gesture=null,lastSheet=api.sheet();const selected=new Set();
    const rounded=p=>({x:Math.round(p.x*100)/100,y:Math.round(p.y*100)/100});
    const clamp=p=>({x:Math.max(0,Math.min(1128,p.x)),y:Math.max(0,Math.min(798,p.y))});
    const world=p=>clamp(api.world({clientX:p.x,clientY:p.y}));
    const strokes=()=>Array.isArray(api.sheet().redlines)?api.sheet().redlines:[];
    const valid=s=>s&&typeof s.id==='string'&&Array.isArray(s.points)&&s.points.length>0&&s.points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
    const list=()=>strokes().filter(valid),visibleList=()=>Object.keys(BRUSHES).flatMap(color=>visible.has(color)?list().filter(s=>colorOf(s)===color):[]);
    const scale=()=>{const m=api.pageContent.getScreenCTM();return Math.hypot(m.a,m.b)||1;};
    function node(tag,attrs,parent){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent.append(n);return n;}
    function bounds(items){let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;for(const s of items)for(const p of s.points){x=Math.min(x,p.x);y=Math.min(y,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}return Number.isFinite(x)?{x,y,right,bottom}:null;}
    function selectionBounds(){return bounds(list().filter(s=>selected.has(s.id)));}
    function displayBounds(){const b=selectionBounds();if(!b)return null;const pad=Math.max(8/scale(),...list().filter(s=>selected.has(s.id)).map(s=>styleOf(s).width/2+1));return{x:b.x-pad,y:b.y-pad,right:b.right+pad,bottom:b.bottom+pad};}
    function path(points){return points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ')+(points.length===1?' l .01 0':'');}
    let colorLayers={};
    function drawStroke(s,draft=false){const style=styleOf(s);node('path',{d:path(s.points),fill:'none',stroke:style.color,'stroke-width':style.width,'stroke-opacity':style.opacity,'stroke-linecap':'round','stroke-linejoin':'round','pointer-events':'none',class:'red-pen-stroke'+(draft?' screen-only':''),...(draft?{'data-red-pen-draft':''}:{'data-redline':s.id})},colorLayers[colorOf(s)]);}

    function render(){
      if(api.sheet()!==lastSheet&&!api.exporting()){cancel();selected.clear();lastSheet=api.sheet();}
      if(!api.exporting()){const ids=new Set(list().map(s=>s.id));for(const id of selected)if(!ids.has(id))selected.delete(id);}
      layer.replaceChildren();overlay.replaceChildren();colorLayers={};for(const color of Object.keys(BRUSHES))colorLayers[color]=node('g',{'data-annotation-layer':color,id:'annotation-'+color,display:visible.has(color)?'inline':'none'},layer);list().forEach(s=>drawStroke(s));
      if(gesture?.kind==='draw')drawStroke(gesture.stroke,true);
      if(!tool||api.exporting())return;
      if(gesture?.kind==='marquee'){const a=gesture.start,b=gesture.last;node('rect',{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y),fill:'#ff78b71a',stroke:'#ff78b7','stroke-width':1,'vector-effect':'non-scaling-stroke','pointer-events':'none'},overlay);}
      if(tool!=='select')return;
      const b=displayBounds();if(!b)return;
      node('rect',{x:b.x,y:b.y,width:b.right-b.x,height:b.bottom-b.y,fill:'none',stroke:'#ff78b7','stroke-width':1,'stroke-dasharray':'4 3','vector-effect':'non-scaling-stroke','pointer-events':'none'},overlay);
      const unit=1/scale();
      for(const[corner,x,y]of[['nw',b.x,b.y],['ne',b.right,b.y],['sw',b.x,b.bottom],['se',b.right,b.bottom]]){
        const g=node('g',{'data-red-pen-handle':corner,style:'cursor:'+corner+'-resize'},overlay);
        node('rect',{x:x-16*unit,y:y-16*unit,width:32*unit,height:32*unit,fill:'transparent'},g);
        node('rect',{x:x-5*unit,y:y-5*unit,width:10*unit,height:10*unit,rx:2*unit,fill:'#fff',stroke:'#ff78b7','stroke-width':2,'vector-effect':'non-scaling-stroke','pointer-events':'none'},g);
      }
    }
    function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
    function cross(a,b,c){return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
    function segmentsNear(a,b,c,d,tolerance){
      if(Math.max(a.x,b.x)+tolerance<Math.min(c.x,d.x)||Math.max(c.x,d.x)+tolerance<Math.min(a.x,b.x)||Math.max(a.y,b.y)+tolerance<Math.min(c.y,d.y)||Math.max(c.y,d.y)+tolerance<Math.min(a.y,b.y))return false;
      if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0)return true;
      return Math.min(segmentDistance(a,c,d),segmentDistance(b,c,d),segmentDistance(c,a,b),segmentDistance(d,a,b))<=tolerance;
    }
    function touches(s,a,b,tolerance){return s.points.length===1?segmentDistance(s.points[0],a,b)<=tolerance:s.points.slice(1).some((p,i)=>segmentsNear(a,b,s.points[i],p,tolerance));}
    function hit(p){return visibleList().reverse().find(s=>touches(s,p,p,10/scale()+styleOf(s).width/2));}
    function insidePaper(p){const r=api.svg.getBoundingClientRect(),w=api.world({clientX:p.x,clientY:p.y});return p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom&&w.x>=0&&w.x<=1128&&w.y>=0&&w.y<=798;}
    function begin(p,target,options={}){
      if(!tool||api.blocked()||!insidePaper(p))return;
      cancel();api.commit();const start=world(p),sheet=api.sheet(),before=sheet.redlines===undefined?undefined:structuredClone(sheet.redlines);
      gesture={sheet,before,start,last:start,previousSelection:[...selected]};
      if(tool==='draw'){selected.clear();gesture.kind='draw';gesture.stroke={id:'ink-'+crypto.randomUUID(),layer:brush,points:[rounded(start)]};}
      else if(tool==='erase'){gesture.kind='erase';erase(start,start);}
      else{
        const corner=target.closest?.('[data-red-pen-handle]')?.dataset.redPenHandle,b=displayBounds(),stroke=hit(start);
        if(corner&&b){const raw=selectionBounds();gesture.kind='scale';gesture.anchor={x:corner.includes('w')?raw.right:raw.x,y:corner.includes('n')?raw.bottom:raw.y};gesture.vector={x:start.x-gesture.anchor.x,y:start.y-gesture.anchor.y};}
        else if(stroke){if(options.shift){if(selected.has(stroke.id))selected.delete(stroke.id);else selected.add(stroke.id);}else if(!selected.has(stroke.id)){selected.clear();selected.add(stroke.id);}gesture.kind='move';}
        else{if(!options.shift)selected.clear();gesture.kind='marquee';}
        if(['move','scale'].includes(gesture.kind)){gesture.original=list().filter(s=>selected.has(s.id)).map(s=>({id:s.id,points:structuredClone(s.points)}));gesture.bounds=bounds(gesture.original);}
      }
      render();api.refresh();
    }
    function erase(a,b){const ids=new Set(visibleList().filter(s=>touches(s,a,b,10/scale()+styleOf(s).width/2)).map(s=>s.id));if(!ids.size)return;api.sheet().redlines=strokes().filter(s=>!ids.has(s.id));for(const id of ids)selected.delete(id);}
    function transform(original,convert){const byId=new Map(original.map(s=>[s.id,s]));for(const s of list())if(byId.has(s.id))s.points=byId.get(s.id).points.map(p=>rounded(convert(p)));}
    function maximumScale(items,anchor){let max=100;for(const s of items)for(const p of s.points){const dx=p.x-anchor.x,dy=p.y-anchor.y;if(dx>0)max=Math.min(max,(1128-anchor.x)/dx);if(dx<0)max=Math.min(max,-anchor.x/dx);if(dy>0)max=Math.min(max,(798-anchor.y)/dy);if(dy<0)max=Math.min(max,-anchor.y/dy);}return Math.max(.05,max);}
    function move(p,samples){
      if(!gesture)return;const q=world(p),g=gesture;
      if(g.kind==='draw'){for(const e of samples?.length?samples:[{clientX:p.x,clientY:p.y}]){const a=world({x:e.clientX,y:e.clientY}),last=g.stroke.points.at(-1);if(Math.hypot(a.x-last.x,a.y-last.y)>=.5)g.stroke.points.push(rounded(a));}}
      else if(g.kind==='erase')erase(g.last,q);
      else if(g.kind==='move'&&g.bounds){const b=g.bounds,dx=Math.max(-b.x,Math.min(1128-b.right,q.x-g.start.x)),dy=Math.max(-b.y,Math.min(798-b.bottom,q.y-g.start.y));transform(g.original,p=>({x:p.x+dx,y:p.y+dy}));}
      else if(g.kind==='scale'&&g.bounds){const a=g.anchor,v=g.vector,ratio=((q.x-a.x)*v.x+(q.y-a.y)*v.y)/(v.x*v.x+v.y*v.y||1),factor=Math.max(.05,Math.min(maximumScale(g.original,a),ratio));transform(g.original,p=>({x:a.x+(p.x-a.x)*factor,y:a.y+(p.y-a.y)*factor}));}
      g.last=q;render();api.refresh();
    }
    function intersects(s,a,b){const x=Math.min(a.x,b.x),right=Math.max(a.x,b.x),y=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y);return s.points.some(p=>p.x>=x&&p.x<=right&&p.y>=y&&p.y<=bottom)||[[{x,y},{x:right,y}],[{x:right,y},{x:right,y:bottom}],[{x:right,y:bottom},{x,y:bottom}],[{x,y:bottom},{x,y}]].some(([a,b])=>touches(s,a,b,0));}
    function end(p){
      if(!gesture)return;move(p);const g=gesture;
      if(g.kind==='draw'){if(!Array.isArray(g.sheet.redlines))g.sheet.redlines=[];g.sheet.redlines.push(g.stroke);}
      if(g.kind==='marquee')for(const s of visibleList())if(intersects(s,g.start,g.last))selected.add(s.id);
      gesture=null;api.changed();api.commit();
    }
    function cancel(){if(!gesture)return;const g=gesture;gesture=null;if(g.before===undefined)delete g.sheet.redlines;else g.sheet.redlines=g.before;selected.clear();g.previousSelection.forEach(id=>selected.add(id));render();api.refresh();}
    function setTool(value){cancel();tool=value;if(value==='draw')visible.add(brush);selected.clear();render();api.refresh();}
    function removeSelected(){if(!selected.size||api.blocked())return;cancel();api.commit();api.sheet().redlines=strokes().filter(s=>!selected.has(s.id));selected.clear();api.changed();api.commit();}
    function resize(factor){const originals=list().filter(s=>selected.has(s.id)),b=bounds(originals);if(!b||api.blocked())return;cancel();api.commit();const a={x:(b.x+b.right)/2,y:(b.y+b.bottom)/2},f=Math.min(factor,maximumScale(originals,a));transform(originals,p=>({x:a.x+(p.x-a.x)*f,y:a.y+(p.y-a.y)*f}));api.changed();api.commit();}
    function setBrush(value){if(!Object.hasOwn(BRUSHES,value))return;brush=value;visible.add(value);setTool('draw');}
    function showLayer(value,show){if(!Object.hasOwn(BRUSHES,value))return;cancel();if(show)visible.add(value);else{visible.delete(value);if(tool==='draw'&&brush===value)tool='select';}for(const s of list())if(!visible.has(colorOf(s)))selected.delete(s.id);render();api.refresh();}
    function reset(){cancel();selected.clear();render();api.refresh();}
    window.addEventListener('keydown',e=>{
      if(!tool||api.blocked()||e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(gesture)cancel();else setTool(null);}
      else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopImmediatePropagation();removeSelected();}
      else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();e.stopImmediatePropagation();cancel();tool='select';selected.clear();visibleList().forEach(s=>selected.add(s.id));render();api.refresh();}
    },true);
    render();return{active:()=>Boolean(tool),tool:()=>tool,busy:()=>Boolean(gesture),hasSelection:()=>selected.size>0,brush:()=>brush,setBrush,showLayer,layerVisible:color=>visible.has(color),begin,move,end,cancel,setTool,removeSelected,resize,reset,render};
  }
};
