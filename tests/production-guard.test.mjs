import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,access,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
test('ambiente Vercel sem PostgreSQL recusa fallback em SQLite temporário',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'cv-production-guard-'));const environment={...process.env,VERCEL:'1',DATA_DIR:path.join(directory,'dados')};delete environment.DATABASE_URL;
 const code=`const {init}=await import(${JSON.stringify(new URL('../server/runtime.mjs',import.meta.url).href)});try{await init();process.exitCode=1;}catch(error){if(error.message.includes('Configure DATABASE_URL'))console.log('RECUSADO_COM_SEGURANCA');else throw error;}`;
 try{const result=await promisify(execFile)(process.execPath,['--input-type=module','-e',code],{env:environment});assert.match(result.stdout,/RECUSADO_COM_SEGURANCA/);await assert.rejects(access(path.join(directory,'dados')));}finally{await rm(directory,{recursive:true,force:true});}
});
