// Shared, data-only symbol proposals. No raw HTML, SVG markup or scripts are imported.
(() => {
  const NS='http://www.w3.org/2000/svg';
  const groups=['Switchgear','Passive components','Loads','Connections','Annotations'];
  const number=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=200;
  function validate(input){
    if(input?.kind!=='cabel-symbol'||input.schemaVersion!==1||input.units!=='mm')throw Error('Unsupported symbol proposal');
    if(typeof input.id!=='string'||!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(input.id)||typeof input.name!=='string'||!input.name.trim()||input.name.length>120)throw Error('Invalid symbol name or ID');
    if(!groups.includes(input.group)||!/^[a-z][a-z0-9_-]{0,15}$/i.test(input.tagPrefix||''))throw Error('Invalid group or equipment prefix');
    if(!number(input.widthMm)||!number(input.heightMm)||input.widthMm<8||input.widthMm>160||input.heightMm<8||input.heightMm>160)throw Error('Canvas dimensions must be 8–160 mm');
    if(!Array.isArray(input.geometry)||input.geometry.length>256||!Array.isArray(input.terminals)||input.terminals.length>64)throw Error('Symbol supports up to 256 shapes and 64 terminals');
    const ids=new Set(),names=new Set();
    function identity(o){if(typeof o?.id!=='string'||!o.id||ids.has(o.id))throw Error('Object IDs must be unique');ids.add(o.id)}
    const geometry=input.geometry.map(o=>{
      identity(o);const keys={line:['x1','y1','x2','y2'],rect:['x','y','width','height'],circle:['cx','cy','r'],text:['x','y','fontSize']}[o.type];
      if(!keys||keys.some(k=>!number(o[k])))throw Error('Invalid shape coordinates');
      if(o.type==='line'&&o.x1===o.x2&&o.y1===o.y2)throw Error('A line needs two different points');
      if(o.type==='rect'&&(o.width<=0||o.height<=0)||o.type==='circle'&&o.r<=0||o.type==='text'&&(o.fontSize<.5||o.fontSize>12||typeof o.text!=='string'||o.text.length>120))throw Error('Invalid shape size or text');
      return Object.assign({id:o.id,type:o.type},Object.fromEntries(keys.map(k=>[k,o[k]])),o.type==='text'?{text:o.text}:{});
    });
    const terminals=input.terminals.map(t=>{
      identity(t);if(typeof t.name!=='string'||!t.name.trim()||t.name.length>40||names.has(t.name.trim()))throw Error('Terminal names must be unique');names.add(t.name.trim());
      if(!number(t.x)||!number(t.y)||Math.abs(t.x/4-Math.round(t.x/4))>1e-6||Math.abs(t.y/4-Math.round(t.y/4))>1e-6)throw Error('Terminals must be on the 4 mm grid');
      return{id:t.id,name:t.name.trim(),x:t.x,y:t.y};
    });
    return{kind:'cabel-symbol',schemaVersion:1,units:'mm',id:input.id,name:input.name.trim(),group:input.group,tagPrefix:input.tagPrefix,defaultValue:String(input.defaultValue||'').slice(0,200),widthMm:input.widthMm,heightMm:input.heightMm,geometry,terminals};
  }
  function element(parent,tag,attrs){const n=parent.ownerDocument.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n}
  function draw(parent,definition,{scale=1,skipText=false,stroke='#203844',strokeWidth=.25}={}){
    for(const o of definition.geometry){
      if(skipText&&o.type==='text')continue;
      const keys={line:['x1','y1','x2','y2'],rect:['x','y','width','height'],circle:['cx','cy','r'],text:['x','y']}[o.type];
      const attrs=Object.fromEntries(keys.map(k=>[k,o[k]*scale]));
      Object.assign(attrs,{'data-object-id':o.id,class:'symbol proposal-shape',fill:'none',stroke,'stroke-width':strokeWidth,'stroke-linecap':'round','stroke-linejoin':'round'});
      const node=element(parent,o.type,attrs);
      if(o.type==='text'){node.textContent=o.text;node.setAttribute('font-size',o.fontSize*scale);node.setAttribute('font-family','Arial,sans-serif');node.setAttribute('fill',stroke);node.setAttribute('stroke','none')}
    }
  }
  function svgText(input){
    const d=validate(input),svg=document.createElementNS(NS,'svg');svg.setAttribute('xmlns',NS);svg.setAttribute('width',d.widthMm+'mm');svg.setAttribute('height',d.heightMm+'mm');svg.setAttribute('viewBox',[-d.widthMm/2,-d.heightMm/2,d.widthMm,d.heightMm].join(' '));
    element(svg,'rect',{x:-d.widthMm/2,y:-d.heightMm/2,width:d.widthMm,height:d.heightMm,fill:'#fff'});draw(svg,d);
    for(const t of d.terminals){element(svg,'circle',{cx:t.x,cy:t.y,r:.6,fill:'#07977e'});const n=element(svg,'text',{x:t.x,y:t.y-1.2,'text-anchor':'middle','font-size':1.8,'font-family':'Arial,sans-serif',fill:'#0000FF'});n.textContent=':'+t.name}
    return new XMLSerializer().serializeToString(svg);
  }
  globalThis.CabelSymbol=Object.freeze({validate,draw,svgText,groups});
})();
