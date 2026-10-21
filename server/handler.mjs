import {init} from './runtime.mjs';
import {identity,authRoute} from './auth.mjs';
import {api} from './api.mjs';
let ready;

/** Converte Headers em objeto para res.writeHead sem perder cookies repetidos (Set-Cookie). */
export function nodeHeaders(headers){
 const out={};
 for(const [k,v] of headers)if(k!=='set-cookie')out[k]=v;
 const cookies=headers.getSetCookie?.()||[];
 if(cookies.length)out['set-cookie']=cookies;
 return out;
}

export async function handle(req){try{ready??=init();await ready;const u=new URL(req.url),route=u.pathname.replace(/^\/api\/?/,'');const auth=await authRoute(req,route);if(auth)return auth;
 const h=new Headers(req.headers);h.delete('oai-authenticated-user-id');h.delete('oai-authenticated-user-email');const who=await identity(req);if(who){h.set('oai-authenticated-user-id',who.id);h.set('oai-authenticated-user-email',who.email);}
 const res=await api(new Request(req,{headers:h}));
 // Sessão renovada: grava os novos cookies junto com a resposta.
 if(who?.cookies?.length){const headers=new Headers(res.headers);for(const c of who.cookies)headers.append('Set-Cookie',c);return new Response(res.body,{status:res.status,headers});}
 return res;}catch(e){console.error(e.message);return Response.json({error:'Falha no servidor. Confira a configuração e os logs.'},{status:500});}}
