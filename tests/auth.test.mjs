import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
// Simula o modo hospedado (Supabase Auth) com fetch falso; o banco continua sendo o SQLite local do teste.
process.env.DATA_DIR=await mkdtemp(path.join(os.tmpdir(),'cv-auth-'));process.env.OWNER_EMAIL='dono@loja.com';
const {handle}=await import('../server/handler.mjs');const {close,env}=await import('../server/runtime.mjs');const {resetSignupCache}=await import('../server/auth.mjs');
const origin='http://localhost:5173',realFetch=globalThis.fetch;let signup={disable_signup:false,mailer_autoconfirm:true};
const users={AT1:{id:'u1',email:'dono@loja.com',email_confirmed_at:'2026-01-01'},AT2:{id:'u1',email:'dono@loja.com',email_confirmed_at:'2026-01-01'},UNCONF:{id:'u9',email:'dono@loja.com',email_confirmed_at:null},CONVIDADO:{id:'u2',email:'convidado@loja.com',email_confirmed_at:'2026-01-01'}};
globalThis.fetch=async(url,opts={})=>{url=String(url);if(!url.startsWith('https://sb.test'))return realFetch(url,opts);const j=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 if(url.includes('/auth/v1/settings'))return j(signup);
 if(url.includes('/auth/v1/user')){const u=users[(opts.headers?.Authorization||'').replace('Bearer ','')];return u?j(u):j({msg:'invalid'},401);}
 const body=JSON.parse(opts.body||'{}');
 if(url.includes('grant_type=password'))return body.password==='certa'?j({access_token:'AT1',refresh_token:'RT1',expires_in:3600}):j({error:'invalid'},400);
 if(url.includes('grant_type=refresh_token'))return body.refresh_token==='RT1'?j({access_token:'AT2',refresh_token:'RT2',expires_in:3600}):j({error:'invalid'},400);
 return j({},404);};
async function call(route,{method='GET',body,cookie,ip='1.1.1.1',raw}={}){return handle(new Request(origin+'/api/'+route,{method,headers:{Origin:origin,'x-real-ip':ip,...(cookie?{Cookie:cookie}:{}),...(body||raw?{'Content-Type':'application/json'}:{})},...(body||raw?{body:raw??JSON.stringify(body)}:{})}));}
const login=(password,ip)=>call('auth/login',{method:'POST',body:{email:'dono@loja.com',password},ip});
test('inicia o banco local e passa ao modo hospedado simulado',async()=>{assert.equal((await call('catalog')).status,200);process.env.DATABASE_URL='postgres://simulado';process.env.SUPABASE_URL='https://sb.test';process.env.SUPABASE_ANON_KEY='anon';});

test('item 3: login grava sessão e refresh; sessão vencida é renovada sem pedir senha',async()=>{
 const r=await login('certa','2.2.2.2');assert.equal(r.status,200);const cookies=r.headers.getSetCookie();assert.equal(cookies.length,2);
 assert.match(cookies.find(c=>c.startsWith('cv_session=AT1')),/Max-Age=3600/);assert.match(cookies.find(c=>c.startsWith('cv_refresh=RT1')),/Max-Age=2592000/);assert.ok(cookies.every(c=>/HttpOnly/.test(c)&&/SameSite=Lax/.test(c)));
 // token vencido + refresh válido
 const me=await call('me',{cookie:'cv_session=EXPIRED; cv_refresh=RT1'});const data=await me.json();assert.equal(data.admin,true);const renewed=me.headers.getSetCookie();assert.ok(renewed.some(c=>c.startsWith('cv_session=AT2')));assert.ok(renewed.some(c=>c.startsWith('cv_refresh=RT2')));
 // sem sessão nenhuma (ou refresh inválido): não é admin
 assert.equal((await (await call('me',{cookie:'cv_session=EXPIRED; cv_refresh=RUIM'})).json()).admin,false);assert.equal((await (await call('me')).json()).admin,false);
 // sessão ainda válida não gera cookies novos
 const ok=await call('me',{cookie:'cv_session=AT1; cv_refresh=RT1'});assert.equal((await ok.json()).admin,true);assert.equal(ok.headers.getSetCookie().length,0);
 // logout limpa os dois cookies
 const out=await call('auth/logout');assert.equal(out.headers.getSetCookie().filter(c=>/Max-Age=0/.test(c)).length,2);
});

