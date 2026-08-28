import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

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

export function createStorage(dataFile){ return new JsonStorageAdapter(path.resolve(dataFile)); }
