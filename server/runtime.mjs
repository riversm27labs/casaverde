import {AsyncLocalStorage} from 'node:async_hooks';
import {mkdir,writeFile,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
export const context=new AsyncLocalStorage();
const dataDir=path.resolve(process.env.DATA_DIR||'.data');
const schema=process.env.STORE_SCHEMA||'cv_casaverde';
if(!/^cv_[a-z0-9_]{1,50}$/.test(schema))throw Error('STORE_SCHEMA inválido');
let database,pg;
export async function init(){
 if(process.env.DATABASE_URL){for(const key of ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','OWNER_EMAIL'])if(!process.env[key])throw Error('Configure '+key);const {default:postgres}=await import('postgres');const opts={max:3,prepare:false,connect_timeout:10,idle_timeout:5,max_lifetime:300,ssl:process.env.DATABASE_SSL==='false'?false:'require'},mk=()=>postgres(process.env.DATABASE_URL,opts);let cur=mk();const guard=async fn=>{for(let i=0;;i++){let t;try{return await Promise.race([fn(cur),new Promise((_,rej)=>{t=setTimeout(()=>rej(Error('db-timeout')),5000);})]);}catch(e){if(e.message!=='db-timeout'||i>=1)throw e;const old=cur;cur=mk();old.end({timeout:0}).catch(()=>{});}finally{clearTimeout(t);}}};pg={unsafe:(s,a)=>guard(c=>c.unsafe(s,a)),begin:f=>guard(c=>c.begin(f)),end:()=>cur.end()};}
 else {if(process.env.VERCEL)throw Error('Configure DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e OWNER_EMAIL.');await mkdir(dataDir,{recursive:true});const {DatabaseSync}=await import('node:sqlite');database=new DatabaseSync(path.join(dataDir,'casa-verde.sqlite'));database.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL,created INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS admins(email TEXT PRIMARY KEY,user_id TEXT);');}
}
export function translate(sql){
 let t=sql;
 if(t.startsWith('UPDATE records SET data=json_set')){
 t="UPDATE records SET data=((data::jsonb || jsonb_build_object('unitCost',?::numeric,'quantityReceived',COALESCE((data::jsonb->>'quantityReceived')::numeric,0)+?::numeric,'supplierCode',?::text,'supplierKey',?::text,'supplier',?::text,'supplierCnpj',?::text,'gtin',?::text,'pricingStale',true,'stock','disponivel','lastInvoice',?::jsonb))::text) WHERE id=? AND kind='products' AND NOT EXISTS(SELECT 1 FROM records WHERE id=?)";
 }
 t=t.replace(/json_extract\(data,'\$\.(\w+)'\)/g,"(data::jsonb->>'$1')");
 t=t.replace(/\brecords\b/g,`"${schema}".records`).replace(/\badmins\b/g,`"${schema}".admins`);
 let i=0;return t.replace(/\?/g,()=>'$'+(++i));
}
class Statement{
 constructor(sql,args=[]){this.sql=sql;this.args=args;}bind(...args){return new Statement(this.sql,args);}
 async execute(connection=pg){if(pg){const rows=await connection.unsafe(translate(this.sql),this.args);return {results:rows.map(x=>({...x,created:x.created===undefined?undefined:Number(x.created)})),meta:{changes:rows.count||0}};}
 const st=database.prepare(this.sql);if(/^\s*SELECT/i.test(this.sql))return {results:st.all(...this.args),meta:{changes:0}};const r=st.run(...this.args);return {results:[],meta:{changes:Number(r.changes)}};}
 async all(){return this.execute();}async first(){return (await this.execute()).results[0]||null;}async run(){return this.execute();}
}
const DB={prepare(sql){return new Statement(sql);},async batch(statements){if(pg)return pg.begin(async tx=>{const out=[];for(const st of statements)out.push(await st.execute(tx));return out;});database.exec('BEGIN IMMEDIATE');try{const out=[];for(const st of statements)out.push(await st.execute());database.exec('COMMIT');return out;}catch(e){database.exec('ROLLBACK');throw e;}}};
async function storage(key,method,bytes,mime){if(!/^(invoices\/)?[a-f0-9-]+\.(jpg|png|webp|gif|pdf|xml)$/.test(key))throw Error('Chave inválida');if(process.env.SUPABASE_URL){const bucket=key.startsWith('invoices/')?'cv-invoices':'cv-images';const object=`${schema}/${key}`;const u=process.env.SUPABASE_URL+'/storage/v1/object/'+bucket+'/'+object;const r=await fetch(u,{method:method==='HEAD'?'GET':method,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,...(mime?{'Content-Type':mime}:{})},...(bytes?{body:bytes}:{})});if(r.status===404||r.status===400&&method!=='POST')return null;if(!r.ok)throw Error('Falha no armazenamento: '+r.status);return r;}
 const p=path.join(dataDir,'files',key);if(method==='POST'){await mkdir(path.dirname(p),{recursive:true});await writeFile(p,bytes);return true;}try{if(method==='HEAD')return await stat(p);return new Response(await readFile(p),{headers:{'Content-Type':({'jpg':'image/jpeg','png':'image/png','webp':'image/webp','gif':'image/gif','pdf':'application/pdf','xml':'application/xml'})[key.split('.').pop()]}});}catch(e){if(e.code==='ENOENT')return null;throw e;}}
const BUCKET={async put(key,bytes,opts){await storage(key,'POST',bytes,opts?.httpMetadata?.contentType);},async get(key){const r=await storage(key,'GET');return r?{body:r.body,httpMetadata:{contentType:r.headers.get('content-type')}}:null;},async head(key){return storage(key,'HEAD');}};
export const env={DB,BUCKET};
export async function close(){database?.close();await pg?.end();}
