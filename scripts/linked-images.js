// Projects contain public image URLs and placement data, never image bytes.
globalThis.CabelLinkedImages=(()=>{
  const MM=1128/297,MAX_BYTES=5*1024*1024,MAX_PIXELS=16000000,cache=new Map();
  function url(value){
    if(typeof value!=='string'||value.length>2048)throw Error('Enter a direct HTTPS image URL (up to 2048 characters).');
    let result;try{result=new URL(value.trim());}catch{throw Error('Enter a valid direct HTTPS image URL.');}
    if(result.protocol!=='https:'&&!(result.protocol==='http:'&&['localhost','127.0.0.1'].includes(result.hostname))||result.username||result.password)throw Error('Use an HTTPS image URL without a username or password.');
    return result.href;
  }
  function validate(p){
    url(p.imageUrl);if(![p.x,p.y,p.imageWidthMm,p.imageHeightMm].every(Number.isFinite)||p.imageWidthMm<1||p.imageWidthMm>260||p.imageHeightMm<1||p.imageHeightMm>180||p.imageName!==undefined&&(typeof p.imageName!=='string'||p.imageName.length>200)||p.rotation!==undefined&&(!Number.isFinite(p.rotation)||p.rotation%90!==0))throw Error('Invalid linked image placement.');
  }
  function validateDocument(sheets){for(const sheet of sheets)for(const p of sheet.parts||[])if(p.type==='image')validate(p);}
  function validateCover(value,sheets=[]){
    if(value===undefined)return;if(!Array.isArray(value))throw Error('Invalid cover images.');
    const ids=new Set(sheets.flatMap(s=>[...(s.parts||[]),...(s.wires||[]),...(s.junctions||[]),...(s.looseEnds||[])].map(p=>p.id)));
    for(const p of value){if(!p||p.type!=='image'||typeof p.id!=='string'||!p.id||ids.has(p.id))throw Error('Invalid or duplicate cover image.');ids.add(p.id);validate(p);}
  }
  async function fetchImage(address){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(address,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
      if(!response.ok)throw Error('The image link returned HTTP '+response.status+'.');url(response.url||address);
      if(Number(response.headers.get('content-length'))>MAX_BYTES)throw Error('Images must be 5 MB or smaller.');
      const chunks=[];let length=0;const reader=response.body?.getReader();
      if(reader){try{for(;;){const item=await reader.read();if(item.done)break;length+=item.value.length;if(length>MAX_BYTES){await reader.cancel();throw Error('Images must be 5 MB or smaller.');}chunks.push(item.value);}}finally{reader.releaseLock();}}
      else{const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>MAX_BYTES)throw Error('Images must be 5 MB or smaller.');chunks.push(bytes);}
      const blob=new Blob(chunks),head=new Uint8Array(await blob.slice(0,16).arrayBuffer()),ascii=(start,end)=>String.fromCharCode(...head.slice(start,end));
      const jpeg=head[0]===255&&head[1]===216&&head[2]===255,png=head[0]===137&&ascii(1,4)==='PNG',gif=ascii(0,3)==='GIF',webp=ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP';
      if(!jpeg&&!png&&!gif&&!webp)throw Error('Use a direct PNG, JPEG, WebP or GIF image link. SVG and web pages are not supported.');
      const objectURL=URL.createObjectURL(new Blob(chunks,{type:jpeg?'image/jpeg':png?'image/png':gif?'image/gif':'image/webp'}));
      try{
        const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('The image could not be decoded.'));image.src=objectURL;});
        if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>MAX_PIXELS)throw Error('Images must contain at most 16 megapixels.');
        const factor=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*factor));canvas.height=Math.max(1,Math.round(image.naturalHeight*factor));
        const context=canvas.getContext('2d');if(!context)throw Error('Image conversion is unavailable in this browser.');context.drawImage(image,0,0,canvas.width,canvas.height);
        const asset={data:canvas.toDataURL(jpeg?'image/jpeg':'image/png',.92),ratio:image.naturalWidth/image.naturalHeight};canvas.width=canvas.height=0;return asset;
      }finally{URL.revokeObjectURL(objectURL);}
    }catch(error){if(error.name==='AbortError')throw Error('Image loading timed out. Check the link and retry.');if(error instanceof TypeError)throw Error('This image could not be accessed. Check the link and connection, or use a host that allows cross-origin image access.');throw error;}
    finally{clearTimeout(timer);}
  }
  function load(value,retry=false){
    const address=url(value);if(retry&&cache.get(address)?.error)cache.delete(address);let entry=cache.get(address);if(entry)return entry.promise;
    entry={};entry.promise=fetchImage(address).then(asset=>{entry.asset=asset;return asset;},error=>{entry.error=error;throw error;});cache.set(address,entry);return entry.promise;
  }
  async function ready(parts){const addresses=[...new Set(parts.filter(p=>p.type==='image').map(p=>url(p.imageUrl)))];let index=0;await Promise.all(Array.from({length:Math.min(4,addresses.length)},async()=>{while(index<addresses.length){const address=addresses[index++];try{await load(address,true);}catch(error){const p=parts.find(p=>p.type==='image'&&url(p.imageUrl)===address);throw Error((p?.imageName||'Linked image')+': '+error.message);}}}));}
  function init(api){
    let gesture=null;const $=s=>document.querySelector(s);
    function cancel(){if(!gesture)return;const g=gesture;gesture=null;Object.assign(g.p,g.before);api.render();}
    function form(p=null){
      if(api.blocked())return;api.prepare();if(p)api.select(p.id);api.render();
      api.panel('<h2>'+(p?'Edit linked image':'Insert image')+'</h2><form id="imageForm" class="wire-form"><label>Direct image URL<input name="imageUrl" type="url" maxlength="2048" placeholder="https://example.com/image.png" required></label><label>Name / description<input name="imageName" maxlength="200"></label><div class="scope-dimensions"><label>Width (mm)<input name="imageWidthMm" type="number" min="1" max="260" step="any" required></label><label>Height (mm)<input name="imageHeightMm" type="number" min="1" max="180" step="any" required></label></div><label class="scope-check"><input name="imageKeepAspect" type="checkbox" checked>Keep aspect ratio</label><p>Only the link and placement are saved in the project. Use a public PNG, JPEG, WebP or GIF link (up to 5 MB / 16 megapixels). The host must allow cross-origin access. Images can change or disappear at their host; export PDF to keep a fixed copy.</p><p id="imageMessage" role="status"></p><div class="actions"><button type="submit">'+(p?'Apply':'Insert image')+'</button><button type="button" id="imageCancel">Cancel</button></div></form>');
      const form=$('#imageForm'),fields=form.elements,button=form.querySelector('[type=submit]'),message=$('#imageMessage');let ratio=p?p.imageWidthMm/p.imageHeightMm:2,touched=false;
      fields.imageUrl.value=p?.imageUrl||'';fields.imageName.value=p?.imageName||'';fields.imageWidthMm.value=p?.imageWidthMm||80;fields.imageHeightMm.value=p?.imageHeightMm||40;fields.imageKeepAspect.checked=p?.imageKeepAspect!==false;
      for(const key of ['imageWidthMm','imageHeightMm'])fields[key].oninput=()=>{touched=true;if(fields.imageKeepAspect.checked){if(key==='imageWidthMm')fields.imageHeightMm.value=+(Number(fields.imageWidthMm.value)/ratio).toFixed(3);else fields.imageWidthMm.value=+(Number(fields.imageHeightMm.value)*ratio).toFixed(3);}};
      $('#imageCancel').onclick=api.close;
      form.onsubmit=async event=>{
        event.preventDefault();if(form.getAttribute('aria-busy')==='true'||!form.reportValidity()||api.blocked())return;const current=api.sheet(),address=fields.imageUrl.value,name=fields.imageName.value.trim();
        form.setAttribute('aria-busy','true');button.disabled=true;form.querySelectorAll('input').forEach(n=>n.disabled=true);message.textContent='Loading image…';
        try{
          const normalized=url(address),asset=await load(normalized,true);if(!form.isConnected||!form.getClientRects().length||api.sheet()!==current||api.blocked())return;
          let width=Number(fields.imageWidthMm.value),height=Number(fields.imageHeightMm.value);if(fields.imageKeepAspect.checked){ratio=asset.ratio;if(!touched&&!p){height=width/ratio;if(height>120){height=120;width=height*ratio;}}else height=width/ratio;}
          const value={imageUrl:normalized,imageName:name,imageWidthMm:width,imageHeightMm:height,imageKeepAspect:fields.imageKeepAspect.checked};validate({...value,x:0,y:0});api.commit();if(p)Object.assign(p,value);else api.insert(value);api.render();api.commit();api.close();
        }catch(error){if(form.isConnected)message.textContent=error.message;}
        finally{form.removeAttribute('aria-busy');button.disabled=false;form.querySelectorAll('input').forEach(n=>n.disabled=false);}
      };
      fields.imageUrl.focus();
    }
    function draw(p,root){
      const geometry=root.querySelector('.part-geometry');geometry.replaceChildren();root.querySelector('.part-caption').replaceChildren();
      const width=p.imageWidthMm*12,height=p.imageHeightMm*12,x=-width/2,y=-height/2;
      const image=api.el('image',{x,y,width,height,preserveAspectRatio:p.imageKeepAspect===false?'none':'xMidYMid meet','pointer-events':'none',class:'linked-image'},geometry);
      const placeholder=api.el('g',{class:'image-placeholder','pointer-events':'none'},geometry);api.el('rect',{x,y,width,height,fill:'#edf3f6',stroke:'#84939c','stroke-width':2,'stroke-dasharray':'10 6'},placeholder);const label=api.el('text',{x:0,y:0,'text-anchor':'middle','font-family':'Arial,sans-serif','font-size':24,fill:'#53666f'},placeholder);label.textContent='Loading image…';
      const paint=asset=>{if(!image.isConnected)return;image.setAttribute('href',asset.data);placeholder.remove();};const fail=()=>{if(label.isConnected)label.textContent='Image unavailable · edit link to retry';};
      try{const entry=cache.get(url(p.imageUrl));if(entry?.asset)paint(entry.asset);else if(entry?.error)fail();else load(p.imageUrl).then(paint,fail);}catch{fail();}
      api.el('rect',{x,y,width,height,class:'part-body'},geometry);api.el('title',{},root).textContent=p.imageName||'Linked image';
      if(api.selected(p.id)&&!api.exporting()){
        const m=geometry.getScreenCTM(),scale=Math.hypot(m.a,m.b)||.3,overlay=api.el('g',{class:'screen-only image-selection'},geometry);
        api.el('rect',{x,y,width,height,fill:'none',stroke:'#ff78b7','stroke-width':1.5/scale,'pointer-events':'none'},overlay);
        for(const [corner,cx,cy]of[['nw',x,y],['ne',-x,y],['sw',x,-y],['se',-x,-y]]){
          const handle=api.el('g',{'data-image-corner':corner,'data-image-id':p.id,class:'image-resize-handle',style:'cursor:'+corner+'-resize'},overlay);api.el('rect',{x:cx-22/scale,y:cy-22/scale,width:44/scale,height:44/scale,fill:'transparent','pointer-events':'all'},handle);api.el('rect',{x:cx-4/scale,y:cy-4/scale,width:8/scale,height:8/scale,fill:'#fff',stroke:'#ff78b7','stroke-width':1/scale,'pointer-events':'none'},handle);
        }
      }
    }
    api.svg.addEventListener('dblclick',event=>{const root=event.target.closest('#parts > g[data-id]'),p=root&&api.parts().find(p=>p.id===root.dataset.id);if(p?.type==='image'){event.preventDefault();event.stopImmediatePropagation();form(p);}},true);
    api.svg.addEventListener('pointerdown',event=>{
      const handle=event.target.closest('.image-resize-handle');if(!handle||event.button!==0||api.blocked()||api.mode()!=='select')return;
      event.preventDefault();event.stopImmediatePropagation();const p=api.parts().find(p=>p.id===handle.dataset.imageId),geometry=handle.closest('.part-geometry');if(!p)return;api.commit();const corner=handle.dataset.imageCorner,sx=corner.endsWith('e')?1:-1,sy=corner.startsWith('s')?1:-1;
      gesture={p,id:event.pointerId,sx,sy,before:{x:p.x,y:p.y,imageWidthMm:p.imageWidthMm,imageHeightMm:p.imageHeightMm},matrix:geometry.getScreenCTM(),anchor:{x:-sx*p.imageWidthMm*6,y:-sy*p.imageHeightMm*6},ratio:p.imageWidthMm/p.imageHeightMm};api.capture(event.pointerId);
    },true);
    api.svg.addEventListener('pointermove',event=>{
      if(!gesture||event.pointerId!==gesture.id)return;if(api.blocked()){cancel();return;}event.preventDefault();event.stopImmediatePropagation();const g=gesture,q=new DOMPoint(event.clientX,event.clientY).matrixTransform(g.matrix.inverse());let width=Math.max(1,Math.min(260,(q.x-g.anchor.x)*g.sx/12)),height=Math.max(1,Math.min(180,(q.y-g.anchor.y)*g.sy/12));
      if(g.p.imageKeepAspect!==false){const factor=Math.max(width/g.before.imageWidthMm,height/g.before.imageHeightMm);width=g.before.imageWidthMm*factor;height=g.before.imageHeightMm*factor;const fit=Math.min(1,260/width,180/height);width*=fit;height*=fit;}
      const center=new DOMPoint(g.anchor.x+g.sx*width*6,g.anchor.y+g.sy*height*6).matrixTransform(g.matrix),world=api.world({clientX:center.x,clientY:center.y});Object.assign(g.p,{x:world.x,y:world.y,imageWidthMm:width,imageHeightMm:height});api.render();
    },true);
    api.svg.addEventListener('pointerup',event=>{if(!gesture||gesture.id!==event.pointerId)return;if(api.blocked()){cancel();return;}event.preventDefault();event.stopImmediatePropagation();gesture=null;api.render();api.commit();},true);
    api.svg.addEventListener('pointercancel',()=>cancel(),true);
    document.addEventListener('keydown',event=>{if(gesture&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();}},true);
    new MutationObserver(()=>{if(gesture&&api.blocked())cancel();}).observe(document.body,{attributes:true,attributeFilter:['data-cloud-read-only']});
    return{draw,form,cancel,busy:()=>Boolean(gesture)};
  }
  return{init,validateDocument,validateCover,ready};
})();
