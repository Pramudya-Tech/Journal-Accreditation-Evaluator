import { criteriaOf, nextScore } from '../public/engine.js';
export function fail(message,status=400) { throw Object.assign(new Error(message),{status}); }
export function text(value, max, name, required=false) {
  if (typeof value !== 'string') { if (value === undefined && !required) return ''; fail(`${name} harus berupa teks.`); }
  const result=value.trim();
  if (result.length > max || (required && !result)) fail(`${name} tidak valid (maksimal ${max} karakter).`);
  return result;
}
export function credentials(body) {
  const email=text(body.email,254,'Email',true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Format email tidak valid.');
  if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) fail('Kata sandi harus 12–128 karakter.');
  return {email,password:body.password};
}
export function validateEvaluation(body,rubric) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Data evaluasi tidak valid.');
  const j=body.journal || {};
  const url=text(j.url,1000,'URL jurnal');
  if (url) { try { if (!['http:','https:'].includes(new URL(url).protocol)) fail('Gunakan URL http/https.'); } catch {fail('URL jurnal tidak valid.');} }
  const limit=Number(j.abstractLimit ?? 250);
  if (!Number.isInteger(limit) || limit < 50 || limit > 1000) fail('Batas abstrak harus 50–1000 kata.');
  const answers={};
  for (const c of criteriaOf(rubric)) {
    const a=body.answers?.[c.id]; if (!a) continue;
    if (a.score !== null && (typeof a.score !== 'number' || !c.options.some(o=>o.score===a.score))) fail(`Skor ${c.id} tidak ada dalam borang.`);
    const target=a.score===null ? null : (a.target ?? nextScore(c,a.score));
    if (target!==null && (!c.options.some(o=>o.score===target) || target<a.score)) fail(`Target ${c.id} tidak valid.`);
    const due=text(a.due,10,'Tanggal target');
    if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || !Number.isFinite(Date.parse(due)))) fail('Tanggal target tidak valid.');
    answers[c.id]={score:a.score,target,note:text(a.note,6000,'Catatan'),evidence:text(a.evidence,20000,'Bukti'),owner:text(a.owner,120,'Penanggung jawab'),due,status:['planned','progress','verified'].includes(a.status)?a.status:'planned'};
  }
  return { title:text(body.title,200,'Nama evaluasi',true),rubricVersion:rubric.version,
    journal:{url,focus:text(j.focus,500,'Fokus jurnal'),period:text(j.period,100,'Periode'),abstractLimit:limit},answers };
}
