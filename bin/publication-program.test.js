import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {sha256,validateProgram,readyTasks,transition,compileBook,approvalScope,main} from './publication-program.js';

const now=new Date('2026-10-21T00:00:00Z');
function fixture() {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'author-program-'));
 const body='# Starting again\n\nA hand writes <script>alert(1)</script> in a notebook.\n\n[private](file:///secret)';
 fs.writeFileSync(path.join(root,'chapter.md'),body);
 const chapter={id:'opening',title:'An opening',path:'chapter.md',origin:'ai',sha256:sha256(body),sources:[],claims:[{id:'argument',status:'interpretation',source_ids:[]}]};
 const program={schema_version:1,id:'reader-test',title:'Reader test',budget:{usd_cap:10,tokens_cap:1000,verification_reserve:.25},books:[{id:'sample',title:'A sample',author:'An author',language:'en',chapters:[chapter]}],tasks:[{id:'research',book_id:'sample',role:'research',state:'queued',depends_on:[],estimate_tokens:500,estimate_usd:2},{id:'edit',book_id:'sample',role:'edit',state:'queued',depends_on:['research'],estimate_tokens:250,estimate_usd:1},{id:'verify',book_id:'sample',role:'verify',state:'queued',depends_on:['edit'],estimate_tokens:250,estimate_usd:1}]};
 return {root,program,chapter,body,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
function claim(program,id='research',worker='worker-a',token='lease-a') {return transition(program,{type:'claim',task_id:id,worker,lease_token:token,lease_seconds:60},now);}
function done(program,id='research',worker='worker-a',token='lease-a',tokens=400,usd=1) {return transition(program,{type:'complete',task_id:id,worker,lease_token:token,tokens,usd,artifact:'evidence/research.json'},new Date(now.getTime()+1000));}
function approve(f) {f.chapter.public_export={approved:true,approved_sha256:f.chapter.sha256,approved_scope_sha256:approvalScope(f.program.books[0],f.chapter),rights:'cleared',attestation_type:'operator_record',reviewed_by:'test operator',reviewed_at:now.toISOString()};}

test('dependency order, worker lease, exact completion retry and no mutation',()=>{
 const f=fixture();try {
 assert.deepEqual(readyTasks(f.program).map(t=>t.id),['research']);
 assert.throws(()=>claim(f.program,'edit'),/not ready/);
 const running=claim(f.program);assert.equal(f.program.tasks[0].state,'queued');
 assert.throws(()=>done(running,'research','worker-b'),/does not own/);
 const complete=done(running);assert.equal(complete.tasks[0].state,'done');
 assert.deepEqual(done(complete),complete);
 assert.throws(()=>done(complete,'research','worker-a','lease-a',401),/retry differs/);
 assert.deepEqual(readyTasks(complete).map(t=>t.id),['edit']);
 }finally{f.cleanup();}
});
test('concurrent reservations preserve verification budget',()=>{
 const f=fixture();try {
 f.program.tasks[0].resources=['chapter:one'];f.program.tasks[1].resources=['chapter:two'];
 f.program.tasks[1].depends_on=[];f.program.tasks[1].estimate_tokens=400;
 const running=claim(f.program);
 assert.throws(()=>claim(running,'edit'),/exceeds budget/);
 f.program.tasks[1].estimate_tokens=250;
 const both=claim(claim(f.program),'edit','worker-b','lease-b');
 assert.equal(both.tasks.filter(t=>t.state==='running').length,2);
 assert.throws(()=>done(claim(f.program),'research','worker-a','lease-a',501),/reservation/);
 f.program.budget.usd_cap=.5;
 assert.equal(readyTasks(f.program).length,0);
 }finally{f.cleanup();}
});
test('book-scoped leases prevent independent tasks writing the same manuscript',()=>{
 const f=fixture();try {
 f.program.tasks[1].depends_on=[];
 const running=claim(f.program);
 assert.throws(()=>claim(running,'edit','worker-b','lease-b'),/not ready/);
 assert.deepEqual(readyTasks(running),[]);
 }finally{f.cleanup();}
});
test('expired leases cannot finish and recovery conservatively accounts for possible usage',()=>{
 const f=fixture();try {
 const running=claim(f.program);
 assert.throws(()=>transition(running,{type:'complete',task_id:'research',worker:'worker-a',lease_token:'lease-a',tokens:1,usd:1,artifact:'x'},new Date(now.getTime()+60001)),/expired/);
 const recovered=transition(running,{type:'recover'},new Date(now.getTime()+60001));
 assert.equal(recovered.tasks[0].state,'queued');
 assert.equal(recovered.tasks[0].receipt.kind,'expired_lease_reservation');
 assert.equal(recovered.tasks[0].receipt.tokens,500);
 assert.equal(readyTasks(recovered).length,0,'retry cannot silently spend the reservation again');
 }finally{f.cleanup();}
});
test('invalid graph, duplicate IDs, unknown claims and budget values fail closed',()=>{
 const f=fixture();try {
 for(const change of [p=>{p.tasks[0].depends_on=['verify'];},p=>{p.tasks[0].depends_on=['missing'];},p=>{p.books[0].chapters.push({...p.books[0].chapters[0]});},p=>{p.budget.verification_reserve=.1;},p=>{p.tasks[0].estimate_tokens=-1;},p=>{p.books[0].chapters[0].claims[0].status='verified';}]) {
 const copy=structuredClone(f.program);change(copy);assert.throws(()=>validateProgram(copy));
 }
 }finally{f.cleanup();}
});
test('proof is deterministic, ordered, escaped and contains no internal paths',()=>{
 const f=fixture();try {
 const second={...f.chapter,id:'second',title:'Second'};f.program.books[0].chapters.push(second);
 const result=compileBook(f.program,'sample',f.root,{selectedIds:['second','opening']});
 assert.deepEqual(result,compileBook(f.program,'sample',f.root,{selectedIds:['second','opening']}));
 assert.equal(result.manifest.chapters[0].id,'second');
 assert.ok(result.html.includes('&lt;script&gt;'));assert.ok(!result.html.includes('<script>'));
 assert.ok(result.html.includes('<main id="reading">'));assert.ok(result.html.includes('aria-label="Chapters"'));
 assert.ok(!JSON.stringify(result.manifest).includes('chapter.md'));
 assert.throws(()=>compileBook(f.program,'sample',f.root),/explicit chapter/);
 }finally{f.cleanup();}
});
test('public export requires supplied scoped approval, clear rights and no unresolved claims',()=>{
 const f=fixture();try {
 assert.throws(()=>compileBook(f.program,'sample',f.root,{selectedIds:['opening'],publicExport:true}),/review\/rights/);
 approve(f);assert.equal(compileBook(f.program,'sample',f.root,{selectedIds:['opening'],publicExport:true}).manifest.scope,'approved_public_selection');
 f.chapter.claims[0].status='unresolved';approve(f);
 assert.throws(()=>compileBook(f.program,'sample',f.root,{selectedIds:['opening'],publicExport:true}),/unresolved/);
 f.chapter.claims[0].status='interpretation';approve(f);f.program.books[0].author='Changed name';
 assert.throws(()=>compileBook(f.program,'sample',f.root,{selectedIds:['opening'],publicExport:true}),/review\/rights/);
 }finally{f.cleanup();}
});
test('private/uncleared sources are blocked and never copied into exported provenance',()=>{
 const f=fixture();try {
 f.chapter.sources=[{id:'personal-chat',visibility:'private',rights:'private',locator:'PRIVATE SECRET'}];approve(f);
 assert.throws(()=>compileBook(f.program,'sample',f.root,{selectedIds:['opening'],publicExport:true}),/private or uncleared/);
 const proof=compileBook(f.program,'sample',f.root,{selectedIds:['opening']});
 assert.ok(!JSON.stringify(proof.manifest).includes('PRIVATE SECRET'));
 f.chapter.sources=[{id:'study',visibility:'public',rights:'cleared',url:'https://example.org/paper?token=secret'}];
 assert.throws(()=>validateProgram(f.program),/query tokens/);
 }finally{f.cleanup();}
});
test('changed source, path traversal and symlink escape fail',()=>{
 const f=fixture();const outside=fs.mkdtempSync(path.join(os.tmpdir(),'outside-'));try {
 fs.writeFileSync(path.join(f.root,'chapter.md'),'changed');
 assert.throws(()=>compileBook(f.program,'sample',f.root,{selectedIds:['opening']}),/source changed/);
 f.chapter.path='../secret';assert.throws(()=>compileBook(f.program,'sample',f.root,{selectedIds:['opening']}),/inside manifest/);
 fs.writeFileSync(path.join(outside,'secret.md'),f.body);fs.symlinkSync(path.join(outside,'secret.md'),path.join(f.root,'link.md'));
 f.chapter.path='link.md';assert.throws(()=>compileBook(f.program,'sample',f.root,{selectedIds:['opening']}),/symlink escapes/);
 }finally{f.cleanup();fs.rmSync(outside,{recursive:true,force:true});}
});
test('CLI lock, atomic persistence, immutable editions and missing-artifact repair',()=>{
 const f=fixture();try {
 const file=path.join(f.root,'program.json'),out=path.join(f.root,'output');fs.writeFileSync(file,JSON.stringify(f.program));
 fs.writeFileSync(file+'.lock','busy');assert.throws(()=>main(['claim',file,'research','worker-a','60']),/EEXIST/);assert.ok(fs.existsSync(file+'.lock'));fs.unlinkSync(file+'.lock');
 const claimed=main(['claim',file,'research','worker-a','60','lease-a']);assert.equal(claimed.task.state,'running');assert.ok(!fs.existsSync(file+'.lock'));
 const edition=main(['compile',file,'sample',out,'opening']);
 const html=path.join(edition.directory,'reading.html');fs.unlinkSync(html);main(['compile',file,'sample',out,'opening']);assert.ok(fs.existsSync(html));
 fs.writeFileSync(html,'manually changed');assert.throws(()=>main(['compile',file,'sample',out,'opening']),/refusing to overwrite/);
 const cli=spawnSync(process.execPath,['bin/author.js','program','validate',file],{cwd:path.resolve(import.meta.dirname??path.dirname(new URL(import.meta.url).pathname),'..'),encoding:'utf8'});
 assert.equal(cli.status,0,cli.stderr);assert.equal(JSON.parse(cli.stdout).valid,true);
 }finally{f.cleanup();}
});
