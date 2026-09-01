import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;

export class JsonStorageAdapter {
  constructor(filePath){ this.filePath=filePath; this.queue=Promise.resolve(); }
  async read(){ return JSON.parse(await readFile(this.filePath,'utf8')); }
  async write(db){
    this.queue=this.queue.then(async()=>{
      const tmp=`${this.filePath}.tmp`;
      await writeFile(tmp,JSON.stringify(db,null,2));
      await rename(tmp,this.filePath);
    });
    return this.queue;
  }
  async reset(seedPath){
    const seed=JSON.parse(await readFile(seedPath,'utf8'));
    await this.write(seed);
    return seed;
  }
}

export class PostgresStorageAdapter {
  constructor(databaseUrl, seedPath){
    this.seedPath=path.resolve(seedPath);
    this.pool=new Pool({ connectionString: databaseUrl });
    this.queue=Promise.resolve();
    this.ready=this.initialize();
  }
  async initialize(){
    await this.pool.query(`CREATE TABLE IF NOT EXISTS paradise_state (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const existing=await this.pool.query('SELECT 1 FROM paradise_state WHERE id=$1',['production']);
    if(!existing.rowCount){
      const seed=JSON.parse(await readFile(this.seedPath,'utf8'));
      await this.pool.query('INSERT INTO paradise_state (id,data) VALUES ($1,$2::jsonb) ON CONFLICT (id) DO NOTHING',['production',JSON.stringify(seed)]);
    }
  }
  async read(){
    await this.ready;
    const result=await this.pool.query('SELECT data FROM paradise_state WHERE id=$1',['production']);
    if(!result.rowCount) throw new Error('Production state is missing from PostgreSQL.');
    return result.rows[0].data;
  }
  async write(db){
    await this.ready;
    this.queue=this.queue.then(()=>this.pool.query(
      `INSERT INTO paradise_state (id,data,updated_at) VALUES ($1,$2::jsonb,NOW())
       ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()`,
      ['production',JSON.stringify(db)]
    ));
    await this.queue;
  }
  async reset(seedPath=this.seedPath){
    const seed=JSON.parse(await readFile(seedPath,'utf8'));
    await this.write(seed);
    return seed;
  }
}

export function createStorage(dataFile){
  const resolved=path.resolve(dataFile);
  const isProduction=path.basename(resolved)==='production.json';
  if(isProduction && process.env.DATABASE_URL){
    const seedPath=path.join(path.dirname(resolved),'production-seed.json');
    return new PostgresStorageAdapter(process.env.DATABASE_URL,seedPath);
  }
  return new JsonStorageAdapter(resolved);
}
