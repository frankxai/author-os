#!/usr/bin/env node
// Local-only publication coordination. No models, remote calls or publication side effects.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROLES = new Set(['research', 'structure', 'draft', 'edit', 'design', 'verify', 'produce']);
const STATES = new Set(['queued', 'running', 'done', 'failed']);
const ORIGINS = new Set(['human', 'ai', 'human_ai']);
const HASH = /^[a-f0-9]{64}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const validId = value => typeof value==='string' && ID.test(value);
const resources = task => task.resources ?? [`book:${task.book_id}`];
const attemptLimit = task => task.max_attempts ?? 3;
const fail = message => { throw new Error(message); };
const ensure = (test, message) => { if (!test) fail(message); };
const text = (value, name) => ensure(typeof value === 'string' && value.trim().length > 0, `${name} must be nonempty text`);
const number = (value, name) => ensure(Number.isFinite(value) && value >= 0, `${name} must be a finite nonnegative number`);
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = value => JSON.parse(JSON.stringify(value));

function contained(root, relative, mustExist = true) {
  text(relative, 'relative source path');
  ensure(!path.isAbsolute(relative), 'absolute source paths are not permitted');
  const full = path.resolve(root, relative);
  const rel = path.relative(root, full);
  ensure(rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`), 'source path must remain inside manifest directory');
  if (mustExist) {
    const realRoot = fs.realpathSync(root);
    const real = fs.realpathSync(full);
    const realRel = path.relative(realRoot, real);
    ensure(realRel !== '' && realRel !== '..' && !realRel.startsWith(`..${path.sep}`), 'symlink escapes manifest directory');
    ensure(fs.statSync(real).isFile(), 'source must be a file');
  }
  return full;
}

export function validateProgram(program) {
  ensure(program && typeof program === 'object' && !Array.isArray(program), 'program must be an object');
  ensure(program.schema_version === 1, 'schema_version must be 1');
  ensure(validId(program.id), 'invalid program id');
  text(program.title, 'program title');
  ensure(program.budget && typeof program.budget === 'object', 'budget is required');
  for (const field of ['usd_cap', 'tokens_cap', 'verification_reserve']) number(program.budget[field], `budget.${field}`);
  ensure(program.budget.verification_reserve >= .25 && program.budget.verification_reserve <= 1, 'verification_reserve must be between 0.25 and 1');
  ensure(Number.isSafeInteger(program.budget.tokens_cap), 'tokens_cap must be an integer');
  ensure(Array.isArray(program.books) && program.books.length > 0, 'books must be nonempty');
  ensure(Array.isArray(program.tasks), 'tasks must be an array');
  const ids = new Set();
  for (const book of program.books) {
    ensure(validId(book.id) && !ids.has(book.id), 'book ids must be unique'); ids.add(book.id);
    for (const field of ['title', 'author', 'language']) text(book[field], `book.${field}`);
    ensure(Array.isArray(book.chapters) && book.chapters.length > 0, 'chapters must be nonempty');
    const chapterIds = new Set();
    for (const chapter of book.chapters) {
      ensure(validId(chapter.id) && !chapterIds.has(chapter.id), 'chapter ids must be unique'); chapterIds.add(chapter.id);
      text(chapter.title, 'chapter title'); text(chapter.path, 'chapter path');
      ensure(ORIGINS.has(chapter.origin), 'chapter origin must be human, ai or human_ai');
      ensure(HASH.test(chapter.sha256), 'chapter sha256 is required');
      ensure(Array.isArray(chapter.sources) && Array.isArray(chapter.claims), 'chapter sources and claims must be arrays');
      const sourceIds = new Set();
      for (const source of chapter.sources) {
        text(source.id, 'source id'); ensure(!sourceIds.has(source.id), 'duplicate source id'); sourceIds.add(source.id);
        ensure(['public', 'private'].includes(source.visibility), 'source visibility required');
        text(source.rights, 'source rights');
        if (source.visibility === 'public') {
          const url = new URL(source.url); ensure(url.protocol === 'https:' && !url.username && !url.password, 'public source must use HTTPS without credentials');
          ensure(!url.search && !url.hash, 'source URL must not contain query tokens or fragments');
        }
      }
      for (const claim of chapter.claims) {
        text(claim.id, 'claim id');
        ensure(['verified', 'interpretation', 'fiction', 'unresolved'].includes(claim.status), 'claim status is invalid');
        ensure(Array.isArray(claim.source_ids) && claim.source_ids.every(id => sourceIds.has(id)), 'claim has unknown source');
        if (claim.status === 'verified') ensure(claim.source_ids.length > 0, 'verified claim requires a source');
      }
    }
  }
  const taskIds = new Set();
  for (const task of program.tasks) {
    ensure(validId(task.id) && !taskIds.has(task.id), 'task ids must be unique'); taskIds.add(task.id);
    ensure(ids.has(task.book_id), 'task references unknown book');
    ensure(ROLES.has(task.role), 'task role is invalid');
    ensure(STATES.has(task.state), 'task state is invalid');
    ensure(Number.isInteger(attemptLimit(task))&&attemptLimit(task)>=1&&attemptLimit(task)<=3,'max_attempts must be 1–3');
    ensure(Number.isInteger(task.attempts??0)&&(task.attempts??0)>=0&&(task.attempts??0)<=attemptLimit(task),'invalid attempt count');
    ensure(Array.isArray(task.depends_on), 'depends_on must be an array');
    ensure(Array.isArray(resources(task)) && resources(task).length>0 && resources(task).every(r=>typeof r==='string'&&/^[a-z0-9][a-z0-9:._/-]{0,159}$/.test(r)), 'task resources must name at least one bounded resource');
    for (const field of ['estimate_tokens', 'estimate_usd']) number(task[field], `task.${field}`);
    ensure(Number.isSafeInteger(task.estimate_tokens), 'estimate_tokens must be an integer');
    if (task.state === 'running') {
      ensure(task.attempts>=1&&HASH.test(task.input_scope_sha256??''),'running task requires attempt and bound input scope');
      text(task.worker, 'running worker'); text(task.lease_token, 'lease token');
      ensure(Number.isFinite(Date.parse(task.lease_until)), 'running task requires valid lease_until');
    }
    if (task.state === 'done') {
      text(task.artifact, 'completed artifact');
      ensure(task.receipt && typeof task.receipt === 'object', 'completed task requires receipt');
    }
    if (task.receipt) {
      number(task.receipt.tokens, 'receipt tokens'); number(task.receipt.usd, 'receipt usd');
      ensure(Number.isSafeInteger(task.receipt.tokens), 'receipt tokens must be integer');
    }
  }
  const visited = new Set(), visiting = new Set(), tasks = new Map(program.tasks.map(t => [t.id,t]));
  function visit(id) {
    ensure(tasks.has(id), `unknown dependency ${id}`);
    ensure(!visiting.has(id), 'task dependency cycle');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of tasks.get(id).depends_on) visit(dep);
    visiting.delete(id); visited.add(id);
  }
  for (const id of taskIds) visit(id);
  const used = usage(program);
  const reserved=program.tasks.filter(t=>t.state==='running').reduce((sum,t)=>({tokens:sum.tokens+t.estimate_tokens,usd:sum.usd+t.estimate_usd,production_tokens:sum.production_tokens+(t.role==='verify'?0:t.estimate_tokens)}),{tokens:0,usd:0,production_tokens:0});
  ensure(used.tokens+reserved.tokens <= program.budget.tokens_cap && used.usd+reserved.usd <= program.budget.usd_cap + 1e-8, 'recorded usage/reservations exceed program budget');
  ensure(used.production_tokens+reserved.production_tokens <= Math.floor(program.budget.tokens_cap*(1-program.budget.verification_reserve)), 'recorded production usage/reservations consume verification reserve');
  return program;
}

export function usage(program) {
  return program.tasks.reduce((sum,t) => ({tokens:sum.tokens+(t.receipt?.tokens??0), usd:sum.usd+(t.receipt?.usd??0), production_tokens:sum.production_tokens+(t.role==='verify'?0:(t.receipt?.tokens??0))}), {tokens:0,usd:0,production_tokens:0});
}

export function approvalScope(book,chapter) {
  return sha256(JSON.stringify({book:{id:book.id,title:book.title,author:book.author,language:book.language},chapter:{id:chapter.id,title:chapter.title,origin:chapter.origin,sha256:chapter.sha256,sources:chapter.sources,claims:chapter.claims}}));
}

export function taskScope(program,task) {
  return sha256(JSON.stringify({book:program.books.find(b=>b.id===task.book_id),task:{id:task.id,book_id:task.book_id,role:task.role,depends_on:task.depends_on,resources:resources(task),estimate_tokens:task.estimate_tokens,estimate_usd:task.estimate_usd,max_attempts:attemptLimit(task)},dependencies:task.depends_on.map(id=>{const dep=program.tasks.find(t=>t.id===id);return {id:dep.id,artifact:dep.artifact??null,receipt:dep.receipt??null,state:dep.state};})}));
}

function fits(program, task, additional = {tokens:task.estimate_tokens,usd:task.estimate_usd}) {
  const used = usage(program);
  const reserved = program.tasks.filter(t => t.state==='running' && t.id!==task.id).reduce((s,t) => ({tokens:s.tokens+t.estimate_tokens,usd:s.usd+t.estimate_usd,production_tokens:s.production_tokens+(t.role==='verify'?0:t.estimate_tokens)}),{tokens:0,usd:0,production_tokens:0});
  const productionLimit = Math.floor(program.budget.tokens_cap*(1-program.budget.verification_reserve));
  return used.tokens+reserved.tokens+additional.tokens <= program.budget.tokens_cap && used.usd+reserved.usd+additional.usd <= program.budget.usd_cap+1e-8 && used.production_tokens+reserved.production_tokens+(task.role==='verify'?0:additional.tokens) <= productionLimit;
}

export function readyTasks(program) {
  validateProgram(program);
  const current=new Map();
  function dependencyCurrent(id) {
    if(current.has(id))return current.get(id);
    const dependency=program.tasks.find(d=>d.id===id);
    const valid=dependency.state==='done'&&dependency.input_scope_sha256===taskScope(program,dependency)&&dependency.depends_on.every(dependencyCurrent);
    current.set(id,valid);return valid;
  }
  return program.tasks.filter(t => t.state==='queued' && (t.attempts??0)<attemptLimit(t) && t.depends_on.every(dependencyCurrent) && !program.tasks.some(active=>active.state==='running'&&resources(active).some(r=>resources(t).includes(r))) && fits(program,t)).map(t=>({id:t.id,book_id:t.book_id,role:t.role,resources:resources(t),estimate_tokens:t.estimate_tokens,estimate_usd:t.estimate_usd}));
}

export function transition(input, action, now = new Date()) {
  validateProgram(input); const program=clone(input); const iso=now.toISOString();
  if (action.type==='recover') {
    for (const task of program.tasks) if(task.state==='running' && Date.parse(task.lease_until)<=now.getTime()) {
      task.state=task.attempts>=attemptLimit(task)?'failed':'queued'; task.last_failure='lease expired; external usage must be reconciled before retry';
      // A timeout does not prove the provider spent nothing. Keep its reservation as a receipt.
      task.receipt={tokens:(task.receipt?.tokens??0)+task.estimate_tokens,usd:(task.receipt?.usd??0)+task.estimate_usd,kind:'expired_lease_reservation'};
      task.past_lease_tokens=[...(task.past_lease_tokens??[]),task.lease_token];
      delete task.worker; delete task.lease_until; delete task.lease_token;
    }
    validateProgram(program); return program;
  }
  const task=program.tasks.find(t=>t.id===action.task_id); ensure(task, 'unknown task');
  if(action.type==='claim') {
    text(action.worker, 'worker'); ensure(Number.isSafeInteger(action.lease_seconds)&&action.lease_seconds>=30&&action.lease_seconds<=3600,'lease must be 30–3600 seconds');
    if(task.state==='running' && task.worker===action.worker && task.lease_token===action.lease_token) return program;
    ensure(readyTasks(program).some(t=>t.id===task.id),'task not ready or exceeds budget');
    ensure(!action.lease_token||!(task.past_lease_tokens??[]).includes(action.lease_token),'lease token cannot be reused after an attempt');
    task.input_scope_sha256=taskScope(program,task);task.attempts=(task.attempts??0)+1;
    task.state='running'; task.worker=action.worker; task.lease_token=action.lease_token??crypto.randomUUID();
    task.lease_until=new Date(now.getTime()+action.lease_seconds*1000).toISOString(); task.started_at=iso;
  } else if(action.type==='complete'||action.type==='fail') {
    text(action.worker,'worker'); text(action.lease_token,'lease_token');
    number(action.tokens,'actual tokens'); number(action.usd,'actual usd'); ensure(Number.isSafeInteger(action.tokens),'actual tokens must be integer');
    if(task.state==='done' && action.type==='complete' && task.completed_lease_token===action.lease_token) {
      ensure(task.worker===action.worker && task.last_report.tokens===action.tokens && task.last_report.usd===action.usd && task.artifact===action.artifact,'completion retry differs from saved receipt'); return program;
    }
    ensure(task.state==='running' && task.worker===action.worker && task.lease_token===action.lease_token,'worker/lease does not own task');
    ensure(Date.parse(task.lease_until)>now.getTime(),'lease expired');
    ensure(task.input_scope_sha256===taskScope(program,task),'task inputs changed after claim; return through recovery and re-review');
    ensure(action.tokens<=task.estimate_tokens && action.usd<=task.estimate_usd+1e-8,'actual usage exceeds task reservation; reconcile explicitly instead of silently expanding budget');
    ensure(fits(program,task,{tokens:action.tokens,usd:action.usd}),'actual usage exceeds budget');
    if(action.type==='complete') text(action.artifact,'artifact');
    const previous=task.receipt??{tokens:0,usd:0};
    task.receipt={tokens:previous.tokens+action.tokens,usd:previous.usd+action.usd,kind:previous.kind==='expired_lease_reservation'?'mixed_report_and_unreconciled_reservation':'worker_reported'};
    task.last_report={tokens:action.tokens,usd:action.usd};
    task.state=action.type==='complete'?'done':'failed'; task.completed_at=iso;
    task.artifact=action.type==='complete'?action.artifact:null; task.completed_lease_token=task.lease_token;
    task.past_lease_tokens=[...(task.past_lease_tokens??[]),task.lease_token];
    delete task.lease_token; delete task.lease_until;
  } else fail('unknown action');
  validateProgram(program); return program;
}

// Deliberately small text subset; raw HTML, Markdown links and images render as text.
function renderText(source) {
  const blocks=source.replace(/\r\n/g,'\n').split(/\n\s*\n/);
  return blocks.filter(b=>b.trim()).map(block=>{
    const heading=block.match(/^(#{1,6})\s+([^\n]+)$/);
    if(heading) {const level=Math.min(heading[1].length+1,6);return `<h${level}>${escape(heading[2])}</h${level}>`;}
    return `<p>${escape(block).replace(/\n/g,'<br>')}</p>`;
  }).join('\n');
}

export function compileBook(program, bookId, root, {publicExport=false, selectedIds}={}) {
  validateProgram(program);const book=program.books.find(b=>b.id===bookId);ensure(book,'unknown book');
  ensure(Array.isArray(selectedIds)&&selectedIds.length>0,'explicit chapter selection is required');
  ensure(new Set(selectedIds).size===selectedIds.length,'duplicate chapter selection');
  const selected=selectedIds.map(id=>{const chapter=book.chapters.find(c=>c.id===id);ensure(chapter,'unknown selected chapter');return chapter;});
  const sources=new Map();
  const chapters=selected.map(chapter=>{
    const bytes=fs.readFileSync(contained(root,chapter.path));const hash=sha256(bytes);
    ensure(hash===chapter.sha256,`source changed: ${chapter.id}`);
    if(publicExport) {
      const gate=chapter.public_export;
      ensure(gate?.approved===true && gate.approved_sha256===hash && gate.rights==='cleared' && gate.approved_scope_sha256===approvalScope(book,chapter),`public selection lacks exact review/rights: ${chapter.id}`);
      ensure(gate.attestation_type==='operator_record' && typeof gate.reviewed_by==='string' && gate.reviewed_by.trim() && Number.isFinite(Date.parse(gate.reviewed_at)), 'public selection requires an existing operator review record');
      ensure(chapter.claims.every(c=>c.status!=='unresolved'),'unresolved claim blocks public export');
      ensure(chapter.sources.every(s=>s.visibility==='public' && s.rights==='cleared'),'private or uncleared source blocks public export');
    }
    for(const source of chapter.sources) if(source.visibility==='public') {
      const record={id:source.id,url:source.url,rights:source.rights};
      ensure(!sources.has(source.id)||JSON.stringify(sources.get(source.id))===JSON.stringify(record),'conflicting shared source id'); sources.set(source.id,record);
    }
    return {id:chapter.id,title:chapter.title,origin:chapter.origin,sha256:hash,claims:chapter.claims.map(c=>({id:c.id,status:c.status,source_ids:c.source_ids})),body:renderText(bytes.toString('utf8'))};
  });
  const descriptor={schema_version:1,book:{id:book.id,title:book.title,author:book.author,language:book.language},scope:publicExport?'approved_public_selection':'private_editorial_proof',chapters:chapters.map(({body,...c})=>c),sources:[...sources.values()],review:'Local metadata attestation only; this does not verify identity, literary quality or external publication.'};
  const editionId=sha256(JSON.stringify(descriptor));
  const html=`<!doctype html>\n<html lang="${escape(book.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escape(book.title)}</title><style>body{font:1.15rem/1.75 Georgia,serif;max-width:42rem;margin:auto;padding:2rem;color:#17231f;background:#fffdf8}a{color:#185848}h1,h2,h3{line-height:1.2}nav li{margin:.5rem 0}section{margin:4rem 0}p{overflow-wrap:anywhere}a:focus-visible{outline:3px solid #185848;outline-offset:4px}@media print{nav{display:none}section{break-before:page}body{padding:0;color:#000;background:#fff}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}</style></head><body><a href="#reading">Skip to reading</a><header><p>${publicExport?'Selected reading edition':'Private editorial proof'}</p><h1>${escape(book.title)}</h1><p>${escape(book.author)}</p></header><nav aria-label="Chapters"><ol>${chapters.map(c=>`<li><a href="#${c.id}">${escape(c.title)}</a></li>`).join('')}</ol></nav><main id="reading">${chapters.map(c=>`<section aria-labelledby="heading-${c.id}" id="${c.id}"><h2 id="heading-${c.id}">${escape(c.title)}</h2>${c.body}</section>`).join('\n')}</main><footer><p>Edition ${editionId.slice(0,12)}. AI assistance is recorded by chapter origin in the companion manifest. This file is an editorial artifact; generation does not publish it.</p></footer></body></html>\n`;
  return {editionId,html,manifest:{...descriptor,edition_id:editionId,html_sha256:sha256(html)}};
}

function saveEdition(result,out) {
  const target=path.resolve(out,result.editionId); fs.mkdirSync(target,{recursive:true});
  for(const [name,body] of [['reading.html',result.html],['edition.json',JSON.stringify(result.manifest,null,2)+'\n']]) {
    const file=path.join(target,name);
    if(fs.existsSync(file)) ensure(fs.readFileSync(file,'utf8')===body,'refusing to overwrite a different edition artifact');
    else fs.writeFileSync(file,body,{flag:'wx'});
  }
  return target;
}

export function main(args=process.argv.slice(2)) {
  const [command,file,...rest]=args;
  ensure(['validate','ready','claim','complete','fail','recover','compile'].includes(command),'Usage: author-os program validate|ready|claim|complete|fail|recover|compile <program.json> [...]');
  text(file,'program filename'); const absolute=path.resolve(file),root=path.dirname(absolute);
  const read=()=>validateProgram(JSON.parse(fs.readFileSync(absolute,'utf8')));
  if(command==='validate') return {valid:!!read()};
  if(command==='ready') return {ready:readyTasks(read()),usage:usage(read())};
  if(command==='compile') {
    const [bookId,out,selection,...flags]=rest;text(out,'output directory');text(selection,'comma-separated chapter ids');
    const result=compileBook(read(),bookId,root,{selectedIds:selection.split(','),publicExport:flags.includes('--public')});
    return {edition_id:result.editionId,directory:saveEdition(result,out),state:'LOCAL_PROOF_NOT_PUBLISHED'};
  }
  const lock=absolute+'.lock'; let handle;
  try {
    handle=fs.openSync(lock,'wx');
    let action;
    if(command==='recover') action={type:'recover'};
    else if(command==='claim') action={type:'claim',task_id:rest[0],worker:rest[1],lease_seconds:Number(rest[2]),lease_token:rest[3]};
    else action={type:command,task_id:rest[0],worker:rest[1],lease_token:rest[2],tokens:Number(rest[3]),usd:Number(rest[4]),artifact:rest[5]};
    const updated=transition(read(),action);const temporary=absolute+'.tmp-'+crypto.randomUUID();
    try {fs.writeFileSync(temporary,JSON.stringify(updated,null,2)+'\n',{flag:'wx'});fs.renameSync(temporary,absolute);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
    return {state:'SAVED_LOCALLY',task:updated.tasks.find(t=>t.id===action.task_id)??null,usage:usage(updated)};
  } finally {if(handle!==undefined){fs.closeSync(handle);fs.unlinkSync(lock);}}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {console.log(JSON.stringify(main(),null,2));}catch(error){console.error(JSON.stringify({error:error.message}));process.exitCode=1;}
}
