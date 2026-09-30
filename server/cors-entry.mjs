import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const releaseRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const releaseArchive=path.join(releaseRoot,'deploy','prod-core-v0103.tgz');
if(existsSync(releaseArchive)){
  try{
    execFileSync('tar',['-xzf',releaseArchive,'-C',releaseRoot],{stdio:'inherit'});
    console.log('Applied Paradise v0.10.3 production payload.');
  }catch(error){
    console.error('Paradise v0.10.3 payload extraction failed:',error);
    process.exit(1);
  }
}

import http from 'node:http';

const allowedOrigins=new Set([
  'https://paradiselawncaretreasurecoast.com',
  'https://www.paradiselawncaretreasurecoast.com'
]);

const originalCreateServer=http.createServer.bind(http);

http.createServer=(handler)=>originalCreateServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    const isPublicApi=url.pathname.startsWith('/api/public/');
    const origin=String(req.headers.origin||'');
    const originAllowed=allowedOrigins.has(origin);

    if(isPublicApi&&originAllowed){
      res.setHeader('Access-Control-Allow-Origin',origin);
      res.setHeader('Vary','Origin');
      res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers','Content-Type');
      res.setHeader('Access-Control-Max-Age','86400');
    }

    if(isPublicApi&&req.method==='OPTIONS'){
      if(!originAllowed){
        res.writeHead(403,{'content-type':'text/plain; charset=utf-8'});
        return res.end('Origin not allowed');
      }
      res.writeHead(204);
      return res.end();
    }

    return await handler(req,res);
  }catch(err){
    console.error('CORS entry error:',err);
    return handler(req,res);
  }
});

await import('./server.mjs');
