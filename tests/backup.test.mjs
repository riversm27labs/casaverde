import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,cp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {DatabaseSync} from 'node:sqlite';import {createHash} from 'node:crypto';import {backupLocal} from '../scripts/backup-local.mjs';
test('backup SQLite com WAL inclui conta e imagens e restaura em diretório isolado',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'cv-backup-')),source=path.join(directory,'dados'),destination=path.join(directory,'backup'),restored=path.join(directory,'restaurado');await mkdir(path.join(source,'files'),{recursive:true});
 const db=new DatabaseSync(path.join(source,'casa-verde.sqlite'));
 try{db.exec("PRAGMA journal_mode=WAL; CREATE TABLE records(id TEXT PRIMARY KEY,kind TEXT,data TEXT,created INTEGER); INSERT INTO records VALUES('homologacao','products','{\"price\":29.9}',1)");await writeFile(path.join(source,'account.json'),'credencial-identificada-de-teste');await writeFile(path.join(source,'files','teste.png'),Buffer.from([137,80,78,71]));
 const result=await backupLocal({source,destination});assert.equal(result.integrity,'ok');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM records').get().n,1);
 const manifest=JSON.parse(await readFile(path.join(destination,'manifesto.json'),'utf8'));for(const file of manifest.files)assert.equal(createHash('sha256').update(await readFile(path.join(destination,file.file))).digest('hex'),file.sha256);
 await cp(destination,restored,{recursive:true});const check=new DatabaseSync(path.join(restored,'casa-verde.sqlite'),{readOnly:true});try{assert.equal(JSON.parse(check.prepare('SELECT data FROM records').get().data).price,29.9);}finally{check.close();}
 assert.equal(await readFile(path.join(restored,'account.json'),'utf8'),'credencial-identificada-de-teste');assert.deepEqual(await readFile(path.join(restored,'files','teste.png')),Buffer.from([137,80,78,71]));await assert.rejects(backupLocal({source,destination}),/EEXIST/);
 }finally{db.close();await rm(directory,{recursive:true,force:true});}
});
