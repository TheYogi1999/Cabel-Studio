/* README is the shared source for the offline settings shortcut reference. */
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const plain=s=>s.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*|`/g,'').trim();
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8'),start=readme.indexOf('## Shortcuts\n'),end=readme.indexOf('\n## ',start+1);
if(start<0)throw Error('Missing README shortcuts');
const data={intro:[],sections:[]};let section=null;
for(const line of readme.slice(start,end<0?undefined:end).split('\n')){
 if(line.startsWith('### ')){section={title:line.slice(4),notes:[],rows:[]};data.sections.push(section);}
 else if(line.startsWith('|')){const cols=line.slice(1,-1).split('|').map(plain);if(cols.every(c=>/^[-: ]+$/.test(c))||!section||section.rows.length===0&&['Shortcut','Input','Shortcut / gesture','Gesture / control'].includes(cols[0]))continue;section.rows.push(cols);}
 else if(line.trim()&&!line.startsWith('#')&&!line.startsWith('[Main editor]'))(section?section.notes:data.intro).push(plain(line));
}
if(data.sections.length!==6||data.sections.some(s=>!s.rows.length))throw Error('Incomplete shortcut reference');
const output='// Generated from README Shortcuts by scripts/build-shortcuts.cjs.\nglobalThis.CABEL_SHORTCUTS='+JSON.stringify(data)+';\n',target=path.join(root,'scripts/shortcuts-data.js');
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==output)throw Error('Stale shortcuts: run node scripts/build-shortcuts.cjs');}else fs.writeFileSync(target,output);
console.log(data.sections.reduce((n,s)=>n+s.rows.length,0)+' shortcut/gesture entries; reference '+(process.argv.includes('--check')?'verified':'generated'));
