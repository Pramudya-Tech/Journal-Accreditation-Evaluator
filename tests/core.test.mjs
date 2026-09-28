import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { criteriaOf, summarize, recommendation, nextScore } from '../public/engine.js';
import { validateEvaluation } from '../src/validation.mjs';
import { buildAIRequest, parseAIResponse, sourceHash } from '../src/ai.mjs';
const r=JSON.parse(readFileSync(new URL('../public/rubric.json',import.meta.url)));
const cs=criteriaOf(r);
test('rubric preserves all sections, options and weight totals',()=>{
 assert.equal(cs.length,32);assert.equal(r.sections.length,8);
 assert.deepEqual(r.sections.map(s=>s.max),[2,22,7,3,12,34,20,0]);
 assert.equal(cs.flatMap(c=>c.options).filter(o=>!o.appAdded).length,114);
 assert.equal(cs.flatMap(c=>c.options).filter(o=>o.appAdded).length,2);
 assert.equal(r.maximum,100);
 assert.deepEqual(cs.find(c=>c.id==='6b').options.map(o=>o.score),[3,2,0]);
 assert.deepEqual(cs.find(c=>c.id==='8a').options.map(o=>o.score),[-20,-15,-10,0]);
});
test('unknown assessments are not treated as zero or penalty-free',()=>{
 const s=summarize(r,{});assert.equal(s.assessed,0);assert.equal(s.complete,false);assert.equal(s.rank,'Lengkapi penilaian');
 const answers=Object.fromEntries(cs.filter(c=>c.sectionId!==8).map(c=>[c.id,{score:c.max,target:c.max}]));
 const incomplete=summarize(r,answers);assert.equal(incomplete.score,100);assert.equal(incomplete.complete,false);
});
test('full score, disincentives, decimal scoring and potential are correct',()=>{
 const answers=Object.fromEntries(cs.map(c=>[c.id,{score:c.max,target:c.max}]));
 assert.equal(summarize(r,answers).rank,'SINTA 1');
 answers['8a']={score:-20,target:0};answers['8b']={score:-3,target:0};
 assert.equal(summarize(r,answers).score,77);assert.equal(summarize(r,answers).potential,23);assert.equal(summarize(r,answers).rank,'SINTA 3');
 answers['2e']={score:.5,target:1};assert.equal(summarize(r,answers).score,76.5);
});
test('each rank boundary matches the workbook formula',()=>{
 const simple={sections:[{id:1,criteria:[{id:'test',options:[0,59.5,60,69.5,70,79.5,80,89.5,90,100].map(score=>({score}))}]}],rankBands:r.rankBands};
 for(const [n,rank] of [[59.5,'Tidak Terakreditasi (model borang)'],[60,'SINTA 4'],[69.5,'SINTA 4'],[70,'SINTA 3'],[79.5,'SINTA 3'],[80,'SINTA 2'],[89.5,'SINTA 2'],[90,'SINTA 1']])assert.equal(summarize(simple,{test:{score:n,target:n}}).rank,rank);
});
test('every upward transition has a concrete criterion plan',()=>{
 let count=0;
 for(const c of cs)for(const from of c.options)for(const to of c.options)if(to.score>from.score){
  const plan=recommendation(c,{score:from.score,target:to.score},{abstractLimit:250,focus:'Teknologi pendidikan'});
  assert.equal(plan.delta,to.score-from.score);assert.ok(plan.actions.length>=2);assert.ok(plan.evidence);assert.ok(plan.verify);
  assert.ok(!JSON.stringify(plan).includes('undefined'));assert.ok(!JSON.stringify(plan).includes('Buat daftar pemeriksaan dari setiap unsur pilihan target'));count++;
 }
 assert.equal(count,164);
});
test('abstract 2 to 3 has user-requested actions and medium priority',()=>{
 const c=cs.find(c=>c.id==='6b'),p=recommendation(c,{score:2,target:3},{abstractLimit:250});
 assert.equal(p.priority,'Sedang');assert.equal(p.delta,1);assert.match(p.actions.join(' '),/250 kata dalam Bahasa Inggris/);assert.match(p.actions.join(' '),/background, purpose, method, result, implication, dan conclusion/);
 assert.match(p.verify,/bukan syarat eksplisit borang/);
 assert.equal(nextScore(c,0),2);
 assert.equal(recommendation(c,{score:3,target:3}),null);
});
test('validation rejects invented scores and downward targets',()=>{
 const e={title:'Test',journal:{abstractLimit:250},answers:{'6b':{score:999,target:3}}};
 assert.throws(()=>validateEvaluation(e,r),/tidak ada/);
 e.answers['6b']={score:2,target:0};assert.throws(()=>validateEvaluation(e,r),/Target/);
 e.answers['6b']={score:2,target:3};assert.equal(validateEvaluation(e,r).answers['6b'].score,2);
});
test('AI request is grounded and response errors are handled',()=>{
 const c=cs.find(c=>c.id==='6b'),e={title:'Test',journal:{abstractLimit:250},answers:{'6b':{score:2,target:3,note:'320 kata',evidence:'Abstrak publik'}}};
 const p=recommendation(c,e.answers['6b'],e.journal),b=buildAIRequest(e,c,p,'gpt-4.1-mini');
 assert.equal(b.store,false);assert.equal(b.text.format.strict,true);assert.match(b.input[0].content,/320 kata/);assert.match(b.instructions,/TIDAK memiliki akses web/);
 const old=sourceHash(e,c);e.answers['6b'].note='Bukti baru';assert.notEqual(sourceHash(e,c),old);
 const result={summary:'Ada gap',actions:['Tindakan'],verification:['Verifikasi'],missingEvidence:[],limitations:'Hanya teks'};
 assert.deepEqual(parseAIResponse({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(result)}]}]}),result);
 assert.throws(()=>parseAIResponse({status:'incomplete'}),/belum lengkap/);
 assert.throws(()=>parseAIResponse({output:[{content:[{type:'refusal'}]}]}),/tidak dapat/);
 assert.throws(()=>parseAIResponse({output:[]}),/Format/);
});
