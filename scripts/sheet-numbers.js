/* A drawing can have a stable, explicit sheet number. Generated front matter
   stays first, and generated lists follow the highest drawing number. */
globalThis.CabelSheetNumbers=(()=>{
  const explicit=s=>s.number!==undefined;
  function validate(drawings){const seen=new Set();for(const s of drawings)if(explicit(s)){if(!Number.isInteger(s.number)||s.number<1||s.number>9999||seen.has(s.number))throw Error('Invalid or duplicate drawing sheet number');seen.add(s.number);}}
  const value=(sheet,fallback)=>sheet?._pageNumber??sheet?.number??fallback;
  function order(drawings,frontCount){
    if(!drawings.some(explicit))return;
    let next=Math.max(frontCount,...drawings.filter(explicit).map(s=>s.number))+1;
    for(const s of drawings)if(!explicit(s))s.number=next++;
    drawings.sort((a,b)=>a.number-b.number);let previous=frontCount;
    // A growing table of contents must keep numbers unique across the document.
    for(const s of drawings){s.number=Math.max(s.number,previous+1);previous=s.number;}
  }
  function update(pages,isGenerated){
    let last=0;for(const s of pages){last=!isGenerated(s)&&explicit(s)?s.number:last+1;Object.defineProperty(s,'_pageNumber',{value:last,writable:true,configurable:true,enumerable:false});}
  }
  function change(drawings,sheet,number,frontCount,tailCount){
    if(!Number.isInteger(number)||number<frontCount+1||number>9999-tailCount)return 'Enter a sheet number from '+String(frontCount+1).padStart(4,'0')+' to '+String(9999-tailCount).padStart(4,'0');
    if(number===value(sheet))return null;
    if(drawings.some(s=>s!==sheet&&value(s)===number))return 'This drawing sheet number is already in use';
    for(const s of drawings)s.number=value(s);sheet.number=number;return null;
  }
  return{validate,value,order,update,change};
})();
