import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {handle,nodeHeaders} from './handler.mjs';
import {build} from '../scripts/build.mjs';
await build();const root=path.resolve('dist'),port=Number(process.env.PORT||5173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.wasm':'application/wasm','.gz':'application/gzip'};
const server=http.createServer(async(req,res)=>{try{const host=req.headers.host;if(!['localhost:'+port,'127.0.0.1:'+port].includes(host)){res.writeHead(403);return res.end('Endereço local inválido');}const url=new URL(req.url,'http://'+host);if(url.pathname==='/logout'){res.writeHead(302,{Location:'/api/auth/logout'});return res.end();}
 if(url.pathname.startsWith('/api/')){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>17e6){res.writeHead(413);return res.end('Arquivo muito grande');}chunks.push(c);}const h=new Headers();for(const[k,v]of Object.entries(req.headers))if(v)h.set(k,Array.isArray(v)?v.join(','):v);h.set('x-real-ip',req.socket.remoteAddress);const request=new Request(url,{method:req.method,headers:h,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});const result=await handle(request);res.writeHead(result.status,nodeHeaders(result.headers));return res.end(Buffer.from(await result.arrayBuffer()));}
 let p=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!p.startsWith(root+path.sep)&&p!==root){res.writeHead(403);return res.end();}if((await stat(p)).isDirectory())p=path.join(p,'index.html');const data=await readFile(p);res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(data);}catch{res.writeHead(404);res.end('Página não encontrada');}});
server.listen(port,'127.0.0.1',()=>console.log(`Casa Verde: http://localhost:${port}\nPainel: http://localhost:${port}/admin\nDados locais: .data (faça backup desta pasta)`));
