/* Keep device and calculation fields in one form so Apply/Cancel stay atomic. */
(function(root){
  'use strict';
  function init(form,initial='device'){
    const supply=[...form.children].filter(node=>node.classList.contains('electrical-supply-fields')),calculation=[...form.children].filter(node=>node.classList.contains('electrical-load-fields')&&!supply.includes(node));
    if(!calculation.length&&!supply.length)return null;
    const actions=form.querySelector('.actions'),list=document.createElement('div'),panels=new Map(),tabs=new Map();
    list.className='component-tabs';list.setAttribute('role','tablist');list.setAttribute('aria-label','Component settings');
    const definitions=[['device','Device'],['calculation','Calculation'],...(supply.length?[['supply','Edit supply']]:[])];
    for(const [name,label]of definitions){
      const tab=document.createElement('button'),panel=document.createElement('div');
      tab.type='button';tab.id='componentTab-'+name;tab.textContent=label;tab.dataset.componentTab=name;
      tab.setAttribute('role','tab');tab.setAttribute('aria-controls','componentPanel-'+name);
      panel.id='componentPanel-'+name;panel.className='component-panel';panel.dataset.componentPanel=name;
      panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);
      panels.set(name,panel);tabs.set(name,tab);list.append(tab);
    }
    for(const node of [...form.children])if(node!==actions)panels.get(supply.includes(node)?'supply':calculation.includes(node)?'calculation':'device').append(node);
    form.prepend(list,...panels.values());
    function select(name,focus=false){
      if(!panels.has(name))name='device';
      for(const [key,panel]of panels){
        const active=key===name,tab=tabs.get(key);panel.hidden=!active;
        tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
      }
      if(focus)tabs.get(name).focus({preventScroll:true});
    }
    function reveal(control){
      const panel=control?.closest('.component-panel');if(!panel)return;
      select(panel.dataset.componentPanel);
      for(let node=control.parentElement;node&&node!==panel;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
    }
    for(const [name,tab]of tabs){
      tab.onclick=()=>select(name);
      tab.onkeydown=e=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
        e.preventDefault();e.stopPropagation();
        const names=[...panels.keys()],i=names.indexOf(name);select(e.key==='Home'?names[0]:e.key==='End'?names.at(-1):names[(i+(e.key==='ArrowRight'?1:names.length-1))%names.length],true);
      };
    }
    // Native constraint validation runs before submit; reveal hidden invalid fields
    // synchronously so the browser can focus and explain the error.
    form.addEventListener('invalid',e=>reveal(e.target),true);
    select(initial);
    return{select,reveal};
  }
  root.CabelComponentTabs={init};
})(window);
