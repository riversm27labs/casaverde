import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('oito modelos separados, sem preços, com imagens locais e origem documentada',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../public/demo/catalog.json',import.meta.url),'utf8'));
 assert.equal(catalog.items.length,8);assert.equal(catalog.items.filter(item=>item.category==='Vasos decorativos').length,4);assert.equal(catalog.items.filter(item=>item.category==='Plantas ornamentais').length,4);
 assert.match(catalog.notice,/DEMONSTRAÇÃO.*NÃO DISPONÍVEL PARA COMPRA/);assert.equal(new Set(catalog.items.map(item=>item.id)).size,8);
 for(const item of catalog.items){assert.match(item.id,/^demo-/);assert.equal(item.price,undefined);assert.equal(item.stock,undefined);assert.match(item.image,/^\/demo\/[a-z0-9-]+\.png$/);const bytes=await readFile(new URL('../public'+item.image,import.meta.url));assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.ok(bytes.readUInt32BE(16)>=512);assert.ok(bytes.readUInt32BE(20)>=512);assert.ok(item.description.length>40);}
 const provenance=JSON.parse(await readFile(new URL('../public/demo/provenance.json',import.meta.url),'utf8'));assert.equal(provenance.assets.length,8);assert.ok(provenance.assets.every(item=>item.prompt&&item.tool==='image_gen built-in'));
});
