import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
process.env.DATA_DIR=await mkdtemp(path.join(os.tmpdir(),'cv-store-'));
const {handle}=await import('../server/handler.mjs');
const {env,close,translate}=await import('../server/runtime.mjs');
const origin='http://localhost:5173';
async function call(route,body){const r=await handle(new Request(origin+'/api/'+route,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));return {status:r.status,data:await r.json()};}
test('catálogo paginado, preço comercial, privacidade, carrinho e solicitação idempotente',async()=>{
 await call('catalog');
 async function put(id,changes={}){await env.DB.prepare('INSERT INTO records(id,kind,data,created) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(id,'products',JSON.stringify({name:'Vaso '+id,description:'Cerâmica artesanal',category:'Vasos',images:[],published:true,stock:'disponivel',price:20,unitCost:7,supplierCnpj:'privado',...changes}),Date.now()).run();}
 for(let i=0;i<15;i++)await put('p'+i,{price:i+10});
 await put('hidden',{published:false});await put('sold',{stock:'esgotado'});await put('unpriced',{price:null});
 let r=await call('catalog?page=1');assert.equal(r.data.products.length,12);assert.equal(r.data.total,17);assert.deepEqual(r.data.categories,['Vasos']);assert.equal(r.data.products[0].unitCost,undefined);assert.equal(r.data.settings.adminEmails,undefined);
 r=await call('catalog?page=1&q=artesanal&min=15&max=17&sort=maior');assert.deepEqual(r.data.products.map(x=>x.price),[17,16,15]);
 assert.equal((await call('catalog?page=1&category=Ausente')).data.total,0);assert.equal((await call('catalog/hidden')).status,404);assert.deepEqual((await call('catalog/p1')).data.images,[]);
 await put('p1',{price:31});assert.equal((await call('catalog/p1')).data.price,31);
 for(const items of [[{id:'p1',qty:1.5}],[{id:'p1',qty:0}],[{id:'p1',qty:100}],[{id:'hidden',qty:1}],[{id:'sold',qty:1}],[{id:'unpriced',qty:1}],[{id:'p1',qty:1},{id:'p1',qty:1}]])assert.equal((await call('quote',{items})).status,409);
 r=await call('quote',{items:[{id:'p1',qty:2,price:1}]});assert.equal(r.data.total,62);assert.equal(r.data.items[0].price,31);
 const payload={name:'Cliente',phone:'63999999999',message:'Interesse: Jardinagem\nLocalização: Centro\nProjeto real',items:[{id:'p1',qty:2,price:1}],requestId:crypto.randomUUID()};
 assert.equal((await call('inquiries',payload)).status,409);payload.items[0].price=31;
 assert.equal((await call('inquiries',{...payload,phone:'abc'})).status,400);
 const results=await Promise.all([call('inquiries',payload),call('inquiries',payload)]);assert.equal(results[0].data.id,results[1].data.id);
 const saved=await env.DB.prepare("SELECT data FROM records WHERE id=? AND kind='inquiries'").bind(payload.requestId).first();assert.equal(JSON.parse(saved.data).status,'nova');assert.equal(JSON.parse(saved.data).items[0].price,31);
 assert.equal((await call('inquiries',{...payload,message:'outra'})).status,409);
 assert.equal((await call('dashboard')).status,401);
});
test('SQL de paginação é compatível com PostgreSQL',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const pg=new PGlite();try{await pg.exec('CREATE SCHEMA cv_casaverde; CREATE TABLE cv_casaverde.records(id text PRIMARY KEY,kind text,data text,created bigint)');await pg.query(translate('INSERT INTO records(id,kind,data,created) VALUES(?,?,?,?)'),['p','products',JSON.stringify({published:true,price:20,name:'Vaso'}),1]);const r=await pg.query(translate("SELECT id FROM records WHERE kind='products' AND CAST(json_extract(data,'$.published') AS TEXT) IN ('true','1') AND CAST(json_extract(data,'$.price') AS REAL)>=? ORDER BY created DESC,id LIMIT 12 OFFSET ?"),[10,0]);assert.equal(r.rows[0].id,'p');}finally{await pg.close();}
});
test.after(async()=>{await close();await rm(process.env.DATA_DIR,{recursive:true,force:true});});
