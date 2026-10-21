import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {literalSearch,semanticSearch} from './search.js';

function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'author-search-'));fs.mkdirSync(path.join(dir,'chapters'));return {dir,cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};}
test('search treats shell syntax and regex as literal manuscript text',()=>{
 const f=fixture();try {
 const query='$(touch INJECTED) `touch OTHER` [a-z].*';fs.writeFileSync(path.join(f.dir,'chapters','one.md'),query);
 assert.equal(literalSearch(query,{cwd:f.dir}).length,1);
 const output=execFileSync(process.execPath,[path.resolve('bin/author.js'),'search',query],{cwd:f.dir,encoding:'utf8'});
 assert.ok(output.includes(query));assert.ok(!fs.existsSync(path.join(f.dir,'INJECTED')));assert.ok(!fs.existsSync(path.join(f.dir,'OTHER')));
 }finally{f.cleanup();}
});
test('literal search skips symlinks, preserves line numbers and bounds results',()=>{
 const f=fixture(),other=fs.mkdtempSync(path.join(os.tmpdir(),'search-outside-'));try {
 fs.writeFileSync(path.join(other,'private.md'),'needle');fs.symlinkSync(path.join(other,'private.md'),path.join(f.dir,'chapters','private.md'));
 fs.writeFileSync(path.join(f.dir,'chapters','one.md'),'heading\nNeedle\nneedle');
 const result=literalSearch('needle',{cwd:f.dir,limit:1});assert.equal(result.length,1);assert.equal(result[0].line,2);
 assert.throws(()=>literalSearch('needle',{cwd:f.dir,directories:['../']}),/inside the manuscript/);
 }finally{f.cleanup();fs.rmSync(other,{recursive:true,force:true});}
});
test('semantic adapter uses search subcommand, isolated index and argv without shell',()=>{
 const f=fixture();try {
 const script=path.join(f.dir,'stub.py');fs.writeFileSync(script,'# stub');
 assert.throws(()=>semanticSearch('query',{script,cwd:f.dir}),/No manuscript-scoped/);
 fs.mkdirSync(path.join(f.dir,'memory','.index'),{recursive:true});fs.writeFileSync(path.join(f.dir,'memory','.index','vectors.db'),'');
 let captured;
 const result=semanticSearch('$(touch PWN)',{script,cwd:f.dir,execute:(...args)=>{captured=args;return 'result';}});
 assert.equal(result,'result');assert.deepEqual(captured[1],[script,'search','$(touch PWN)']);assert.equal(captured[2].shell,undefined);
 assert.equal(captured[2].env.MEMSEARCH_DB_DIR,path.join(f.dir,'memory','.index'));
 }finally{f.cleanup();}
});
test('intermediate directory symlinks cannot expose another manuscript',()=>{
 const f=fixture(),other=fs.mkdtempSync(path.join(os.tmpdir(),'search-private-'));try {
 fs.mkdirSync(path.join(other,'chapters'));fs.writeFileSync(path.join(other,'chapters','private.md'),'PRIVATE needle');
 fs.symlinkSync(other,path.join(f.dir,'bridge'));
 assert.throws(()=>literalSearch('needle',{cwd:f.dir,directories:['bridge/chapters']}),/outside the manuscript/);
 fs.mkdirSync(path.join(f.dir,'memory'));fs.mkdirSync(path.join(other,'index'));fs.writeFileSync(path.join(other,'index','vectors.db'),'');
 fs.symlinkSync(path.join(other,'index'),path.join(f.dir,'memory','.index'));
 const script=path.join(f.dir,'stub.py');fs.writeFileSync(script,'#stub');let invoked=false;
 assert.throws(()=>semanticSearch('needle',{script,cwd:f.dir,execute:()=>{invoked=true;}}),/inside the manuscript/);
 assert.equal(invoked,false);
 }finally{f.cleanup();fs.rmSync(other,{recursive:true,force:true});}
});
