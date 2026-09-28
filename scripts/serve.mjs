import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.task':'application/octet-stream','.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain; charset=utf-8'};
const port=Number(process.env.PORT??3000);
createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
  const url=new URL(req.url,'http://localhost'),path=resolve(root,'.'+decodeURIComponent(url.pathname));
  if(path!==root.slice(0,-1)&&!path.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403);res.end();return;}
  const file=(await stat(path)).isDirectory()?resolve(path,'index.html'):path;
  const data=await readFile(file);
  res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Permissions-Policy':'camera=(self), microphone=()'});
  res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Не найдено');}
}).listen(port,'127.0.0.1',()=>console.log(`SIGNA: http://localhost:${port}`));
