import {build as viteBuild} from 'vite';
import {build as esbuild} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
await viteBuild();
const files={};
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.glb':'model/gltf-binary','.txt':'text/plain; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else files['/'+path.relative('dist/client',file)]={body:(await fs.readFile(file)).toString('base64'),mime:mime[path.extname(file)]||'application/octet-stream'};}}
await walk('dist/client');await fs.mkdir('work',{recursive:true});
await fs.writeFile('work/worker.js',`import {handleApi} from '../src/api.js';\nconst assets=${JSON.stringify(files)};\nexport default {async fetch(request,env,ctx){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return handleApi(request,env);const key=url.pathname==='/'?'/index.html':url.pathname;const asset=assets[key];if(!asset)return new Response('Not found',{status:404});if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});const bytes=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.mime,'Cache-Control':key==='/index.html'?'no-cache':'public, max-age=86400','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});}};`);
await fs.mkdir('dist/server',{recursive:true});await esbuild({entryPoints:['work/worker.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});await fs.mkdir('dist/.openai',{recursive:true});await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built Worker with embedded client and 3D assets.');
