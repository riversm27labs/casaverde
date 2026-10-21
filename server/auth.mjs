import {randomBytes,scryptSync,timingSafeEqual,createHmac,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {env} from './runtime.mjs';

const dir=path.resolve(process.env.DATA_DIR||'.data');let local;
const email=()=>process.env.OWNER_EMAIL?.toLowerCase()||'admin@localhost';
const remote=()=>!!process.env.DATABASE_URL;

// ---------- cookies ----------
const REFRESH_MAX=30*86400;
const cookie=(name,value,secure,max=86400)=>`${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${max}${secure?'; Secure':''}`;
function parseCookies(req){const jar={};for(const part of (req.headers.get('cookie')||'').split(';')){const i=part.indexOf('=');if(i>0)jar[part.slice(0,i).trim()]=part.slice(i+1).trim();}return jar;}
// Sessão Supabase: o access token vence em ~1h; o refresh token (30 dias) renova sem pedir senha de novo.
const sessionCookies=(v,secure)=>[cookie('cv_session',v.access_token,secure,Math.max(60,Number(v.expires_in)||3600)),cookie('cv_refresh',v.refresh_token,secure,REFRESH_MAX)];
const clearedCookies=secure=>[cookie('cv_session','',secure,0),cookie('cv_refresh','',secure,0)];

function sign(v,key){return createHmac('sha256',key).update(v).digest('hex');}
async function account(){if(remote())return null;if(local)return local;try{local=JSON.parse(await readFile(path.join(dir,'account.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}return local;}

// ---------- Supabase Auth ----------
const supabase=(route,opts={})=>fetch(process.env.SUPABASE_URL+'/auth/v1/'+route,{...opts,headers:{apikey:process.env.SUPABASE_ANON_KEY,...(opts.headers||{})}});
const verified=new Map(); // hash do token -> {user, until}: evita uma ida ao Supabase por requisição
async function fetchUser(token){
 const key=createHash('sha256').update(token).digest('hex'),hit=verified.get(key);
 if(hit&&hit.until>Date.now())return hit.user;
 const r=await supabase('user',{headers:{Authorization:'Bearer '+token}});if(!r.ok)return null;
 const u=await r.json();
 // Conta sem e-mail confirmado não prova que a pessoa é dona do endereço.
 if(!u.email||!(u.email_confirmed_at||u.confirmed_at))return null;
 const user={id:u.id,email:u.email.toLowerCase()};
 verified.set(key,{user,until:Date.now()+60000});
 if(verified.size>200)for(const [k,v] of verified)if(v.until<Date.now())verified.delete(k);
 return user;
}
const refreshing=new Map(); // requisições paralelas com o mesmo refresh token compartilham uma única renovação
function refreshSession(token){
 if(!refreshing.has(token)){
  const p=(async()=>{const r=await supabase('token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:token})});if(!r.ok)return null;const v=await r.json();return v.access_token&&v.refresh_token?v:null;})().finally(()=>setTimeout(()=>refreshing.delete(token),15000));
  refreshing.set(token,p);
 }
 return refreshing.get(token);
}

/** Retorna {id,email,cookies?} ou null. `cookies` existe quando a sessão foi renovada e precisa ser regravada. */
export async function identity(req){
 const jar=parseCookies(req),secure=new URL(req.url).protocol==='https:';
 if(remote()){
  if(jar.cv_session){const user=await fetchUser(jar.cv_session);if(user)return user;}
  if(jar.cv_refresh){const v=await refreshSession(jar.cv_refresh);if(v){const user=await fetchUser(v.access_token);if(user)return {...user,cookies:sessionCookies(v,secure)};}}
  return null;
 }
 const token=jar.cv_session;if(!token)return null;
 const a=await account();if(!a)return null;const [expires,signature]=token.split('.');const expected=sign(expires,a.secret);if(!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected))||Number(expires)<Date.now())return null;return {id:'local-owner',email:email()};
}

// Administrador convidado só é vinculado a uma conta se o e-mail for comprovadamente do convidado.
// Com cadastro público aberto E confirmação automática, qualquer pessoa registraria o e-mail do convidado antes dele.
let signupInfo={at:0,safe:false};
export function resetSignupCache(){signupInfo={at:0,safe:false};}
export async function canBindInvited(){
 if(!remote())return true;
 if(Date.now()-signupInfo.at<600000)return signupInfo.safe;
 try{const r=await supabase('settings');if(!r.ok)throw Error('status '+r.status);const s=await r.json();signupInfo={at:Date.now(),safe:!!s.disable_signup||!s.mailer_autoconfirm};}
 catch(e){console.error('Não foi possível verificar o cadastro público do Supabase:',e.message);return false;}
 if(!signupInfo.safe)console.error('ATENÇÃO: cadastro público e confirmação automática estão ligados no Supabase Auth. Desative "Allow new users to sign up" para permitir novos administradores.');
 return signupInfo.safe;
}

// ---------- limite de tentativas (no banco: vale para todas as instâncias da Vercel) ----------
const WINDOW=900000,LIMIT=10;
const ipHash=req=>createHash('sha256').update(String(req.headers.get('x-real-ip')||'local')).digest('hex');
async function tooMany(ip){
 await env.DB.prepare("DELETE FROM records WHERE kind='loginAttempts' AND created<?").bind(Date.now()-WINDOW).run();
 const r=await env.DB.prepare("SELECT COUNT(*) as n FROM records WHERE kind='loginAttempts' AND json_extract(data,'$.ip')=?").bind(ip).first();
 return Number(r?.n||0)>=LIMIT;
}
const noteAttempt=ip=>env.DB.prepare("INSERT INTO records(id,kind,data,created) VALUES(?,'loginAttempts',?,?)").bind(crypto.randomUUID(),JSON.stringify({ip}),Date.now()).run();
const clearAttempts=ip=>env.DB.prepare("DELETE FROM records WHERE kind='loginAttempts' AND json_extract(data,'$.ip')=?").bind(ip).run();

export async function authRoute(req,route){
 const secure=new URL(req.url).protocol==='https:';
 const out=(data,status=200,cookies=[])=>{const h=new Headers({'Cache-Control':'no-store'});for(const c of cookies)h.append('Set-Cookie',c);return Response.json(data,{status,headers:h});};
 if(route==='auth/status')return out({configured:remote()||!!await account(),remote:remote()});
 if(route==='auth/logout'){const h=new Headers({Location:'/login'});for(const c of clearedCookies(secure))h.append('Set-Cookie',c);return new Response(null,{status:302,headers:h});}
 if(!['auth/setup','auth/login'].includes(route))return null;
 if(req.method!=='POST')return out({error:'Método inválido'},405);
 if(req.headers.get('origin')!==new URL(req.url).origin)return out({error:'Origem inválida'},403);
 const ip=ipHash(req);
 if(await tooMany(ip))return out({error:'Muitas tentativas. Aguarde 15 minutos.'},429);
 await noteAttempt(ip);
 let b;try{b=await req.json();}catch{return out({error:'Requisição inválida.'},400);}
 if(!b||typeof b!=='object')return out({error:'Requisição inválida.'},400);
 let cookies;
 if(remote()){
  if(route==='auth/setup')return out({error:'Cadastre o usuário no Supabase Auth.'},400);
  const r=await supabase('token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:String(b.email||''),password:String(b.password||'')})});
  const v=await r.json();if(!r.ok||!v.access_token)return out({error:'E-mail ou senha inválidos.'},401);
  cookies=sessionCookies(v,secure);
 }
 else {let a=await account();if(route==='auth/setup'){if(a)return out({error:'A conta já está configurada.'},409);if(typeof b.password!=='string'||b.password.length<10)return out({error:'Use uma senha com pelo menos 10 caracteres.'},400);const salt=randomBytes(16).toString('hex');a={salt,hash:scryptSync(b.password,salt,64).toString('hex'),secret:randomBytes(32).toString('hex')};await mkdir(dir,{recursive:true});try{await writeFile(path.join(dir,'account.json'),JSON.stringify(a),{flag:'wx',mode:0o600});local=a;}catch{return out({error:'A conta já foi configurada.'},409);}}
 else {if(!a)return out({error:'Configure a primeira senha.'},400);const hash=scryptSync(String(b.password||''),a.salt,64);if(!timingSafeEqual(hash,Buffer.from(a.hash,'hex')))return out({error:'Senha inválida.'},401);}
 const expires=String(Date.now()+86400000);cookies=[cookie('cv_session',expires+'.'+sign(expires,a.secret),secure)];}
 await clearAttempts(ip);
 return out({ok:true},200,cookies);
}