test('item 2: e-mail não confirmado não vira administrador',async()=>{const d=await (await call('me',{cookie:'cv_session=UNCONF'})).json();assert.equal(d.admin,false);assert.equal(d.email,null);});

test('item 2: convidado só é vinculado se o cadastro público não permitir e-mail falso',async()=>{
 await env.DB.prepare('INSERT INTO admins(email,user_id) VALUES(?,NULL) ON CONFLICT(email) DO NOTHING').bind('convidado@loja.com').run();
 // cadastro aberto + confirmação automática = qualquer um registraria o e-mail do convidado
 signup={disable_signup:false,mailer_autoconfirm:true};resetSignupCache();assert.equal((await (await call('me',{cookie:'cv_session=CONVIDADO'})).json()).admin,false);
 assert.equal((await env.DB.prepare('SELECT user_id FROM admins WHERE email=?').bind('convidado@loja.com').first()).user_id,null);
 // cadastro público desligado: vincula
 signup={disable_signup:true,mailer_autoconfirm:true};resetSignupCache();assert.equal((await (await call('me',{cookie:'cv_session=CONVIDADO'})).json()).admin,true);
 // cadastro aberto mas com confirmação por e-mail: o e-mail confirmado prova a posse
 await env.DB.prepare("UPDATE admins SET user_id=NULL WHERE email='convidado@loja.com'").run();signup={disable_signup:false,mailer_autoconfirm:false};resetSignupCache();assert.equal((await (await call('me',{cookie:'cv_session=CONVIDADO'})).json()).admin,true);
 // o proprietário nunca depende dessa checagem
 signup={disable_signup:false,mailer_autoconfirm:true};resetSignupCache();assert.equal((await (await call('me',{cookie:'cv_session=AT1'})).json()).admin,true);
});

test('item 4: limite de tentativas fica no banco, por IP, e zera após login correto',async()=>{
 for(let i=0;i<10;i++)assert.equal((await login('errada','9.9.9.9')).status,401);
 assert.equal((await login('certa','9.9.9.9')).status,429); // bloqueado mesmo com a senha certa
 assert.equal((await login('certa','8.8.8.8')).status,200); // outro IP segue normal
 const n=await env.DB.prepare("SELECT COUNT(*) as n FROM records WHERE kind='loginAttempts'").first();assert.equal(Number(n.n),10); // só o IP bloqueado; o outro foi limpo no sucesso
 // tentativas antigas expiram
 await env.DB.prepare("UPDATE records SET created=? WHERE kind='loginAttempts'").bind(Date.now()-901000).run();assert.equal((await login('certa','9.9.9.9')).status,200);
 // JSON malformado não derruba o servidor
 assert.equal((await call('auth/login',{method:'POST',raw:'{nao-json',ip:'7.7.7.7'})).status,400);
});

test('item 5: catálogo público é cacheável pelo CDN; rotas privadas não',async()=>{
 const c=await call('catalog');assert.match(c.headers.get('cache-control'),/s-maxage=30/);assert.match(c.headers.get('cache-control'),/stale-while-revalidate/);assert.doesNotMatch(c.headers.get('cache-control'),/no-store/);
 assert.equal((await call('dashboard',{cookie:'cv_session=AT1'})).headers.get('cache-control'),'no-store');assert.equal((await call('me')).headers.get('cache-control'),'no-store');
});

test.after(async()=>{globalThis.fetch=realFetch;delete process.env.DATABASE_URL;await close();await rm(process.env.DATA_DIR,{recursive:true,force:true});});
