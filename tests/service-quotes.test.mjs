import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {inflateSync} from 'node:zlib';
import {Readable} from 'node:stream';
import {emptyServiceConfig,validateServiceConfig,calculateServiceQuote} from '../server/service-pricing.mjs';
process.env.DATA_DIR=await mkdtemp(path.join(os.tmpdir(),'cv-services-'));
const {handle}=await import('../server/handler.mjs'),{close,env}=await import('../server/runtime.mjs');
const origin='http://localhost:5173';let cookie='';
async function call(route,method='GET',body,auth=false,extra={}){return handle(new Request(origin+'/api/'+route,{method,headers:{Origin:origin,'Content-Type':'application/json',...(auth?{Cookie:cookie}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})}));}
async function json(...args){const response=await call(...args);return {status:response.status,data:await response.json()};}
function configured(){const config=emptyServiceConfig();config.services[0]={...config.services[0],basePrice:50,pricePerM2:5,minimum:100,requiresVisit:false};config.levels.forEach((level,index)=>level.multiplier=[1,1.2,1.5][index]);config.frequencies[0].multiplier=1;config.regions=[{id:'centro',name:'Centro',fee:20}];config.materials=[{id:'substrato',name:'Substrato',price:10,mode:'fixed',unit:'saco',enabled:true}];config.addons=[{id:'plantio-extra',name:'Plantio adicional',price:2,mode:'per_m2',unit:'m²',enabled:true}];config.discounts=[{id:'autorizado',name:'Condição autorizada',percent:10,enabled:true}];config.validityDays=10;config.paymentTerms='Condições comerciais de teste, não publicar na loja real.';return validateServiceConfig(config);}
const selection={serviceId:'jardinagem',area:20,levelId:'premium',location:'Centro, cidade de teste',regionId:'centro',frequencyId:'pontual',materials:[{id:'substrato',qty:2}],addons:[{id:'plantio-extra',qty:1}],discountId:'autorizado'};
test('motor monetário, mínimos, faixas, complexidade, complementos e descontos autorizados',()=>{
 const config=configured(),quote=calculateServiceQuote(config,selection);assert.equal(quote.total,274.5);assert.equal(quote.subtotal,305);assert.equal(quote.discount,30.5);assert.equal(quote.status,'estimativo');
 const minimum=calculateServiceQuote(config,{...selection,area:1,levelId:'basico',materials:[],addons:[],discountId:''});assert.equal(minimum.total,120);
 config.services[0].areaBands=[{upTo:10,pricePerM2:4},{upTo:50,pricePerM2:3}];assert.equal(calculateServiceQuote(config,selection).total,220.5);assert.equal(calculateServiceQuote(config,{...selection,area:60}).total,null);
 assert.equal(calculateServiceQuote(null,{...selection,regionId:'',materials:[],addons:[],discountId:''}).status,'aguardando avaliação');
 for(const patch of [{area:-1},{area:Infinity},{discountId:'fraude'},{materials:[{id:'fraude',qty:1}]},{materials:[{id:'substrato',qty:0}]},{levelId:'fraude'}])assert.throws(()=>calculateServiceQuote(config,{...selection,...patch}));
 config.services[0].requiresVisit=true;assert.equal(calculateServiceQuote(config,selection).status,'aguardando avaliação');
 config.materials[0].price=null;const unpriced=calculateServiceQuote(config,selection);assert.equal(unpriced.total,null);assert.equal(unpriced.requestedItems[0].name,'Substrato');assert.equal(unpriced.requestedItems[0].quantity,2);
});
test('integração: tabela não publicada, publicação explícita, privacidade, PDF e revisão persistida',async()=>{
 let response=await call('auth/setup','POST',{password:'Casa-verde-servicos-2026'});assert.equal(response.status,200);cookie=response.headers.get('set-cookie').split(';')[0];
 assert.equal((await json('service-config')).status,401);assert.equal((await json('service-quote-admin')).status,401);
 assert.equal((await json('service-catalog')).data.published,false);
 const evaluation=await json('service-quotes','POST',{requestId:crypto.randomUUID(),expectedVersion:null,request:{...selection,levelId:'basico',regionId:'',materials:[],addons:[],discountId:''},customer:{name:'Cliente técnico',phone:'63999999999'}});assert.equal(evaluation.status,201);assert.equal(evaluation.data.total,null);
 let draft=(await json('service-config','GET',null,true)).data;const config=configured();
 assert.equal((await json('service-config','PUT',{config,baseRevision:draft.draftRevision},true,{Origin:'https://evil.example'})).status,403);
 let saved=(await json('service-config','PUT',{config,baseRevision:draft.draftRevision,publish:false},true)).data;assert.equal((await json('service-catalog')).data.published,false);
 const published=await json('service-config','PUT',{config,baseRevision:saved.revision,publish:true},true);assert.equal(published.status,200);const version=published.data.versionId;
 assert.equal((await json('service-config','PUT',{config,baseRevision:saved.revision,publish:true},true)).status,409);
 const preview=await json('service-preview','POST',{...selection,total:1,discountPercent:99});assert.equal(preview.data.total,274.5);assert.equal(preview.data.versionId,version);
 const body={requestId:crypto.randomUUID(),expectedVersion:version,request:{...selection,total:1},customer:{name:'Cliente de teste',phone:'63999999999',email:'cliente@example.test'}};
 assert.equal((await json('service-quotes','POST',{...body,customer:{name:'',phone:'1'}})).status,400);
 assert.equal((await json('service-quotes','POST',{...body,expectedVersion:'antiga'})).status,409);
 const results=await Promise.all([json('service-quotes','POST',body),json('service-quotes','POST',body)]);assert.equal(results[0].data.id,results[1].data.id);const quote=results[0].data;assert.equal(quote.total,274.5);assert.equal(quote.rulesSnapshot,undefined);assert.equal(quote.ip,undefined);
 assert.equal((await json('service-quotes/'+quote.id)).status,404);assert.equal((await json('service-quotes/'+quote.id+'?token=fraude')).status,404);assert.equal((await json('service-quotes/'+quote.id+'?token='+quote.token)).data.customer.name,'Cliente de teste');
 response=await call('service-quotes/'+quote.id+'/pdf?token='+quote.token);assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'application/pdf');const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-');assert.ok(bytes.length>10000);
 const pdf=Buffer.from(bytes).toString('latin1'),texts=[];for(const stream of pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)){try{const content=inflateSync(Buffer.from(stream[1],'latin1')).toString('latin1');if(content.includes('BT'))texts.push([...content.matchAll(/<([0-9a-f]+)>/gi)].map(match=>Buffer.from(match[1],'hex').toString('latin1')).join(''));}catch{}}
 assert.match(texts.join(' '),/Cliente de teste/);assert.match(texts.join(' '),/274,50/);assert.match(pdf,/\/Subtype \/Image/);
 const {default:adapter}=await import('../api/index.mjs');
 const adapterRequest=Readable.from([]);adapterRequest.url='/api?route='+encodeURIComponent('service-quotes/'+quote.id+'/pdf')+'&token='+quote.token;adapterRequest.method='GET';adapterRequest.headers={host:'example.test'};
 let adapterStatus,adapterBody;await adapter(adapterRequest,{writeHead(status){adapterStatus=status;},end(body){adapterBody=body;}});assert.equal(adapterStatus,200);assert.equal(adapterBody.subarray(0,5).toString(),'%PDF-');
 const admin=(await json('service-quote-admin','GET',null,true)).data;const stored=admin.quotes.find(item=>item.id===quote.id);assert.equal(stored.rulesSnapshot.services[0].pricePerM2,5);
 assert.equal((await json('service-quote-admin/'+quote.id,'PUT',{status:'aprovado pela empresa',baseRevision:1,note:'Aprovação de teste'},true)).status,200);
 assert.equal((await json('service-quote-admin/'+quote.id,'PUT',{status:'cancelado',baseRevision:1},true)).status,409);
 assert.equal((await json('service-quote-admin/'+evaluation.data.id,'PUT',{status:'aprovado pela empresa',baseRevision:1},true)).status,400);
 const current=(await json('service-config','GET',null,true)).data;config.services[0].pricePerM2=10;await json('service-config','PUT',{config,baseRevision:current.draftRevision,publish:true},true);
 assert.equal((await json('service-quotes/'+quote.id+'?token='+quote.token)).data.total,274.5);
 const revised=await json('service-quote-admin/'+quote.id,'POST',{},true);assert.equal(revised.status,201);assert.equal(revised.data.total,409.5);assert.equal(revised.data.parentId,quote.id);
 assert.equal((await env.DB.prepare("SELECT COUNT(*) as n FROM records WHERE kind='servicePriceVersions'").first()).n,2);
 assert.equal((await json('dashboard','GET',null,true)).status,200);
 const settings=(await json('dashboard','GET',null,true)).data.settings;assert.equal((await json('settings','PUT',{...settings,demoShowcase:false},true)).status,200);assert.equal((await json('catalog')).data.settings.demoShowcase,false);assert.equal((await json('settings','PUT',{...settings,demoShowcase:true},true)).status,200);assert.equal((await json('catalog')).data.settings.demoShowcase,true);
});
test.after(async()=>{await close();await rm(process.env.DATA_DIR,{recursive:true,force:true});});
