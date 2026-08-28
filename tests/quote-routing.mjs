import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const port=43175,base=`http://127.0.0.1:${port}`;const child=spawn(process.execPath,['server/server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});const wait=ms=>new Promise(r=>setTimeout(r,ms));async function ready(){for(let i=0;i<40;i++){try{if((await fetch(`${base}/api/health`)).ok)return}catch{}await wait(100)}throw new Error('server not ready')}async function req(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});let d={};try{d=await r.json()}catch{}return{r,d}}
try{
 await ready();await req('/api/demo/reset','POST',{});
 let {r,d}=await req('/api/quotes','POST',{customer:'Routing Prospect',prospectEmail:'routing@example.com',prospectPhone:'7725551212',prospectAddress:'44 Routing Lane',service:'Standard Lawn Care',amount:155,notes:'Routing regression'});assert.equal(r.status,201);const q=d.quote;assert.equal(q.status,'Draft');
 ({r,d}=await req(`/api/quotes/${q.id}/convert`,'POST',{}));assert.equal(r.status,409);assert.equal(d.code,'QUOTE_NOT_ACCEPTED');
 ({r,d}=await req(`/api/quotes/${q.id}/status`,'POST',{status:'Sent'}));assert.equal(r.status,200);assert.equal(d.quote.status,'Sent');
 ({r,d}=await req(`/api/quotes/${q.id}/status`,'POST',{status:'Accepted'}));assert.equal(r.status,200);assert.equal(d.quote.status,'Accepted');
 ({r,d}=await req(`/api/quotes/${q.id}/convert`,'POST',{}));assert.equal(r.status,201);assert.equal(d.quote.status,'Converted');assert.ok(d.customer.id);assert.ok(d.job.id);const firstJob=d.job.id,firstCustomer=d.customer.id;
 ({r,d}=await req(`/api/quotes/${q.id}/convert`,'POST',{}));assert.equal(r.status,200);assert.equal(d.alreadyConverted,true);assert.equal(d.job.id,firstJob);
 ({r,d}=await req('/api/bootstrap?role=owner'));assert.equal(d.quotes.find(x=>x.id===q.id).convertedCustomerId,firstCustomer);assert.equal(d.jobs.filter(x=>x.sourceQuoteId===q.id).length,1);
 console.log('quote-routing: PASS');
}finally{child.kill('SIGTERM')}
