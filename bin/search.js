import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

// Literal local search is the default. Symlinks are not followed across a manuscript.
export function literalSearch(query,{cwd=process.cwd(),directories=['chapters','characters','worldbuilding','notes'],limit=200}={}) {
  if(typeof query!=='string'||!query.trim())throw new Error('A nonempty search query is required');
  const needle=query.toLocaleLowerCase(),matches=[],root=fs.realpathSync(cwd);
  function walk(dir) {
    if(!fs.existsSync(dir)||fs.lstatSync(dir).isSymbolicLink())return;
    for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      if(matches.length>=limit)return;
      const file=path.join(dir,entry.name);
      if(entry.isSymbolicLink())continue;
      if(entry.isDirectory())walk(file);
      else if(entry.isFile()&&entry.name.endsWith('.md')) {
        const stat=fs.statSync(file);if(stat.size>10*1024*1024)continue;
        fs.readFileSync(file,'utf8').split(/\r?\n/).forEach((line,index)=>{
          if(matches.length<limit&&line.toLocaleLowerCase().includes(needle))matches.push({path:path.relative(root,file),line:index+1,text:line});
        });
      }
    }
  }
  for(const dir of directories) {
    const target=path.resolve(root,dir),relative=path.relative(root,target);
    if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Search directories must remain inside the manuscript');
    walk(target);
  }
  return matches;
}

export function semanticSearch(query,{script,cwd=process.cwd(),python='python3',execute=execFileSync}={}) {
  if(typeof query!=='string'||!query.trim()||query==='--limit')throw new Error('A valid semantic query is required');
  if(!script||!fs.existsSync(script))throw new Error('Semantic search adapter is missing');
  const dbDir=path.resolve(cwd,'memory','.index');
  if(!fs.existsSync(path.join(dbDir,'vectors.db')))throw new Error('No manuscript-scoped index; set MEMSEARCH_DB_DIR to memory/.index when indexing');
  return execute(python,[script,'search',query],{cwd,encoding:'utf8',timeout:10000,stdio:['pipe','pipe','pipe'],env:{...process.env,MEMSEARCH_DB_DIR:dbDir}});
}
