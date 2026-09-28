import http from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db,hash,passwordHash,verifyPassword,audit } from './src/db.mjs';
import { text,fail,credentials,validateEvaluation } from './src/validation.mjs';
import { criteriaOf,recommendation } from './public/engine.js';
import { generateAI,sourceHash } from './src/ai.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const rubric=JSON.parse(readFileSync(root+'public/rubric.json','utf8'));
const criteria=criteriaOf(rubric);
const prod=process.env.NODE_ENV==='production';
const port=Number(process.env.PORT || 3000);
const origin=new URL(process.env.APP_ORIGIN || `http://localhost:${port}`).origin;
if (prod && !origin.startsWith('https://')) throw new Error('Production requires an HTTPS APP_ORIGIN.');
const cookieName=prod?'__Host-je_session':'je_session';
const dailyLimit=Number(process.env.AI_DAILY_LIMIT || 20);
if (!Number.isInteger(dailyLimit) || dailyLimit<1 || dailyLimit>1000) throw new Error('AI_DAILY_LIMIT must be 1–1000');
const cookie=(token,age=604800)=>`${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${prod?'; Secure':''}`;
const dummy=await passwordHash(randomBytes(32).toString('hex'));
const rate=new Map();
function throttle(key,max,windowMs) {
  const now=Date.now();let bucket=rate.get(key);
  if (!bucket || now>=bucket.until) {bucket={count:0,until:now+windowMs};rate.set(key,bucket);}
  if (++bucket.count>max) fail('Terlalu banyak percobaan. Coba lagi setelah beberapa menit.',429);
}
setInterval(()=>{const now=Date.now();for(const [k,v] of rate)if(v.until<now)rate.delete(k);db.prepare('DELETE FROM sessions WHERE expires < ?').run(now);},60000).unref();
function session(req) {
  const token=(req.headers.cookie || '').split(';').map(s=>s.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.prepare('SELECT u.id,u.email,u.name,s.csrf,s.token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(hash(token),Date.now()) || null;
}
function publicUser(s) { return {id:s.id,email:s.email,name:s.name}; }
function createSession(res,id) {
  const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions(token,user_id,csrf,expires) VALUES(?,?,?,?)').run(hash(token),id,csrf,Date.now()+604800000);
  res.setHeader('Set-Cookie',cookie(token));return csrf;
}
function json(res,data,status=200) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
async function body(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) fail('Gunakan JSON.',415);
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>524288)fail('Data terlalu besar (maksimal 512 KB).',413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('JSON tidak valid.');}
}
function owned(id,userId) {const row=db.prepare('SELECT * FROM evaluations WHERE id=? AND user_id=?').get(id,userId);if(!row)fail('Evaluasi tidak ditemukan.',404);return row;}
function evaluation(row) {
  const e={...JSON.parse(row.payload),id:row.id,revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at,ai:{}};
  for (const a of db.prepare('SELECT * FROM ai_reports WHERE eval_id=?').all(row.id)) {
    const c=criteria.find(x=>x.id===a.criterion_id);
    if(c && sourceHash(e,c)===a.source_hash)e.ai[c.id]=JSON.parse(a.payload);
  }
  return e;
}
const assets=new Map([['/','index.html'],['/index.html','index.html'],['/app.js','app.js'],['/engine.js','engine.js'],['/styles.css','styles.css'],['/rubric.json','rubric.json']]);
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'");
  res.setHeader('Cache-Control','no-store');
  if(prod)res.setHeader('Strict-Transport-Security','max-age=31536000');
  try {
    const path=new URL(req.url,origin).pathname,method=req.method;
    if(path==='/health' && method==='GET')return json(res,{ok:true});
    if(!path.startsWith('/api/')) {
      if(!['GET','HEAD'].includes(method))fail('Metode tidak tersedia.',405);
      const asset=assets.get(path);if(!asset)fail('Halaman tidak ditemukan.',404);
      const mime=asset.endsWith('.css')?'text/css':asset.endsWith('.js')?'text/javascript':asset.endsWith('.json')?'application/json':'text/html';
      res.setHeader('Content-Type',mime+'; charset=utf-8');const file=readFileSync(root+'public/'+asset);res.end(method==='HEAD'?undefined:file);return;
    }
    const s=session(req);
    if(!['GET','HEAD'].includes(method)) {
      if(req.headers.origin!==origin || req.headers['x-requested-with']!=='journal-evaluator')fail('Asal permintaan tidak valid. Muat ulang aplikasi dari alamat yang dikonfigurasi.',403);
      if(s && req.headers['x-csrf-token']!==s.csrf)fail('Sesi formulir berubah. Muat ulang halaman.',403);
    }
    if(path==='/api/session' && method==='GET')return json(res,{user:s?publicUser(s):null,csrf:s?.csrf || null,registration:process.env.ALLOW_REGISTRATION==='true',aiEnabled:!!process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL || 'gpt-4.1-mini',aiDailyLimit:dailyLimit});
    if((path==='/api/login' || path==='/api/register') && method==='POST') {
      throttle('auth-ip:'+req.socket.remoteAddress,40,900000);
      const b=await body(req),{email,password}=credentials(b);throttle('auth-email:'+email,10,900000);
      if(path==='/api/register') {
        if(process.env.ALLOW_REGISTRATION!=='true')fail('Pendaftaran ditutup. Hubungi administrator.',403);
        const name=text(b.name,120,'Nama',true),id=randomUUID(),pw=await passwordHash(password);
        try{db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,email,name,pw,new Date().toISOString());}catch{fail('Akun tidak dapat dibuat dengan email ini.');}
        const csrf=createSession(res,id);return json(res,{user:{id,email,name},csrf},201);
      }
      const u=db.prepare('SELECT * FROM users WHERE email=?').get(email);
      const ok=await verifyPassword(password,u?.password || dummy);
      if(!u || !ok)fail('Email atau kata sandi tidak sesuai.',401);
      if(s)db.prepare('DELETE FROM sessions WHERE token=?').run(s.token);
      return json(res,{user:publicUser(u),csrf:createSession(res,u.id)});
    }
    if(!s)fail('Silakan masuk terlebih dahulu.',401);
    if(path==='/api/logout' && method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(s.token);res.setHeader('Set-Cookie',cookie('',0));return json(res,{ok:true});}
    if(path==='/api/password' && method==='POST') {
      throttle('pw:'+s.id,6,900000);const b=await body(req);
      const {password}=credentials({email:s.email,password:b.password});
      if(typeof b.currentPassword!=='string' || b.currentPassword.length>128)fail('Kata sandi saat ini tidak valid.');
      const u=db.prepare('SELECT password FROM users WHERE id=?').get(s.id);
      if(!await verifyPassword(b.currentPassword,u.password))fail('Kata sandi saat ini tidak sesuai.',400);
      db.prepare('UPDATE users SET password=? WHERE id=?').run(await passwordHash(password),s.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(s.id);
      return json(res,{ok:true,csrf:createSession(res,s.id)});
    }
    if(path==='/api/evaluations' && method==='GET')return json(res,{evaluations:db.prepare('SELECT id,title,revision,created_at,updated_at,payload FROM evaluations WHERE user_id=? ORDER BY updated_at DESC').all(s.id).map(r=>({id:r.id,title:r.title,revision:r.revision,updatedAt:r.updated_at,answers:JSON.parse(r.payload).answers}))});
    if(path==='/api/evaluations' && method==='POST') {
      const e=validateEvaluation(await body(req),rubric),id=randomUUID(),now=new Date().toISOString();
      db.prepare('INSERT INTO evaluations(id,user_id,title,payload,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id,s.id,e.title,JSON.stringify(e),now,now);audit(s.id,id,'created');return json(res,evaluation(owned(id,s.id)),201);
    }
    const match=path.match(/^\/api\/evaluations\/([a-f0-9-]{36})(?:\/(ai|audit))?$/);
    if(!match)fail('Endpoint tidak ditemukan.',404);
    const [,id,action]=match,row=owned(id,s.id);
    if(action==='audit' && method==='GET')return json(res,{events:db.prepare('SELECT action,created_at FROM audit WHERE user_id=? AND eval_id=? ORDER BY id DESC LIMIT 30').all(s.id,id)});
    if(!action && method==='GET')return json(res,evaluation(row));
    if(!action && method==='PUT') {
      const b=await body(req);if(b.revision!==row.revision)fail('Evaluasi berubah di tab lain. Ekspor pekerjaan ini, lalu muat ulang sebelum menyimpan.',409);
      const e=validateEvaluation(b,rubric);
      const changed=db.prepare('UPDATE evaluations SET title=?,payload=?,revision=revision+1,updated_at=? WHERE id=? AND user_id=? AND revision=?').run(e.title,JSON.stringify(e),new Date().toISOString(),id,s.id,b.revision);
      if(!changed.changes)fail('Evaluasi berubah di tab lain. Ekspor pekerjaan ini, lalu muat ulang sebelum menyimpan.',409);
      audit(s.id,id,'saved');return json(res,evaluation(owned(id,s.id)));
    }
    if(!action && method==='DELETE') {db.prepare('DELETE FROM evaluations WHERE id=? AND user_id=?').run(id,s.id);audit(s.id,id,'deleted');return json(res,{ok:true});}
    if(action==='ai' && method==='POST') {
      if(!process.env.OPENAI_API_KEY)fail('AI belum diaktifkan. Ikuti Panduan AI atau hubungi administrator.',503);
      const b=await body(req);if(b.consent!==true)fail('Konfirmasi pengiriman bukti ke penyedia AI diperlukan.');
      if(b.revision!==row.revision)fail('Simpan versi terbaru sebelum meminta AI.',409);
      const c=criteria.find(x=>x.id===b.criterionId);if(!c)fail('Kriteria tidak valid.');
      const e=JSON.parse(row.payload),plan=recommendation(c,e.answers[c.id],e.journal);if(!plan)fail('Pilih skor saat ini dan target yang lebih tinggi terlebih dahulu.');
      const day=new Date().toISOString().slice(0,10);throttle('ai:'+s.id,4,60000);
      db.prepare('INSERT INTO ai_usage(user_id,day,count) VALUES(?,?,0) ON CONFLICT DO NOTHING').run(s.id,day);
      const used=db.prepare('UPDATE ai_usage SET count=count+1 WHERE user_id=? AND day=? AND count<?').run(s.id,day,dailyLimit);if(!used.changes)fail('Batas harian permintaan AI telah tercapai.',429);
      const source=sourceHash(e,c),report=await generateAI(e,c,plan);
      const latest=owned(id,s.id);if(sourceHash(JSON.parse(latest.payload),c)!==source)fail('Data berubah saat AI memproses. Coba lagi pada versi terbaru.',409);
      db.prepare('INSERT INTO ai_reports VALUES(?,?,?,?) ON CONFLICT(eval_id,criterion_id) DO UPDATE SET source_hash=excluded.source_hash,payload=excluded.payload').run(id,c.id,source,JSON.stringify(report));audit(s.id,id,'ai:'+c.id);return json(res,report);
    }
    fail('Metode tidak tersedia.',405);
  } catch(err) { if(!res.headersSent)json(res,{error:err.status?err.message:'Terjadi kesalahan server. Hubungi administrator.'},err.status || 500);else res.end(); if(!err.status)console.error(err.code || err.name); }
});
server.requestTimeout=30000;server.headersTimeout=15000;
server.listen(port,process.env.HOST || '127.0.0.1',()=>console.log(`Journal Accreditation Evaluator ready at ${origin}`));
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit(0);}));
