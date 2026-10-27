// Measured, wrapping cells and variable-height pages for the generated directory.
globalThis.CabelDeviceList=(()=>{
  const columns=[
    {key:'aks',title:'AKS DESIGNATION',x:46,width:194,weight:'bold',fill:'#138b78'},
    {key:'designation',title:'EQUIPMENT TAG',x:250,width:165},
    {key:'type',title:'COMPONENT',x:425,width:105},
    {key:'value',title:'VALUE / TYPE',x:540,width:135},
    {key:'manufacturer',title:'MANUFACTURER NUMBER',x:685,width:155},
    {key:'sap',title:'SAP NUMBER',x:850,width:155},
    {key:'reference',title:'REFERENCE',x:1015,width:67}
  ],top=86,bottom=690,maxRows=22,lineHeight=10;
  const cache=new Map();let context;
  function measure(text,size,weight){context||=document.createElement('canvas').getContext('2d');if(!context)return String(text).length*size*.65;context.font=weight+' '+size+'px Arial';return context.measureText(text).width;}
  function wrap(value,width,size=8,weight='normal'){
    const raw=String(value??''),key=JSON.stringify([raw,width,size,weight]);if(cache.has(key))return cache.get(key);
    const lines=[],add=text=>lines.push({text,size,weight,width:measure(text,size,weight)}),fits=text=>measure(text,size,weight)<=width;
    for(const paragraph of raw.split(/\r?\n/)){
      let line='';if(!paragraph.trim()){add('');continue;}
      for(let word of paragraph.trim().split(/\s+/)){
        if(!fits(word)){if(line){add(line);line='';}let chunk='';for(const char of word){if(chunk&&!fits(chunk+char)){add(chunk);chunk='';}chunk+=char;}word=chunk;}
        if(line&&!fits(line+' '+word)){add(line);line=word;}else line+=(line?' ':'')+word;
      }if(line)add(line);
    }
    if(cache.size>=10000)cache.delete(cache.keys().next().value);cache.set(key,lines);return lines;
  }
  function paginate(entries,describe){
    const pages=[];let page=[],used=0;
    const capacity=Math.floor((bottom-top-10)/lineHeight);
    for(const entry of entries){
      const {values,detail}=describe(entry),cells=columns.map((c,i)=>wrap(values[i],c.width-4,8,c.weight||'normal'));
      if(detail)cells[0]=[...cells[0],...wrap(detail,columns[0].width-4,7).map(line=>({...line,fill:'#53666f'}))];
      const count=Math.max(...cells.map(c=>c.length)),limit=count>capacity?capacity-1:capacity;
      for(let offset=0;offset<count;offset+=limit){
        const continued=offset>0,chunk=cells.map((lines,i)=>(continued&&(i<2&&lines.length<=4||lines.length===1)?lines:lines.slice(offset,offset+limit)));
        if(continued)chunk[0]=[...chunk[0],...wrap('(continued)',columns[0].width,7)];
        const height=Math.max(25,Math.max(...chunk.map(c=>c.length))*lineHeight+10);
        if(page.length&&(used+height>bottom-top||page.length>=maxRows)){pages.push(page);page=[];used=0;}
        page.push({entry,cells:chunk,continued,height});used+=height;
      }
    }
    if(page.length||!pages.length)pages.push(page);return pages;
  }
  return{columns,top,bottom,lineHeight,paginate};
})();
