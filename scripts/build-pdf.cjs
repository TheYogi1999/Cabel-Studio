// Local, pinned renderer and fonts: exporting never needs a CDN or a server.
const path=require('node:path');
require('esbuild').buildSync({entryPoints:[path.join(__dirname,'pdf-entry.js')],outfile:path.join(__dirname,'../vendor/pdf.js'),bundle:true,minify:true,legalComments:'linked',target:['es2020'],format:'iife',loader:{'.ttf':'base64'}});
