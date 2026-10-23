import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true});
const base=process.env.STOREFRONT_URL||'http://localhost:5173';
await mkdir('.tmp/visual',{recursive:true});
try{
 const evidence=[];
 for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:740}]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.waitForFunction(()=>document.querySelector('#catalog-products')?.getAttribute('aria-busy')==='false');
  await page.screenshot({path:`.tmp/visual/marketplace-real-${viewport.width}.png`,fullPage:true});
  await page.screenshot({path:`.tmp/visual/marketplace-real-fold-${viewport.width}.png`});
  const metrics=await page.evaluate(()=>({heroHeight:document.querySelector('.commerce-banner').getBoundingClientRect().height,catalogTop:document.querySelector('#catalog-products').getBoundingClientRect().top,overflow:document.documentElement.scrollWidth>innerWidth,productCount:document.querySelectorAll('#catalog-products .product').length,brokenImages:[...document.images].filter(image=>!image.complete||!image.naturalWidth).map(image=>image.src)}));
  evidence.push({viewport,...metrics,errors});await page.close();
 }
 await writeFile('.tmp/visual/marketplace-metrics.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}finally{await browser.close();}
