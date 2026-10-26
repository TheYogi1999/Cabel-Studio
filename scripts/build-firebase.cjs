// SDK is served locally so GitHub Pages/iPad do not depend on an external CDN.
const esbuild = require('esbuild');
esbuild.buildSync({entryPoints:[require('node:path').join(__dirname,'firebase-entry.js')],outfile:require('node:path').join(__dirname,'../vendor/firebase.js'),bundle:true,minify:true,legalComments:'linked',target:['es2020'],format:'iife'});
