/* Material fields belong to a logical conductor: every routed section and
   every appearance of the same cable core shares the changed fields. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CabelWireBatch=value;})(globalThis,()=>{
  function targets(sheets,sheet,ids,cables=[]){
    const entries=new Map();for(const c of cables)for(const core of c.cores||[])entries.set(c.id+'\0'+core.id,{cable:c,core});
    const groups=new Map();let skipped=0;
    for(const w of sheet.wires||[]){if(!ids.has(w.id))continue;if(w.kind&&w.kind!=='wire'){skipped++;continue;}const e=entries.get(w.cableId+'\0'+w.coreId),key=e?'core:'+w.cableId+'\0'+w.coreId:'run:'+(w.runId||w.id);if(groups.has(key))continue;
      const sections=e?sheets.flatMap(s=>(s.wires||[]).filter(q=>(!q.kind||q.kind==='wire')&&q.cableId===w.cableId&&q.coreId===w.coreId)):(sheet.wires||[]).filter(q=>(!q.kind||q.kind==='wire')&&(q===w||w.runId&&q.runId===w.runId));
      groups.set(key,{sections,...e,colorCode:e?.core.colorCode||w.colorCode||'BK',diameter:e?.core.diameter||e?.cable.crossSection||w.diameter||'1.5'});
    }
    return{groups:[...groups.values()],skipped};
  }
  function apply(groups,patch){
    let changed=0;for(const g of groups){
      if(Object.hasOwn(patch,'diameter')){if(g.core&&Number(g.diameter)!==Number(patch.diameter)){g.core.diameter=patch.diameter;changed++;}for(const w of g.sections)if(w.diameter!==patch.diameter){w.diameter=patch.diameter;changed++;}}
      if(Object.hasOwn(patch,'colorCode')){if(g.core&&g.core.colorCode!==patch.colorCode){g.core.colorCode=patch.colorCode;changed++;}for(const w of g.sections)if(w.colorCode!==patch.colorCode){w.colorCode=patch.colorCode;changed++;}}
    }return changed;
  }
  function open(api,ids){
    if(api.blocked())return;const current=api.sheet(),result=targets(api.sheets(),current,ids,api.cables()),groups=result.groups;
    if(!groups.length){api.toast('Select copper conductors to edit colour or cross-section.');return;}
    const common=key=>groups.every(g=>String(g[key])===String(groups[0][key]))?String(groups[0][key]):'';
    api.panel('<h2>Conductor properties · '+groups.length+' selected</h2><p>Only checked fields are applied. Editing a field checks it automatically. All sections of the same conductor are updated.</p>'+(result.skipped?'<p>'+result.skipped+' bridge / fiber connections are excluded.</p>':'')+'<form id="wireBatchForm" class="wire-form"><label class="scope-check"><input name="applyColor" type="checkbox">Apply colour code</label><label>Colour code<select name="colorCode"><option value="">Mixed / unchanged</option>'+Object.keys(api.colors).map(c=>'<option value="'+c+'">'+c+' · '+api.safe(api.colorNames[c])+'</option>').join('')+'</select></label><label class="scope-check"><input name="applyDiameter" type="checkbox">Apply cross-section</label><label>Conductor cross-section (mm²)<input name="diameter" type="number" min="0.01" step="any" placeholder="Mixed / unchanged"></label><p id="wireBatchMessage" role="status"></p><div class="actions"><button type="submit">Apply</button><button type="button" id="wireBatchCancel">Cancel</button></div></form>');
    const form=document.querySelector('#wireBatchForm'),fields=form.elements,initial={colorCode:common('colorCode'),diameter:common('diameter')};fields.colorCode.value=initial.colorCode;fields.diameter.value=initial.diameter;
    fields.colorCode.onchange=()=>fields.applyColor.checked=fields.colorCode.value!==initial.colorCode;fields.diameter.oninput=()=>fields.applyDiameter.checked=fields.diameter.value!==initial.diameter;
    document.querySelector('#wireBatchCancel').onclick=api.close;
    form.onsubmit=e=>{e.preventDefault();if(api.blocked()||api.sheet()!==current){api.toast('This selection is no longer editable.');return;}const patch={};if(fields.applyColor.checked){if(!Object.hasOwn(api.colors,fields.colorCode.value)){document.querySelector('#wireBatchMessage').textContent='Choose a colour code.';return;}patch.colorCode=fields.colorCode.value;}if(fields.applyDiameter.checked){const n=Number(fields.diameter.value);if(!Number.isFinite(n)||n<=0){document.querySelector('#wireBatchMessage').textContent='Cross-section must be greater than zero.';return;}patch.diameter=String(n);}
      if(!Object.keys(patch).length){api.close();return;}const latest=targets(api.sheets(),current,ids,api.cables());api.commit();const changed=apply(latest.groups,patch);api.render();api.commit();api.close();api.toast(changed?'Conductor properties applied':'No conductor properties changed');
    };
  }
  return{targets,apply,open};
});
