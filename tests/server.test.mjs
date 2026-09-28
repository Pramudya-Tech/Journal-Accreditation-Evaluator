import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';

test('authentication, persistence, ownership, CSRF and concurrency',async t=>{
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
 const base=`http://127.0.0.1:${port}`,dir=mkdtempSync(join(tmpdir(),'journal-test-'));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',APP_ORIGIN:base,NODE_ENV:'development',ALLOW_REGISTRATION:'true',DATA_DIR:dir,OPENAI_API_KEY:''},stdio:['ignore','pipe','pipe']});
 try {
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Server start timeout')),10000);child.stdout.on('data',d=>{if(d.toString().includes('ready')){clearTimeout(timeout);resolve();}});child.on('exit',code=>{clearTimeout(timeout);reject(new Error('Server exited '+code));});});
  function client(){let cookie='',csrf='';return async(path,method='GET',data,overrides={})=>{const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,'X-Requested-With':'journal-evaluator',Cookie:cookie,'X-CSRF-Token':csrf,...overrides},...(data?{body:JSON.stringify(data)}:{})});const set=res.headers.get('set-cookie');if(set)cookie=set.split(';')[0];const value=await res.json().catch(()=>({}));if(value.csrf)csrf=value.csrf;return {status:res.status,data:value,headers:res.headers};};}
  const a=client(),b=client();
  await t.test('private endpoints require login',async()=>assert.equal((await a('/api/evaluations')).status,401));
  const password='A-test-password-9348';
  const first=await a('/api/register','POST',{name:'Editor One',email:'editor1@example.test',password});assert.equal(first.status,201);assert.match(first.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  await b('/api/register','POST',{name:'Editor Two',email:'editor2@example.test',password});
  await t.test('CSRF and cross-origin requests rejected',async()=>{
   assert.equal((await a('/api/evaluations','POST',{title:'Bad'}, {'X-CSRF-Token':'wrong'})).status,403);
   assert.equal((await a('/api/evaluations','POST',{title:'Bad'}, {Origin:'https://evil.example'})).status,403);
  });
  const created=await a('/api/evaluations','POST',{title:'Journal test',journal:{abstractLimit:250},answers:{'6b':{score:2,target:3,note:'320 words',evidence:'Public abstract'}}});assert.equal(created.status,201);const id=created.data.id;
  await t.test('records persist and are isolated by owner',async()=>{
   assert.equal((await a('/api/evaluations/'+id)).data.answers['6b'].note,'320 words');
   assert.equal((await b('/api/evaluations/'+id)).status,404);
   assert.equal((await b('/api/evaluations/'+id,'DELETE',{})).status,404);
   assert.equal((await b('/api/evaluations')).data.evaluations.length,0);
  });
  await t.test('tampered score and stale revision rejected',async()=>{
   assert.equal((await a('/api/evaluations/'+id,'PUT',{...created.data,answers:{'6b':{score:500,target:500}}})).status,400);
   const save=await a('/api/evaluations/'+id,'PUT',{...created.data,title:'Revised journal'});assert.equal(save.status,200);assert.equal(save.data.revision,2);
   assert.equal((await a('/api/evaluations/'+id,'PUT',created.data)).status,409);
  });
  await t.test('missing AI key returns an actionable error',async()=>{const r=await a('/api/evaluations/'+id+'/ai','POST',{criterionId:'6b',consent:true,revision:2});assert.equal(r.status,503);assert.match(r.data.error,/belum diaktifkan/);});
  await t.test('simultaneous writes cannot overwrite the same revision',async()=>{
   const current=(await a('/api/evaluations/'+id)).data;
   const writes=await Promise.all([a('/api/evaluations/'+id,'PUT',current),a('/api/evaluations/'+id,'PUT',current)]);
   assert.deepEqual(writes.map(x=>x.status).sort(),[200,409]);
  });
  await t.test('private files cannot be served and UI has CSP',async()=>{
   for(const path of ['/.env','/data/evaluator.sqlite','/src/db.mjs'])assert.equal((await fetch(base+path)).status,404);
   assert.match((await fetch(base)).headers.get('content-security-policy'),/script-src 'self'/);
  });
  await t.test('logout revokes session and login restores saved evaluations',async()=>{
   await a('/api/logout','POST',{});assert.equal((await a('/api/evaluations')).status,401);
   assert.equal((await a('/api/login','POST',{email:'editor1@example.test',password:'wrong-password-123'})).status,401);
   assert.equal((await a('/api/login','POST',{email:'editor1@example.test',password})).status,200);
   assert.equal((await a('/api/evaluations')).data.evaluations[0].title,'Revised journal');
  });
  await t.test('password change works and old password stops working',async()=>{
   const next='Replacement-password-945';assert.equal((await a('/api/password','POST',{currentPassword:password,password:next})).status,200);
   await a('/api/logout','POST',{});assert.equal((await a('/api/login','POST',{email:'editor1@example.test',password})).status,401);
   assert.equal((await a('/api/login','POST',{email:'editor1@example.test',password:next})).status,200);
  });
 } finally {child.kill('SIGTERM');await once(child,'exit');rmSync(dir,{recursive:true,force:true});}
});
