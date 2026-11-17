import { defineConfig } from 'vite';
import { handleApi } from './src/api.js';
export default defineConfig({
 build:{outDir:'dist/client',emptyOutDir:true},
 plugins:[{name:'shadowpact-api',configureServer(server){server.middlewares.use(async(req,res,next)=>{if(!req.url.startsWith('/api/'))return next();try{let body='';for await(const chunk of req)body+=chunk;const request=new Request('http://localhost'+req.url,{method:req.method,headers:req.headers,...(body?{body}:{})});const result=await handleApi(request,process.env);res.writeHead(result.status,Object.fromEntries(result.headers));if(result.body){for await(const chunk of result.body){res.write(Buffer.from(chunk));}}res.end();}catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'The policy service could not complete this request.'}));console.error(e.message);}});}}]
});
