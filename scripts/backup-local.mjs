import {mkdir,readdir,cp,readFile,writeFile,stat} from 'node:fs/promises';
import {DatabaseSync,backup} from 'node:sqlite';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export async function backupLocal({source=path.resolve(process.env.DATA_DIR||'.data'),destination}={}){
 if(process.env.DATABASE_URL)throw Error('Modo PostgreSQL: use o procedimento de backup do banco e Storage documentado no guia de produção.');
 source=path.resolve(source);destination=path.resolve(destination||path.join('.tmp','backups','casa-verde-'+new Date().toISOString().replace(/[:.]/g,'-')));
 if(destination===source||destination.startsWith(source+path.sep))throw Error('O destino do backup deve ficar fora da pasta de dados.');
 await stat(path.join(source,'casa-verde.sqlite'));
 await mkdir(destination,{recursive:false});
 const db=new DatabaseSync(path.join(source,'casa-verde.sqlite'),{readOnly:true});
 try{await backup(db,path.join(destination,'casa-verde.sqlite'));}finally{db.close();}
 for(const entry of await readdir(source)){if(!['casa-verde.sqlite','casa-verde.sqlite-wal','casa-verde.sqlite-shm'].includes(entry))await cp(path.join(source,entry),path.join(destination,entry),{recursive:true,errorOnExist:true,force:false});}
 const files=[];
 async function inventory(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())await inventory(file);else files.push({file:path.relative(destination,file).replaceAll('\\','/'),sha256:createHash('sha256').update(await readFile(file)).digest('hex')});}}
 await inventory(destination);const check=new DatabaseSync(path.join(destination,'casa-verde.sqlite'),{readOnly:true});
 let integrity;try{integrity=check.prepare('PRAGMA integrity_check').get().integrity_check;}finally{check.close();}
 if(integrity!=='ok')throw Error('Falha na integridade da cópia. Preserve o original e verifique o armazenamento.');
 await writeFile(path.join(destination,'manifesto.json'),JSON.stringify({createdAt:new Date().toISOString(),integrity,files,private:true,scope:'SQLite consistente, credencial local e arquivos enviados. Não publicar esta pasta.'},null,2),{mode:0o600,flag:'wx'});
 return {destination,integrity,files:files.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{await mkdir(path.resolve('.tmp/backups'),{recursive:true});console.log(JSON.stringify(await backupLocal({destination:process.argv[2]}),null,2));}
 catch(error){console.error('Backup não concluído:',error.message);process.exitCode=1;}
}
