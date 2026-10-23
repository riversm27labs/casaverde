import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.STOREFRONT_URL||'http://localhost:5173';
const initial=await (await fetch(base+'/api/catalog')).json();
const browser=await chromium.launch({headless:true});await mkdir('.tmp/visual',{recursive:true});
try{for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(base);await page.waitForFunction(()=>document.querySelectorAll('.demo-product').length===8);
 assert.equal(await page.locator('.demo-product [data-add]').count(),0);assert.equal(await page.locator('.demo-product .product-price').count(),0);
 await page.locator('.demo-product [data-demo-view]').first().click();assert.equal(await page.locator('#detail #add').count(),0);assert.match(await page.locator('#detail-body').textContent(),/NÃO DISPONÍVEL PARA COMPRA/);await page.locator('#detail [data-close]').click();
 await page.locator('.demo-product').last().scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('.demo-product img')].every(image=>image.complete&&image.naturalWidth>0));await page.evaluate(()=>scrollTo(0,0));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`.tmp/visual/etapa1-demo-${viewport.width}.png`,fullPage:true});
 await page.locator('#demo-visible').uncheck();await page.reload();await page.waitForFunction(()=>document.querySelector('#catalog-products').getAttribute('aria-busy')==='false');assert.equal(await page.locator('#demo-visible').isChecked(),false);assert.equal(await page.locator('.demo-product').count(),0);
 await page.locator('#demo-visible').check();await page.waitForFunction(()=>document.querySelectorAll('.demo-product').length===8);
 const liveTable=await(await fetch(base+'/api/service-catalog')).json();if(!liveTable.published){await page.locator('#sq-public-form [name=area]').fill('40');await page.locator('#sq-public-form [name=location]').fill('Localização a definir na avaliação');await page.waitForFunction(()=>document.querySelector('#sq-preview').textContent.includes('Tabela comercial ainda não publicada'));assert.equal(await page.locator('#sq-preview .sq-lines').count(),0);await page.locator('#orcamento-servicos').screenshot({path:`.tmp/visual/etapa2-real-sem-tabela-${viewport.width}.png`});}
 assert.deepEqual(errors,[]);await page.close();console.log('Demonstração, imagens, persistência e ausência de preço inventado aprovadas:',viewport.width);
}}finally{await browser.close();}
const final=await(await fetch(base+'/api/catalog')).json();assert.deepEqual(final.products,initial.products);console.log('Produtos reais preservados.');
