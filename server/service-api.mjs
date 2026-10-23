import {createHash,randomBytes} from 'node:crypto';
import {env} from './runtime.mjs';
import {emptyServiceConfig,validateServiceConfig,calculateServiceQuote} from './service-pricing.mjs';
import {serviceQuotePDF} from './service-pdf.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const db=()=>env.DB;
const text=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
const hash=value=>createHash('sha256').update(value).digest('hex');
async function record(id,kind){const row=await db().prepare('SELECT data,created FROM records WHERE id=? AND kind=?').bind(id,kind).first();return row?{...JSON.parse(row.data),created:Number(row.created)}:null;}
const insert=(id,kind,data)=>db().prepare('INSERT INTO records(id,kind,data,created) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,kind,JSON.stringify(data),Date.now());
async function current(){const pointer=await record('service-price-current','servicePricePointer');return pointer?await record(pointer.versionId,'servicePriceVersions'):null;}
async function company(){const row=await record('settings','settings');return {name:row?.name||'Casa Verde',whatsapp:row?.whatsapp||'',address:row?.address||'',hours:row?.hours||''};}
function publicQuote(quote){const {ip,requestHash,rulesSnapshot,history,...result}=quote;return result;}
const cleanRequest=body=>Object.fromEntries(['serviceId','area','levelId','location','regionId','frequencyId','materials','addons','discountId'].map(key=>[key,body?.[key]??(key==='materials'||key==='addons'?[]:'')]));
export async function publicServiceAPI(req,parts){
  if(!['service-catalog','service-preview','service-quotes'].includes(parts[0]))return null;
  const url=new URL(req.url);
  try{
    if(parts[0]==='service-catalog'&&req.method==='GET'){
      const version=await current();return json({published:!!version,versionId:version?.versionId||null,publishedAt:version?.publishedAt||null,config:version?.config||emptyServiceConfig()});
    }
    if(parts[0]==='service-preview'&&req.method==='POST'){
      if(req.headers.get('origin')!==url.origin)return json({error:'Origem inválida'},403);
      const body=await req.json(),version=await current();const quote=calculateServiceQuote(version?.config,cleanRequest(body));return json({...quote,versionId:version?.versionId||null});
    }
    if(parts[0]==='service-quotes'&&req.method==='POST'&&!parts[1]){
      if(req.headers.get('origin')!==url.origin)return json({error:'Origem inválida'},403);
      const body=await req.json();if(body.website)return json({error:'Solicitação inválida.'},400);
      const customer={name:text(body.customer?.name,100),phone:text(body.customer?.phone,30),email:text(body.customer?.email,200)};
      const digits=customer.phone.replace(/\D/g,'');
      if(!customer.name||digits.length<10||digits.length>15||!/^\+?[\d ()-]+$/.test(customer.phone)||customer.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))return json({error:'Preencha nome e telefone válidos. Revise o e-mail, se informado.'},400);
      if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.requestId||''))return json({error:'Identificador inválido.'},400);
      const input=cleanRequest(body.request),requestHash=hash(JSON.stringify({customer,input})),id='service-quote-'+body.requestId;
      const previous=await record(id,'serviceQuotes');
      if(previous)return previous.requestHash===requestHash?json(publicQuote(previous)):json({error:'Esta referência já foi utilizada. Gere uma nova solicitação.'},409);
      const ip=hash(req.headers.get('x-real-ip')||'local');
      const recent=await db().prepare("SELECT COUNT(*) as n FROM records WHERE kind='serviceQuotes' AND created>? AND json_extract(data,'$.ip')=?").bind(Date.now()-3600000,ip).first();
      if(Number(recent.n)>=12)return json({error:'Limite de solicitações atingido. Tente novamente mais tarde.'},429);
      const version=await current(),calculated=calculateServiceQuote(version?.config,input);
      if(body.expectedVersion!==(version?.versionId||null))return json({error:'A tabela comercial mudou. Confira o cálculo atualizado antes de enviar.'},409);
      const issuedAt=Date.now();
      const quote={id,number:'CV-'+new Date(issuedAt).toISOString().slice(0,10).replaceAll('-','')+'-'+body.requestId.slice(0,8).toUpperCase(),...calculated,customer,versionId:version?.versionId||null,rulesSnapshot:version?.config||null,issuedAt,expiresAt:calculated.validityDays?issuedAt+calculated.validityDays*86400000:null,company:await company(),token:randomBytes(32).toString('hex'),ip,requestHash,history:[{at:issuedAt,status:calculated.status,by:'cliente'}],revision:1};
      await insert(id,'serviceQuotes',quote).run();
      const saved=await record(id,'serviceQuotes');return saved.requestHash===requestHash?json(publicQuote(saved),201):json({error:'Referência já utilizada.'},409);
    }
    if(parts[0]==='service-quotes'&&parts[1]&&req.method==='GET'){
      const quote=await record(parts[1],'serviceQuotes');
      if(!quote||!url.searchParams.get('token')||quote.token!==url.searchParams.get('token'))return json({error:'Orçamento não encontrado ou acesso inválido.'},404);
      if(parts[2]==='pdf')return new Response(await serviceQuotePDF(quote),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${quote.number}.pdf"`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
      return json(publicQuote(quote));
    }
    return null;
  }catch(error){if(error instanceof SyntaxError)return json({error:'Dados inválidos.'},400);if(error.message?.includes('inválid')||error.message?.includes('Selecione')||error.message?.includes('Informe')||error.message?.includes('não dispon')||error.message?.includes('não autoriz')||error.message?.includes('repetid')||error.message?.includes('excede'))return json({error:error.message},400);throw error;}
}
export async function adminServiceAPI(req,parts){
  if(!['service-config','service-quote-admin'].includes(parts[0]))return null;
  try{
    if(parts[0]==='service-config'&&req.method==='GET'){
      const [draft,published]=await Promise.all([record('service-price-draft','servicePriceDraft'),current()]);
      const versions=await db().prepare("SELECT id,data,created FROM records WHERE kind='servicePriceVersions' ORDER BY created DESC LIMIT 30").all();
      return json({draft:draft?.config||emptyServiceConfig(),draftRevision:draft?.revision||null,published,versions:versions.results.map(row=>{const data=JSON.parse(row.data);return {versionId:row.id,publishedAt:data.publishedAt};})});
    }
    if(parts[0]==='service-config'&&req.method==='PUT'){
      const body=await req.json(),config=validateServiceConfig(body.config),old=await record('service-price-draft','servicePriceDraft');
      if((old?.revision||null)!==(body.baseRevision||null))return json({error:'Outro administrador alterou a tabela. Recarregue antes de salvar.'},409);
      const revision=crypto.randomUUID(),draft={config,revision};
      const statement=old?db().prepare("UPDATE records SET data=? WHERE id='service-price-draft' AND data=?").bind(JSON.stringify(draft),JSON.stringify({config:old.config,revision:old.revision})):insert('service-price-draft','servicePriceDraft',draft);
      const saved=await statement.run();if(saved.meta.changes!==1)return json({error:'A tabela foi alterada. Recarregue antes de salvar.'},409);
      let versionId=null;
      if(body.publish===true){
        versionId='service-price-'+crypto.randomUUID();const version={versionId,config,publishedAt:Date.now(),author:req.headers.get('oai-authenticated-user-email')};
        await db().batch([insert(versionId,'servicePriceVersions',version),db().prepare('INSERT INTO records(id,kind,data,created) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind('service-price-current','servicePricePointer',JSON.stringify({versionId}),Date.now())]);
      }
      return json({ok:true,revision,versionId});
    }
    if(parts[0]==='service-quote-admin'&&req.method==='GET'){
      const page=Math.max(1,parseInt(new URL(req.url).searchParams.get('page'))||1);
      const rows=await db().prepare("SELECT id,data,created FROM records WHERE kind='serviceQuotes' ORDER BY created DESC LIMIT 30 OFFSET ?").bind((page-1)*30).all();
      const count=await db().prepare("SELECT COUNT(*) as n FROM records WHERE kind='serviceQuotes'").first();
      return json({quotes:rows.results.map(row=>({...JSON.parse(row.data),created:Number(row.created)})),total:Number(count.n),page});
    }
    if(parts[0]==='service-quote-admin'&&req.method==='PUT'&&parts[1]){
      const old=await record(parts[1],'serviceQuotes');if(!old)return json({error:'Orçamento não encontrado.'},404);
      const body=await req.json();if(body.baseRevision!==old.revision)return json({error:'Este orçamento foi atualizado. Recarregue a lista.'},409);
      if(!['estimativo','aguardando avaliação','aprovado pela empresa','em revisão','cancelado'].includes(body.status))return json({error:'Status inválido.'},400);
      if(body.status==='aprovado pela empresa'&&(old.total===null||!old.expiresAt||old.expiresAt<Date.now()))return json({error:'Para aprovar, revise o orçamento com uma tabela completa e vigente.'},400);
      const updated={...old,status:body.status,revision:old.revision+1,history:[...old.history,{at:Date.now(),status:body.status,note:text(body.note,1000),by:req.headers.get('oai-authenticated-user-email')}]};delete updated.created;
      const raw=await db().prepare("SELECT data FROM records WHERE id=? AND kind='serviceQuotes'").bind(parts[1]).first();
      // O conteúdo original é comparado na gravação para evitar perda de revisão concorrente.
      if(JSON.parse(raw.data).revision!==old.revision)return json({error:'Orçamento atualizado por outro administrador.'},409);
      const result=await db().prepare("UPDATE records SET data=? WHERE id=? AND kind='serviceQuotes' AND data=?").bind(JSON.stringify(updated),parts[1],raw.data).run();
      return result.meta.changes===1?json(publicQuote(updated)):json({error:'Orçamento atualizado. Recarregue a lista.'},409);
    }
    if(parts[0]==='service-quote-admin'&&req.method==='POST'&&parts[1]){
      const old=await record(parts[1],'serviceQuotes');if(!old)return json({error:'Orçamento não encontrado.'},404);
      const version=await current(),calculated=calculateServiceQuote(version?.config,old.request),issuedAt=Date.now(),id='service-quote-'+crypto.randomUUID();
      const quote={...old,...calculated,id,number:old.number+'-R'+crypto.randomUUID().slice(0,4).toUpperCase(),issuedAt,expiresAt:calculated.validityDays?issuedAt+calculated.validityDays*86400000:null,versionId:version?.versionId||null,rulesSnapshot:version?.config||null,token:randomBytes(32).toString('hex'),parentId:old.id,revision:1,history:[{at:issuedAt,status:calculated.status,by:req.headers.get('oai-authenticated-user-email'),note:'Revisão de '+old.number}]};delete quote.created;
      await insert(id,'serviceQuotes',quote).run();return json(publicQuote(quote),201);
    }
    return json({error:'Rota não encontrada.'},404);
  }catch(error){if(error instanceof SyntaxError)return json({error:'Dados inválidos.'},400);if(/invalid|inválid|Configure|Faixas|Validade|informe|identificador|limites/i.test(error.message))return json({error:error.message},400);throw error;}
}
