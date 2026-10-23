import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=await mkdtemp(path.join(os.tmpdir(),'cv-visual-')),base='http://127.0.0.1:5197';
let server=spawn(process.execPath,['server/local.mjs'],{env:{...process.env,PORT:'5197',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
let browser;
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Servidor não iniciou')),15000);server.stdout.on('data',d=>{if(d.toString().includes('Casa Verde:')){clearTimeout(timer);resolve();}});server.once('exit',c=>{clearTimeout(timer);reject(Error('Servidor encerrou: '+c));});});
 const setup=await fetch(base+'/api/auth/setup',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({password:'Teste-visual-casa-verde-2026'})});assert.equal(setup.status,200);const cookie=setup.headers.get('set-cookie').split(';')[0];
 const form=new FormData();form.set('file',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=','base64')],'test.png',{type:'image/png'}));
 const upload=await fetch(base+'/api/upload',{method:'POST',headers:{Origin:base,Cookie:cookie},body:form});const image=(await upload.json()).url;
 const product={name:'Vaso de teste',description:'Descrição de teste',category:'Vasos',price:25,images:[image],published:true,stock:'disponivel',featured:true};
 const created=await fetch(base+'/api/products',{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(product)});assert.equal(created.status,200);
 for(const extra of [{name:'Planta de teste',category:'Plantas',price:35},{name:'Acessório de teste',category:'Acessórios',price:12},{name:'Vaso indisponível de teste',category:'Vasos',price:10,stock:'esgotado'}]){
  const response=await fetch(base+'/api/products',{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({...product,featured:false,...extra})});assert.equal(response.status,200);
 }
 browser=await chromium.launch({headless:true});await mkdir('.tmp/visual',{recursive:true});
 for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:740}]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('#catalog-products .product').first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('.commerce-banner').evaluate(el=>el.getBoundingClientRect().height<270),true);
  if(viewport.width>760)assert.equal(await page.locator('#catalog-products .product').first().evaluate(el=>el.getBoundingClientRect().top<850),true);
  await page.locator('#department-sections .department-section').first().waitFor();
  await page.screenshot({path:`.tmp/visual/marketplace-fixture-${viewport.width}.png`,fullPage:true});
  if(viewport.width<760){await page.locator('#menu-toggle').click();assert.equal(await page.locator('#main-nav').isVisible(),true);await page.locator('#main-nav a').first().click();}
  if(viewport.width<760)await page.locator('#filter-panel summary').click();
  await page.locator('#search').fill('inexistente');await page.locator('#catalog-products').getByText(/Nenhum.*encontrado/).waitFor();await page.locator('#clear-filters').click();await page.locator('#catalog-products .product').first().waitFor();
  await page.locator('#category-cards [data-category="Plantas"]').click();await page.waitForFunction(()=>document.querySelector('#catalog-products .product h3')?.textContent==='Planta de teste');assert.equal(await page.locator('#catalog-products .product').count(),1);await page.locator('#clear-filters').click();await page.waitForFunction(()=>document.querySelectorAll('#catalog-products .product').length===4);
  assert.equal(await page.locator('#catalog-products .product').filter({hasText:'Vaso indisponível de teste'}).locator('[data-add]').isDisabled(),true);
  await page.locator('#catalog-products [data-add]').first().click();await page.locator('#cart-request:not([disabled])').waitFor();assert.match(await page.locator('#cart-total').textContent(),/25,00/);await page.locator('[data-remove]').click();await page.waitForFunction(()=>document.querySelector('#cart-items').textContent.includes('vazio'));await page.locator('#cart [data-close]').first().click();
  await page.locator('#catalog-products .product-image').first().click();await page.locator('#detail-qty').fill('2');await page.locator('#add').click();await page.locator('#cart-request:not([disabled])').waitFor();assert.match(await page.locator('#cart-total').textContent(),/50,00/);
  await page.locator('[data-qty]').fill('3');await page.locator('[data-qty]').dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('#cart-total').textContent.includes('75,00'));
  await page.locator('#cart-request').click();await page.locator('[name=name]').fill('Cliente teste');await page.locator('[name=phone]').fill('63999999999');await page.locator('#contact-form [name=location]').fill('Centro');await page.locator('#contact-form [type=submit]').click();await page.waitForFunction(()=>document.querySelector('#form-status').textContent.includes('Solicitação registrada'));
  assert.match(await page.locator('#form-status').textContent(),/Nenhum pagamento/);
  await page.locator('#cart-open').click();assert.match(await page.locator('#cart-items').textContent(),/vazio/);await page.locator('#cart [data-close]').first().click();
  await page.locator('#catalog-products .product-image').first().click();await page.locator('#add').click();await page.locator('[data-remove]').waitFor();await page.locator('[data-remove]').click();await page.waitForFunction(()=>document.querySelector('#cart-items').textContent.includes('vazio'));await page.locator('#cart [data-close]').first().click();
  if(viewport.width===1440){
   await page.locator('#catalog-products img').first().evaluate(image=>image.src='/missing-test-photo.png');await page.waitForFunction(()=>{const image=document.querySelector('#catalog-products img');return image?.src.startsWith('data:image/svg+xml')&&image.complete&&image.naturalWidth>0;});
   await page.route('**/api/catalog?**',route=>route.abort());await page.locator('#search').fill('falha de conexão');await page.waitForFunction(()=>document.querySelector('#load-error').textContent.includes('Confira sua conexão'));await page.unroute('**/api/catalog?**');await page.locator('#clear-filters').click();await page.waitForFunction(()=>document.querySelectorAll('#catalog-products .product').length===4);
  }
  await page.screenshot({path:`.tmp/visual/marketplace-result-${viewport.width}.png`,fullPage:true});assert.deepEqual(errors,[]);await page.close();console.log('Fluxo desktop/móvel aprovado:',viewport.width);
 }
 const catalogBefore=await(await fetch(base+'/api/catalog')).json(),imageBefore=Buffer.from(await(await fetch(base+image)).arrayBuffer());
 const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill();await stopped;
 server=spawn(process.execPath,['server/local.mjs'],{env:{...process.env,PORT:'5197',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Reinício não concluído')),15000);server.stdout.on('data',chunk=>{if(chunk.toString().includes('Casa Verde:')){clearTimeout(timeout);resolve();}});server.once('exit',code=>{clearTimeout(timeout);reject(Error('Servidor encerrou no reinício: '+code));});});
 assert.deepEqual((await(await fetch(base+'/api/catalog')).json()).products,catalogBefore.products);assert.deepEqual(Buffer.from(await(await fetch(base+image)).arrayBuffer()),imageBefore);
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({password:'Teste-visual-casa-verde-2026'})});assert.equal(login.status,200);console.log('Persistência local após reiniciar/reconstruir: produtos, imagens e senha aprovados.');
}finally{await browser?.close();server.kill();await new Promise(r=>server.once('exit',r));await rm(dir,{recursive:true,force:true});}
