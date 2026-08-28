import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const port=43174,base=`http://127.0.0.1:${port}`;const child=spawn(process.execPath,['server/server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});const wait=ms=>new Promise(r=>setTimeout(r,ms));async function ready(){for(let i=0;i<40;i++){try{if((await fetch(`${base}/api/health`)).ok)return}catch{}await wait(100)}throw new Error('server not ready')}async function req(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});let d={};try{d=await r.json()}catch{}return{r,d}}
try{
 await ready();await req('/api/demo/reset','POST',{});
 let {r,d}=await req('/api/public/leads','POST',{name:'Workflow Test Lead',address:'777 Demo Way',phone:'7725559999',email:'workflow@example.com',service:'Standard Lawn Care'});assert.equal(r.status,201);const lead=d.lead;
 ({r,d}=await req('/api/customers','POST',{name:'Workflow Test Customer',address:'777 Demo Way',property:'777 Demo Way',phone:'7725559998',email:'workflow2@example.com',plan:'Standard Lawn Care',monthlyValue:140}));assert.equal(r.status,201);const c=d.customer;assert.match(c.accountNumber,/^PLC-\d{6}$/);
 ({r,d}=await req('/api/customers','POST',{name:'Workflow Test Customer',property:'888 Other Way',phone:'7725559998',email:'another@example.com'}));assert.equal(r.status,409);assert.equal(d.code,'DUPLICATE_CUSTOMER');
 ({r,d}=await req(`/api/customers/${c.id}/properties`,'POST',{label:'Rental Property',address:'999 Rental Ave',serviceNotes:'Gate code 1234'}));assert.equal(r.status,201);assert.equal(d.customer.properties.length,2);
 ({r,d}=await req('/api/quotes','POST',{customerId:c.id,customer:c.name,propertyId:c.primaryPropertyId,service:'Standard Lawn Care',amount:140,notes:'Workflow test'}));assert.equal(r.status,201);const q=d.quote;assert.equal(q.accountNumber,c.accountNumber);assert.equal(q.status,'Draft');
 ({r,d}=await req(`/api/quotes/${encodeURIComponent(q.id)}/status`,'POST',{status:'Sent'}));assert.equal(r.status,200);assert.equal(d.quote.status,'Sent');
 ({r,d}=await req(`/api/quotes/${encodeURIComponent(q.id)}/status`,'POST',{status:'Accepted'}));assert.equal(r.status,200);assert.equal(d.quote.status,'Accepted');
 ({r,d}=await req(`/api/quotes/${encodeURIComponent(q.id)}/convert`,'POST',{}));assert.equal(r.status,201);const j=d.job;assert.equal(j.sourceQuoteId,q.id);assert.equal(d.quote.status,'Converted');
 ({r,d}=await req('/api/tenant','PUT',{workflow:{autoInvoiceOnCompletion:true,defaultJobDuration:30}}));assert.equal(r.status,200);
 ({r,d}=await req(`/api/jobs/${encodeURIComponent(j.id)}/status`,'POST',{status:'Completed',completionNote:'Done'}));assert.equal(r.status,200);assert.ok(d.invoice);const inv=d.invoice;assert.equal(inv.accountNumber,c.accountNumber);
 ({r,d}=await req(`/api/invoices/${encodeURIComponent(inv.id)}/payment`,'POST',{amount:60,method:'Card'}));assert.equal(r.status,200);assert.equal(d.invoice.status,'Partial');
 ({r,d}=await req(`/api/invoices/${encodeURIComponent(inv.id)}/payment`,'POST',{amount:80,method:'Card'}));assert.equal(r.status,200);assert.equal(d.invoice.status,'Paid');
 ({r,d}=await req('/api/communications/templates','POST',{name:'Test Template',channel:'Both',subject:'Hello',body:'Test'}));assert.equal(r.status,201);
 ({r,d}=await req('/api/expenses','POST',{date:'2026-08-25',category:'Fuel',vendor:'Demo Fuel',amount:25}));assert.equal(r.status,201);
 ({r,d}=await req('/api/inventory','POST',{name:'Test Item',qty:2,reorderAt:3,unit:'units'}));assert.equal(r.status,201);
 ({r,d}=await req('/api/maintenance','POST',{equipment:'Test Mower',type:'Blade',due:'2026-09-01'}));assert.equal(r.status,201);
 ({r,d}=await req('/api/customer-requests','POST',{customerId:c.id,type:'Schedule change',message:'Friday please'}));assert.equal(r.status,201);
 ({r,d}=await req('/api/tenant','PUT',{shortName:'Paradise Test Brand',brand:{accent:'#123456'},websiteHero:{headline:'Brand test'}}));assert.equal(r.status,200);
 ({r,d}=await req('/api/public/config'));assert.equal(d.tenant.shortName,'Paradise Test Brand');assert.equal(d.tenant.websiteHero.headline,'Brand test');
 await req('/api/demo/reset','POST',{});({r,d}=await req('/api/bootstrap?role=owner'));assert.equal(d.customers.length,10);assert.equal(d.tenant.shortName,'Paradise Lawn Care');
 console.log('workflow: PASS');
}finally{child.kill('SIGTERM')}
