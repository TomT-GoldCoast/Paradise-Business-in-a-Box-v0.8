import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const port=43176,base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server/server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<50;i++){try{if((await fetch(`${base}/api/health`)).ok)return}catch{}await wait(100)}throw new Error('server not ready')}
try{
  await ready();
  let r=await fetch(`${base}/website`);assert.equal(r.status,200);let html=await r.text();
  assert.match(html,/We make your lawn/i);assert.match(html,/Paradise Perfect/i);assert.match(html,/772-323-9401/);assert.match(html,/paradiselawncare772@gmail\.com/);
  for(const area of ['Port St. Lucie','Jensen Beach','Stuart','Palm City','Hobe Sound'])assert.ok(html.includes(area),`missing ${area}`);
  assert.ok(!html.includes('$140'), 'public site must not hard-code $140');assert.ok(!html.includes('$160'), 'public site must not hard-code $160');
  r=await fetch(`${base}/website/blog.html`);assert.equal(r.status,200);html=await r.text();assert.match(html,/31/);assert.match(html,/How Often Should You Mow/i);
  for(const slug of ['port-st-lucie','jensen-beach','stuart','palm-city','hobe-sound']){r=await fetch(`${base}/website/service-areas/${slug}.html`);assert.equal(r.status,200);const areaHtml=await r.text();assert.match(areaHtml,/Request a Property Estimate/);assert.ok(!areaHtml.includes('$140')&&!areaHtml.includes('$160'));}
  const articleJson=JSON.parse(await readFile(new URL('../website/articles/articles.json',import.meta.url),'utf8'));assert.equal(articleJson.length,31);
  r=await fetch(`${base}/app`);assert.equal(r.status,200);html=await r.text();assert.match(html,/Operations/);
  r=await fetch(`${base}/api/public/config`);const cfg=await r.json();assert.equal(cfg.tenant.email,'paradiselawncare772@gmail.com');assert.equal(cfg.tenant.phone,'772-323-9401');
  r=await fetch(`${base}/api/public/leads`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'UI Regression',phone:'7725550101',email:'ui@example.com',address:'1 Test Way, Port St. Lucie, FL',service:'Recurring lawn maintenance',notes:'Regression'})});assert.equal(r.status,201);
  await fetch(`${base}/api/demo/reset`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  console.log('public-ui-regression: PASS');
}finally{child.kill('SIGTERM')}
