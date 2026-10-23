import {readFile,mkdir,writeFile,access} from 'node:fs/promises';
const checks=[];
const add=(item,status,detail)=>checks.push({item,status,detail});
const required=['DATABASE_URL','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','OWNER_EMAIL'];
const missing=required.filter(name=>!process.env[name]);
for(const name of required)add(name,process.env[name]?'APROVADO':'PENDENTE DE CONFIGURAÇÃO',process.env[name]?'Valor presente; conteúdo não exibido.':'Configurar no provedor e no ambiente seguro de homologação.');
const schema=process.env.STORE_SCHEMA||'cv_casaverde';
const validSchema=/^cv_[a-z0-9_]{1,50}$/.test(schema);add('Isolamento por schema',validSchema?'APROVADO':'BLOQUEADO',validSchema?'Nome de schema compatível com a aplicação.':'STORE_SCHEMA inválido.');
add('Runtime Node',process.versions.node.startsWith('24.')?'APROVADO':'BLOQUEADO','Homologação desta entrega: Node 24.x.');
const pkg=JSON.parse(await readFile('package.json','utf8'));add('Runtime de implantação',pkg.engines.node==='24.x'?'APROVADO':'BLOQUEADO','package.json deve fixar a família homologada.');
const files=['server/service-pdf.mjs','public/brand/casa-verde.png','node_modules/pdfkit/js/data/Helvetica.afm','supabase/001_schema.sql','.vercelignore'];
for(const file of files){try{await access(file);add(file,'APROVADO','Arquivo de entrega presente.');}catch{add(file,'BLOQUEADO','Arquivo obrigatório ausente.');}}
if(process.env.DATABASE_SSL==='false')add('TLS do PostgreSQL','BLOQUEADO','Não desative TLS para a implantação hospedada.');
let validURLs=true;
if(process.env.SUPABASE_URL){try{const url=new URL(process.env.SUPABASE_URL);if(url.protocol!=='https:'||url.username||url.password)throw Error();add('HTTPS Supabase','APROVADO','URL HTTPS configurada.');}catch{validURLs=false;add('HTTPS Supabase','BLOQUEADO','SUPABASE_URL inválida ou sem HTTPS.');}}
if(process.env.DATABASE_URL){try{const url=new URL(process.env.DATABASE_URL);if(!['postgres:','postgresql:'].includes(url.protocol))throw Error();}catch{validURLs=false;add('Conexão PostgreSQL','BLOQUEADO','DATABASE_URL não é uma URL PostgreSQL válida.');}}
if(process.env.OWNER_EMAIL&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.OWNER_EMAIL))add('E-mail do proprietário','BLOQUEADO','OWNER_EMAIL inválido.');
if(!missing.length&&validSchema&&validURLs&&process.env.DATABASE_SSL!=='false'){
 let sql;
 try{
  const {default:postgres}=await import('postgres');sql=postgres(process.env.DATABASE_URL,{max:1,prepare:false,ssl:'require',connect_timeout:10,idle_timeout:1});
  const tables=await sql`SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=${schema} AND c.relname IN ('records','admins')`;
  add('Tabelas e RLS',tables.length===2&&tables.every(table=>table.relrowsecurity)?'APROVADO':'PENDENTE DE CONFIGURAÇÃO','Aplicar/verificar o SQL fornecido no schema da loja; RLS deve estar ativo nas duas tabelas.');
  if(tables.length===2){
   const grants=await sql`SELECT has_schema_privilege('anon',${schema},'USAGE') AS anon,has_schema_privilege('authenticated',${schema},'USAGE') AS authenticated`;
   add('Acesso direto ao schema',!grants[0].anon&&!grants[0].authenticated?'APROVADO':'BLOQUEADO','Os papéis de navegador não devem acessar o schema privado.');
  }
  const buckets=await sql`SELECT id,public FROM storage.buckets WHERE id IN ('cv-images','cv-invoices')`;
  add('Armazenamento persistente',buckets.length===2&&buckets.every(bucket=>!bucket.public)?'APROVADO':'PENDENTE DE CONFIGURAÇÃO','Buckets cv-images e cv-invoices devem existir e ser privados.');
  const owner=await sql`SELECT COUNT(*) AS n FROM auth.users WHERE lower(email)=${process.env.OWNER_EMAIL.toLowerCase()} AND email_confirmed_at IS NOT NULL`;
  add('Conta do proprietário',Number(owner[0].n)===1?'APROVADO':'PENDENTE DE CONFIGURAÇÃO','Conta Auth do proprietário deve existir e ter e-mail confirmado. Nenhuma senha é definida por este verificador.');
 }catch(error){add('Banco remoto','PENDENTE DE CONFIGURAÇÃO','Não foi possível concluir a leitura do banco. Verifique credencial, rede e permissões; nenhum dado foi gravado. Código: '+(typeof error.code==='string'&&/^[A-Z0-9_]{1,30}$/.test(error.code)?error.code:'não disponível'));}
 finally{await sql?.end({timeout:3});}
 try{const response=await fetch(process.env.SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:process.env.SUPABASE_ANON_KEY},signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const settings=await response.json();add('Cadastro público de administradores',settings.disable_signup?'APROVADO':'PENDENTE DE CONFIGURAÇÃO','Desabilitar cadastro público no Supabase Auth para esta loja administrativa.');}catch{add('Supabase Auth','PENDENTE DE CONFIGURAÇÃO','Verificar URL e chave pública do mesmo projeto.');}
}
const productionURL=process.env.PRODUCTION_URL;
if(productionURL){try{const url=new URL(productionURL);if(url.protocol!=='https:'||url.username||url.password)throw Error();const response=await fetch(new URL('/api/catalog?page=1',url),{signal:AbortSignal.timeout(15000)});const catalog=await response.json();if(!response.ok||!Array.isArray(catalog.products))throw Error();add('HTTPS e API pública hospedada','APROVADO','Endpoint de catálogo acessível por HTTPS. Login, upload, PDF e reimplantação ainda exigem homologação autenticada.');}catch{add('HTTPS e API pública hospedada','PENDENTE DE CONFIGURAÇÃO','Confirmar PRODUCTION_URL, domínio, certificado e disponibilidade da API.');}}else add('URL e domínio de produção','PENDENTE DE CONFIGURAÇÃO','Informar PRODUCTION_URL somente após existir uma implantação real.');
add('Teste hospedado completo','PENDENTE DE CONFIGURAÇÃO','Este verificador é de leitura; executar o roteiro autenticado de homologação e persistência antes da liberação pública.');
const report={at:new Date().toISOString(),scope:'Verificação de produção sem mutações, sem dados comerciais ou segredos no relatório',checks};
await mkdir('.tmp/homologacao',{recursive:true});await writeFile('.tmp/homologacao/verificacao-producao.json',JSON.stringify(report,null,2));
for(const check of checks)console.log(`${check.status} — ${check.item}: ${check.detail}`);
process.exitCode=checks.some(check=>check.status==='BLOQUEADO')?1:checks.some(check=>check.status==='PENDENTE DE CONFIGURAÇÃO')?2:0;
