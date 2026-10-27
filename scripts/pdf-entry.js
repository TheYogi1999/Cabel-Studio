import {jsPDF} from 'jspdf';
import {svg2pdf} from 'svg2pdf.js';
import regular from '../assets/fonts/DejaVuSans.ttf';
import bold from '../assets/fonts/DejaVuSans-Bold.ttf';

const FAMILY='Leitwerk PDF',WIDTH=1128,HEIGHT=798,MMX=297/WIDTH,MMY=210/HEIGHT;
let fontsReady;
async function fonts(){
  fontsReady||=Promise.all([[regular,'400'],[bold,'700']].map(async([data,weight])=>{
    const face=new FontFace(FAMILY,'url(data:font/ttf;base64,'+data+')',{weight});
    await face.load();document.fonts.add(face);
  }));
  await fontsReady;
}
// Capture the actual appearance before detaching the SVG. Browser CSS variables
// and inherited UI styles must not leak into a standalone exported document.
function snapshot(source,remove=[]){
  const clone=source.cloneNode(true),originals=[source,...source.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
  const properties=['fill','fill-opacity','fill-rule','stroke','stroke-opacity','stroke-width','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','stroke-miterlimit','opacity','display','visibility','font-size','font-weight','font-style','text-anchor','dominant-baseline','letter-spacing','text-decoration'];
  originals.forEach((node,i)=>{const target=copies[i];if(!(node instanceof SVGElement)||node.tagName==='style')return;const style=getComputedStyle(node);if(style.display==='none'){target.remove();return;}for(const key of properties)target.style.setProperty(key,style.getPropertyValue(key),'important');if(node.tagName==='text'||node.tagName==='tspan'){target.style.setProperty('font-family',FAMILY,'important');target.style.setProperty('font-weight',Number(style.fontWeight)>=600?'700':'400','important');target.style.setProperty('font-style','normal','important');}});
  for(const node of remove){const index=originals.indexOf(node);if(index>=0)copies[index].remove();}
  clone.querySelectorAll('style,.screen-only,.wire-hit,.part-body,#preview').forEach(n=>n.remove());
  clone.querySelector('#pageContent')?.removeAttribute('transform');
  clone.setAttribute('viewBox','0 0 '+WIDTH+' '+HEIGHT);clone.setAttribute('preserveAspectRatio','none');clone.setAttribute('width',WIDTH);clone.setAttribute('height',HEIGHT);clone.style.width=WIDTH+'px';clone.style.height=HEIGHT+'px';
  return clone;
}
async function create(title){
  await fonts();
  const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
  for(const [data,style] of [[regular,'normal'],[bold,'bold']]){const filename='Leitwerk-'+style+'.ttf';pdf.addFileToVFS(filename,data);pdf.addFont(filename,FAMILY,style);}
  pdf.setProperties({title,creator:'Leitwerk',subject:'Schematic documentation'});
  const host=document.createElement('div');host.style.cssText='position:fixed;left:-100000px;top:0;pointer-events:none;width:1128px;height:798px;';document.body.append(host);
  const annotations=[];let count=0;
  return{
    async page(svg,collectLinks){
      if(count++)pdf.addPage('a4','landscape');host.replaceChildren(svg);
      const links=collectLinks(svg);
      await svg2pdf(svg,pdf,{x:0,y:0,width:297,height:210});
      annotations.push(links);
    },
    finish(){
      // Destinations can point forward. Add annotations after every page exists.
      // jsPDF link destinations use points for left, but user units for top.
      annotations.forEach((links,i)=>{pdf.setPage(i+1);for(const link of links){const {rect:r,target}=link;if(target.page<1||target.page>count)continue;const left=Math.max(0,r.x),top=Math.max(0,r.y),right=Math.min(WIDTH,r.x+r.width),bottom=Math.min(HEIGHT,r.y+r.height);if(right<=left||bottom<=top)continue;pdf.link(left*MMX,top*MMY,(right-left)*MMX,(bottom-top)*MMY,{pageNumber:target.page,magFactor:'XYZ',left:Math.max(0,target.x-60)*MMX*pdf.internal.scaleFactor,top:Math.max(0,target.y-60)*MMY,zoom:0});}});
      return pdf.output('blob');
    },
    dispose(){host.remove();}
  };
}
globalThis.CabelPDF={snapshot,create};
