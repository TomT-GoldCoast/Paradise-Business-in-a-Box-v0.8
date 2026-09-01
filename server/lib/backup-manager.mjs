import { mkdir, readdir, readFile, writeFile, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

const day=s=>s.slice(0,10),weekKey=d=>{const x=new Date(`${d}T12:00:00Z`);const onejan=new Date(Date.UTC(x.getUTCFullYear(),0,1));const week=Math.ceil((((x-onejan)/86400000)+onejan.getUTCDay()+1)/7);return `${x.getUTCFullYear()}-W${String(week).padStart(2,'0')}`},monthKey=d=>d.slice(0,7);
export class BackupManager{
  constructor({archiveDir,version='0.8.3'}){this.archiveDir=archiveDir;this.version=version;this.lastSnapshotDate='';}
  async init(){await mkdir(this.archiveDir,{recursive:true});}
  async snapshot(db,reason='scheduled'){
    await this.init();const now=new Date().toISOString(),stamp=now.replace(/[:.]/g,'-');const file=path.join(this.archiveDir,`combo-web-and-app-${stamp}.json`);
    const payload={ok:true,version:this.version,exportedAt:now,reason,data:db};await writeFile(file,JSON.stringify(payload,null,2));this.lastSnapshotDate=day(now);await this.prune();return file;
  }
  async snapshotIfDue(db){const d=day(new Date().toISOString());if(this.lastSnapshotDate!==d)return this.snapshot(db,'daily');return null}
  async list(){await this.init();const names=(await readdir(this.archiveDir)).filter(x=>x.endsWith('.json')).sort().reverse();const out=[];for(const name of names){const p=path.join(this.archiveDir,name);const s=await stat(p);out.push({name,size:s.size,modified:s.mtime.toISOString()})}return out;}
  async latest(){const list=await this.list();if(!list[0])return null;return {meta:list[0],content:await readFile(path.join(this.archiveDir,list[0].name),'utf8')}}
  async prune(){
    const list=(await this.list()).sort((a,b)=>b.modified.localeCompare(a.modified));const keep=new Set(),daily=new Set(),weekly=new Set(),monthly=new Set();
    for(const item of list){const d=day(item.modified),w=weekKey(d),m=monthKey(d);if(daily.size<30&&!daily.has(d)){daily.add(d);keep.add(item.name);continue}if(weekly.size<12&&!weekly.has(w)){weekly.add(w);keep.add(item.name);continue}if(monthly.size<12&&!monthly.has(m)){monthly.add(m);keep.add(item.name);continue}}
    for(const item of list)if(!keep.has(item.name))await unlink(path.join(this.archiveDir,item.name)).catch(()=>{});
  }
}
