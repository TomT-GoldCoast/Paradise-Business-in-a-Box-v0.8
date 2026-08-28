import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStorage } from './lib/storage.mjs';
import { activity, canTransitionQuote, customerFor, duplicateMatches, nextAccountNumber, nextPropertyId, permissions, publicConfig, recalc, syncCustomerDenormalized, today, uid } from './lib/domain.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const dataFile=path.join(__dirname,'data','demo.json');
const seedFile=path.join(__dirname,'data','seed.json');
const storage=createStorage(dataFile);
const PORT=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const json=(res,status,payload)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(payload));};
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return{}}}
const roleFrom=url=>url.searchParams.get('role')||'owner';
function bootstrap(db,role,requestedCustomer){
  recalc(db);const user=db.users.find(u=>u.role===role)||db.users[0];const customer=(requestedCustomer&&customerFor(db,requestedCustomer))||db.customers[0]||null;
  return {tenant:db.tenant,user,permissions:permissions(role),metrics:db.metrics,leads:db.leads||[],quotes:db.quotes||[],jobs:db.jobs||[],invoices:db.invoices||[],customers:db.customers||[],team:db.team||[],services:db.services||[],customer,activity:db.activity||[],communications:db.communications||{templates:[],log:[]},customerRequests:db.customerRequests||[],expenses:db.expenses||[],inventory:db.inventory||[],maintenance:db.maintenance||[],payroll:db.payroll||[],attachments:db.attachments||[],billingQueue:billingGroups(db),billingSummary:{ready:billingGroups(db).filter(g=>g.period.ready).length,pending:billingGroups(db).filter(g=>!g.period.ready).length,unbilledTotal:billingGroups(db).reduce((sum,g)=>sum+g.total,0)}};
}
function requireItem(res,item,label='Record'){if(!item){json(res,404,{error:`${label} not found`});return false}return true}
function addDays(dateString,days){const d=new Date(`${dateString||today()}T12:00:00`);d.setDate(d.getDate()+Number(days||0));return d.toISOString().slice(0,10)}
function billingMethod(c){return c?.billingMethod||'Per Service'}
function billingAnchor(c){return c?.billingAnchor||c?.createdAt?.slice?.(0,10)||today()}
function readyPeriodFor(c,job,asOf=today()){
  const method=billingMethod(c),date=job.completedDate||job.date||today(),anchor=billingAnchor(c);
  if(method==='Manual')return {key:`manual:${job.id}`,label:'Manual billing',ready:false,readyDate:'9999-12-31'};
  if(method==='Per Service')return {key:`service:${job.id}`,label:date,ready:true,readyDate:date};
  if(method==='Bi-Weekly'){
    const a=new Date(`${anchor}T12:00:00`),d=new Date(`${date}T12:00:00`);const days=Math.floor((d-a)/86400000);const idx=Math.max(0,Math.floor(days/14));
    const start=addDays(anchor,idx*14),end=addDays(start,13),readyDate=addDays(end,1);return {key:`biweekly:${start}`,label:`${start} to ${end}`,ready:asOf>=readyDate,readyDate};
  }
  const month=date.slice(0,7),anchorDay=Math.max(1,Math.min(28,Number(String(anchor).slice(8,10)||1)));const readyDate=`${month}-${String(anchorDay).padStart(2,'0')}`;
  return {key:`monthly:${month}`,label:new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US',{month:'long',year:'numeric'}),ready:asOf>=readyDate,readyDate};
}
function billingGroups(db,asOf=today()){
  const groups=new Map();
  for(const j of db.jobs||[]){if(j.status!=='Completed'||j.billedInvoiceId)continue;const c=customerFor(db,j.customerId);if(!c)continue;const period=readyPeriodFor(c,j,asOf),key=`${c.id}|${period.key}`;if(!groups.has(key))groups.set(key,{key,customer:c,method:billingMethod(c),period,jobs:[],total:0});const g=groups.get(key);g.jobs.push(j);g.total+=Number(j.amount||0)}
  return [...groups.values()];
}
function createInvoiceFromGroup(db,g){
  const lines=g.jobs.map(j=>({jobId:j.id,date:j.completedDate||j.date,description:`${j.service} · ${j.completedDate||j.date}`,qty:1,rate:Number(j.amount||0),amount:Number(j.amount||0)}));
  const amount=lines.reduce((s,l)=>s+l.amount,0);const first=g.jobs[0];const inv={id:`INV-${String(db.counters.invoice++).padStart(5,'0')}`,customerId:g.customer.id,accountNumber:g.customer.accountNumber||'',propertyId:first?.propertyId||g.customer.primaryPropertyId||'',jobId:g.jobs.length===1?first.id:'',jobIds:g.jobs.map(j=>j.id),customer:g.customer.name,preferredContact:g.customer.preferredContact||'Phone',amount,status:'Ready to Send',communicationStatus:'Ready to Send',billingMethod:g.method,billingPeriod:g.period.label,due:addDays(today(),14),created:today(),paid:0,lines};
  db.invoices.unshift(inv);for(const j of g.jobs)j.billedInvoiceId=inv.id;g.customer.balance=Number(g.customer.balance||0)+amount;activity(db,`${inv.id} populated · ${g.customer.name} · ${g.method}`,'invoice');return inv;
}
function processBilling(db,asOf=today()){
  const created=[];for(const g of billingGroups(db,asOf)){if(g.period.ready)created.push(createInvoiceFromGroup(db,g))}if(created.length)recalc(db);return created;
}

async function api(req,res,url){
  const db=await storage.read();const p=url.pathname;
  if(req.method==='GET'&&p==='/api/health')return json(res,200,{ok:true,version:'0.8.0',storage:'json-storage-adapter',architecture:'api-first-multi-role'});
  if(req.method==='GET'&&p==='/api/bootstrap'){const created=processBilling(db);if(created.length)await storage.write(db);return json(res,200,bootstrap(db,roleFrom(url),url.searchParams.get('customer')));}
  if(req.method==='GET'&&p==='/api/public/config')return json(res,200,publicConfig(db));
  if(req.method==='GET'&&p==='/api/tenant')return json(res,200,{tenant:db.tenant});
  if(req.method==='PUT'&&p==='/api/tenant'){
    const x=await body(req);db.tenant={...db.tenant,...x,brand:{...(db.tenant.brand||{}),...(x.brand||{})},websiteHero:{...(db.tenant.websiteHero||{}),...(x.websiteHero||{})},workflow:{...(db.tenant.workflow||{}),...(x.workflow||{})}};
    activity(db,`Tenant configuration updated · ${db.tenant.shortName||db.tenant.name}`,'settings');await storage.write(db);return json(res,200,{ok:true,tenant:db.tenant});
  }
  if(req.method==='POST'&&p==='/api/demo/reset'){await storage.reset(seedFile);return json(res,200,{ok:true});}
  if(req.method==='GET'&&p==='/api/backup/export')return json(res,200,{ok:true,version:'0.7.0',exportedAt:new Date().toISOString(),data:db});
  if(req.method==='POST'&&p==='/api/backup/restore'){
    const payload=await body(req);const candidate=payload?.data||payload;
    const required=['customers','leads','quotes','jobs','invoices','services','users'];
    if(!candidate||typeof candidate!=='object'||!candidate.tenant||required.some(key=>!Array.isArray(candidate[key])))return json(res,400,{error:'Backup is not a valid Business in a Box tenant export',code:'INVALID_BACKUP'});
    if(!candidate.tenant.name||!candidate.tenant.brand)return json(res,400,{error:'Backup tenant identity or branding is incomplete',code:'INVALID_BACKUP_TENANT'});
    candidate.activity=Array.isArray(candidate.activity)?candidate.activity:[];activity(candidate,'Backup restored through validated import','backup');await storage.write(candidate);return json(res,200,{ok:true,tenant:candidate.tenant.name});
  }

  if(req.method==='GET'&&p==='/api/customers/duplicates')return json(res,200,{matches:duplicateMatches(db,Object.fromEntries(url.searchParams))});
  if(req.method==='GET'&&p==='/api/customers')return json(res,200,{customers:db.customers});
  if(req.method==='POST'&&p==='/api/customers'){
    const x=await body(req);const matches=duplicateMatches(db,x);if(matches.length&&!x.allowDuplicate)return json(res,409,{error:'Possible duplicate customer',code:'DUPLICATE_CUSTOMER',matches});
    const propertyId=nextPropertyId(db);const c={id:uid('cust'),accountNumber:nextAccountNumber(db),name:x.name||'New Customer',email:x.email||'',phone:x.phone||'',status:x.status||'Active',preferredContact:x.preferredContact||'Phone',preferredPayment:x.preferredPayment||'Invoice',customerType:x.customerType||'Residential',serviceFrequency:x.serviceFrequency||'Weekly',billingMethod:x.billingMethod||'Per Service',billingAnchor:x.billingAnchor||today(),property:x.property||'',properties:[{id:propertyId,label:'Primary Property',address:x.property||'',serviceNotes:x.notes||'',active:true}],primaryPropertyId:propertyId,plan:x.plan||db.services?.[0]?.name||'Service plan',monthlyValue:Number(x.monthlyValue||0),nextService:x.nextService||'',balance:Number(x.balance||0),lastService:x.lastService||'',notes:x.notes||''};
    db.customers.unshift(c);syncCustomerDenormalized(db,c);recalc(db);activity(db,`Customer ${c.accountNumber} created · ${c.name}`,'customer');await storage.write(db);return json(res,201,{ok:true,customer:c});
  }
  if(/^\/api\/customers\/[^/]+$/.test(p)){
    const customerId=decodeURIComponent(p.split('/')[3]);const c=customerFor(db,customerId);if(!requireItem(res,c,'Customer'))return;
    if(req.method==='GET')return json(res,200,{customer:c});
    if(req.method==='PUT'){
      const x=await body(req);const matches=duplicateMatches(db,x,customerId);if(matches.length&&!x.allowDuplicate)return json(res,409,{error:'Possible duplicate customer',code:'DUPLICATE_CUSTOMER',matches});
      for(const k of ['name','email','phone','status','preferredContact','preferredPayment','customerType','serviceFrequency','billingMethod','billingAnchor','plan','nextService','lastService','notes'])if(x[k]!==undefined)c[k]=x[k];
      if(x.monthlyValue!==undefined)c.monthlyValue=Number(x.monthlyValue||0);if(x.balance!==undefined)c.balance=Number(x.balance||0);
      if(x.property!==undefined){const primary=c.properties?.find(y=>y.id===c.primaryPropertyId)||c.properties?.[0];if(primary)primary.address=x.property;else{const pid=nextPropertyId(db);c.properties=[{id:pid,label:'Primary Property',address:x.property,serviceNotes:x.notes||'',active:true}];c.primaryPropertyId=pid;}}
      syncCustomerDenormalized(db,c);recalc(db);activity(db,`Customer ${c.accountNumber} updated · ${c.name}`,'customer');await storage.write(db);return json(res,200,{ok:true,customer:c});
    }
  }
  if(req.method==='POST'&&/^\/api\/customers\/[^/]+\/properties$/.test(p)){
    const customerId=decodeURIComponent(p.split('/')[3]);const c=customerFor(db,customerId);if(!requireItem(res,c,'Customer'))return;const x=await body(req);const property={id:nextPropertyId(db),label:x.label||`Property ${(c.properties?.length||0)+1}`,address:x.address||'',serviceNotes:x.serviceNotes||'',active:x.active!==false};c.properties??=[];c.properties.push(property);if(!c.primaryPropertyId)c.primaryPropertyId=property.id;syncCustomerDenormalized(db,c);activity(db,`Property added · ${c.accountNumber} · ${property.label}`,'customer');await storage.write(db);return json(res,201,{ok:true,property,customer:c});
  }
  if(req.method==='PUT'&&/^\/api\/customers\/[^/]+\/properties\/[^/]+$/.test(p)){
    const parts=p.split('/');const c=customerFor(db,decodeURIComponent(parts[3]));if(!requireItem(res,c,'Customer'))return;const property=c.properties?.find(x=>x.id===decodeURIComponent(parts[5]));if(!requireItem(res,property,'Property'))return;Object.assign(property,await body(req));syncCustomerDenormalized(db,c);activity(db,`Property updated · ${c.accountNumber} · ${property.label}`,'customer');await storage.write(db);return json(res,200,{ok:true,property,customer:c});
  }

  if(req.method==='POST'&&p==='/api/public/leads'){const x=await body(req);const lead={id:uid('lead'),name:x.name||'Website visitor',service:x.service||'Service request',address:x.address||'',phone:x.phone||'',email:x.email||'',source:x.source||'Website',status:'New',created:'Just now',notes:x.notes||''};db.leads.unshift(lead);activity(db,`Website lead received from ${lead.name}`,'lead');await storage.write(db);return json(res,201,{ok:true,lead});}
  if(req.method==='POST'&&p==='/api/leads'){const x=await body(req);const lead={id:uid('lead'),name:x.name||'New Lead',service:x.service||db.services?.[0]?.name||'Service request',address:x.address||'',phone:x.phone||'',email:x.email||'',source:x.source||'Office',status:x.status||'New',created:'Just now'};db.leads.unshift(lead);activity(db,`Lead created · ${lead.name}`,'lead');await storage.write(db);return json(res,201,{ok:true,lead});}
  if(req.method==='PUT'&&/^\/api\/leads\/[^/]+$/.test(p)){const l=db.leads.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,l,'Lead'))return;Object.assign(l,await body(req));activity(db,`Lead updated · ${l.name} · ${l.status}`,'lead');await storage.write(db);return json(res,200,{ok:true,lead:l});}

  if(req.method==='POST'&&p==='/api/quotes'){
    const x=await body(req);const c=customerFor(db,x.customerId);
    const q={id:`Q-${String(db.counters.quote++).padStart(4,'0')}`,customerId:x.customerId||'',accountNumber:c?.accountNumber||'',propertyId:x.propertyId||c?.primaryPropertyId||'',customer:x.customer||c?.name||x.prospectName||'',prospectEmail:x.prospectEmail||'',prospectPhone:x.prospectPhone||'',prospectAddress:x.prospectAddress||'',service:x.service||db.services?.[0]?.name||'Service',preferredContact:x.preferredContact||c?.preferredContact||'Phone',amount:Number(x.amount||0),status:'Draft',created:today(),notes:x.notes||'',convertedJobId:'',convertedCustomerId:''};
    db.quotes.unshift(q);activity(db,`Quote ${q.id} created · ${q.customer}`,'quote');await storage.write(db);return json(res,201,{ok:true,quote:q});
  }
  if(req.method==='PUT'&&/^\/api\/quotes\/[^/]+$/.test(p)){
    const q=db.quotes.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,q,'Quote'))return;const x=await body(req);
    for(const k of ['customerId','propertyId','customer','prospectEmail','prospectPhone','prospectAddress','service','preferredContact','notes'])if(x[k]!==undefined)q[k]=x[k];if(x.amount!==undefined)q.amount=Number(x.amount||0);
    const c=customerFor(db,q.customerId);if(c){q.customer=c.name;q.accountNumber=c.accountNumber;if(!q.propertyId)q.propertyId=c.primaryPropertyId||'';}
    activity(db,`Quote ${q.id} updated · ${q.status}`,'quote');await storage.write(db);return json(res,200,{ok:true,quote:q});
  }
  if(req.method==='POST'&&/^\/api\/quotes\/[^/]+\/status$/.test(p)){
    const q=db.quotes.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,q,'Quote'))return;const x=await body(req);const next=String(x.status||'');
    if(!canTransitionQuote(q.status,next))return json(res,409,{error:`Quote cannot move from ${q.status} to ${next}`,code:'INVALID_QUOTE_TRANSITION',from:q.status,to:next});
    const prior=q.status;q.status=next;activity(db,`Quote ${q.id} · ${prior} → ${next}`,'quote');await storage.write(db);return json(res,200,{ok:true,quote:q});
  }
  if(req.method==='POST'&&/^\/api\/quotes\/[^/]+\/convert$/.test(p)){
    const q=db.quotes.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,q,'Quote'))return;
    if(q.convertedJobId){const existing=(db.jobs||[]).find(x=>x.id===q.convertedJobId);return json(res,200,{ok:true,alreadyConverted:true,quote:q,job:existing||null});}
    if(q.status!=='Accepted')return json(res,409,{error:'Quote must be Accepted before it can be converted to a job.',code:'QUOTE_NOT_ACCEPTED',status:q.status});
    let c=customerFor(db,q.customerId);
    if(!c){
      const propertyId=nextPropertyId(db);c={id:uid('cust'),accountNumber:nextAccountNumber(db),name:q.customer||'New Customer',email:q.prospectEmail||'',phone:q.prospectPhone||'',status:'Active',preferredContact:q.prospectEmail?'Email':'Phone',preferredPayment:'Invoice',customerType:'Residential',serviceFrequency:'Weekly',billingMethod:'Per Service',billingAnchor:today(),property:q.prospectAddress||'',properties:[{id:propertyId,label:'Primary Property',address:q.prospectAddress||'',serviceNotes:q.notes||'',active:true}],primaryPropertyId:propertyId,plan:q.service||db.services?.[0]?.name||'Service plan',monthlyValue:0,nextService:'',balance:0,lastService:'',notes:q.notes||''};db.customers.unshift(c);q.customerId=c.id;q.accountNumber=c.accountNumber;q.propertyId=c.primaryPropertyId;q.convertedCustomerId=c.id;activity(db,`Quote ${q.id} created customer ${c.accountNumber} · ${c.name}`,'customer');
    }
    const prop=c?.properties?.find(x=>x.id===q.propertyId)||c?.properties?.[0];const j={id:`JOB-${String(db.counters.job++).padStart(4,'0')}`,customerId:c.id,accountNumber:c.accountNumber||'',propertyId:prop?.id||'',customer:c.name,address:prop?.address||c?.property||q.prospectAddress||'',service:q.service,status:'Scheduled',date:today(),time:'9:00 AM',duration:Number(db.tenant.workflow?.defaultJobDuration||30),crew:'Unassigned',amount:q.amount,notes:q.notes||'',sourceQuoteId:q.id};
    db.jobs.unshift(j);q.status='Converted';q.convertedJobId=j.id;q.convertedCustomerId=c.id;recalc(db);activity(db,`Quote ${q.id} converted to ${j.id}`,'job');await storage.write(db);return json(res,201,{ok:true,quote:q,job:j,customer:c});
  }

  if(req.method==='POST'&&p==='/api/jobs'){const x=await body(req);const c=customerFor(db,x.customerId);const prop=c?.properties?.find(y=>y.id===x.propertyId)||c?.properties?.[0];const j={id:`JOB-${String(db.counters.job++).padStart(4,'0')}`,customerId:x.customerId||'',accountNumber:c?.accountNumber||'',propertyId:prop?.id||'',customer:x.customer||c?.name||'',address:x.address||prop?.address||c?.property||'',service:x.service||db.services?.[0]?.name||'Service',status:x.status||'Scheduled',date:x.date||today(),time:x.time||'9:00 AM',duration:Number(x.duration||db.tenant.workflow?.defaultJobDuration||30),crew:x.crew||'Unassigned',amount:Number(x.amount||0),notes:x.notes||''};db.jobs.push(j);recalc(db);activity(db,`Job created · ${j.customer}`,'job');await storage.write(db);return json(res,201,{ok:true,job:j});}
  if(req.method==='PUT'&&/^\/api\/jobs\/[^/]+$/.test(p)){const j=db.jobs.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,j,'Job'))return;const x=await body(req);Object.assign(j,x,{duration:Number(x.duration??j.duration),amount:Number(x.amount??j.amount)});recalc(db);activity(db,`Job updated · ${j.customer}`,'job');await storage.write(db);return json(res,200,{ok:true,job:j});}
  if(req.method==='POST'&&/^\/api\/jobs\/[^/]+\/status$/.test(p)){
    const j=db.jobs.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,j,'Job'))return;const x=await body(req);j.status=x.status||j.status;if(x.completionNote!==undefined)j.completionNote=x.completionNote;
    let invoice=null;if(j.status==='Completed'){const c=customerFor(db,j.customerId);j.completedDate=x.completedDate||today();j.completedAt=new Date().toISOString();if(c)c.lastService=j.completedDate;if(db.tenant.workflow?.autoInvoiceOnCompletion){const created=processBilling(db,j.completedDate);invoice=created.find(i=>(i.jobIds||[]).includes(j.id))||null;}}
    recalc(db);activity(db,`${j.id} · ${j.customer} · ${j.status}`,'job');await storage.write(db);return json(res,200,{ok:true,job:j,invoice});
  }

  if(req.method==='POST'&&p==='/api/invoices'){const x=await body(req);const c=customerFor(db,x.customerId);const amount=Number(x.amount||0);const inv={id:`INV-${String(db.counters.invoice++).padStart(5,'0')}`,customerId:x.customerId||'',accountNumber:c?.accountNumber||'',propertyId:x.propertyId||c?.primaryPropertyId||'',jobId:x.jobId||'',customer:x.customer||c?.name||'',preferredContact:x.preferredContact||c?.preferredContact||'Phone',amount,status:x.status||'Ready to Send',communicationStatus:x.communicationStatus||'Ready to Send',due:x.due||today(),created:today(),paid:0,lines:x.lines||[{description:x.description||'Service',qty:1,rate:amount,amount}]};db.invoices.unshift(inv);if(c&&inv.status!=='Paid')c.balance=Number(c.balance||0)+inv.amount;recalc(db);activity(db,`${inv.id} created · ${inv.customer}`,'invoice');await storage.write(db);return json(res,201,{ok:true,invoice:inv});}
  if(req.method==='GET'&&p==='/api/billing/queue')return json(res,200,{groups:billingGroups(db),summary:{ready:billingGroups(db).filter(g=>g.period.ready).length,pending:billingGroups(db).filter(g=>!g.period.ready).length,total:billingGroups(db).reduce((s,g)=>s+g.total,0)}});
  if(req.method==='POST'&&p==='/api/billing/process'){const x=await body(req);const created=processBilling(db,x.asOf||today());await storage.write(db);return json(res,200,{ok:true,created,groups:billingGroups(db,x.asOf||today())});}
  if(req.method==='POST'&&/^\/api\/invoices\/[^/]+\/send$/.test(p)){const inv=db.invoices.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,inv,'Invoice'))return;const x=await body(req);inv.status=inv.status==='Paid'?'Paid':'Sent';inv.communicationStatus=x.channel?`Sent by ${x.channel}`:'Sent';inv.sentAt=new Date().toISOString();activity(db,`${inv.id} marked sent · ${inv.customer} · ${inv.preferredContact||'preferred contact'}`,'invoice');await storage.write(db);return json(res,200,{ok:true,invoice:inv});}
  if(req.method==='POST'&&/^\/api\/invoices\/[^/]+\/payment$/.test(p)){const inv=db.invoices.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,inv,'Invoice'))return;const x=await body(req);const amt=Math.max(0,Number(x.amount||0));inv.paid=Math.min(inv.amount,Number(inv.paid||0)+amt);inv.status=inv.paid>=inv.amount?'Paid':'Partial';inv.paymentMethod=x.method||inv.paymentMethod||'Recorded payment';const c=customerFor(db,inv.customerId);if(c)c.balance=Math.max(0,Number(c.balance||0)-amt);recalc(db);activity(db,`${inv.id} payment recorded · $${amt.toFixed(2)}`,'payment');await storage.write(db);return json(res,200,{ok:true,invoice:inv});}

  if(req.method==='POST'&&p==='/api/services'){const x=await body(req);const s={id:uid('svc'),name:x.name||'New service',description:x.description||'',price:Number(x.price||0),unit:x.unit||'per service',active:x.active!==false};db.services.push(s);activity(db,`Service created · ${s.name}`,'service');await storage.write(db);return json(res,201,{ok:true,service:s});}
  if(req.method==='PUT'&&/^\/api\/services\/[^/]+$/.test(p)){const s=db.services.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,s,'Service'))return;const x=await body(req);Object.assign(s,x,{price:Number(x.price??s.price)});activity(db,`Service updated · ${s.name}`,'service');await storage.write(db);return json(res,200,{ok:true,service:s});}

  if(req.method==='POST'&&p==='/api/team'){const x=await body(req);const member={id:uid('team'),name:x.name||'New team member',role:x.role||'Crew Member',phone:x.phone||'',email:x.email||'',status:x.status||'Active',rate:Number(x.rate||0),skills:x.skills||'',emergencyContact:x.emergencyContact||'',emergencyPhone:x.emergencyPhone||'',employmentType:x.employmentType||'Employee',assignedEquipment:x.assignedEquipment||''};db.team.push(member);activity(db,`Team member added · ${member.name}`,'team');await storage.write(db);return json(res,201,{ok:true,member});}
  if(req.method==='PUT'&&/^\/api\/team\/[^/]+$/.test(p)){const member=db.team.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,member,'Team member'))return;const x=await body(req);Object.assign(member,x,{rate:Number(x.rate??member.rate)});activity(db,`Team member updated · ${member.name}`,'team');await storage.write(db);return json(res,200,{ok:true,member});}

  if(req.method==='POST'&&p==='/api/communications/templates'){const x=await body(req);const tpl={id:uid('tpl'),name:x.name||'Template',channel:x.channel||'Both',subject:x.subject||'',body:x.body||''};db.communications??={templates:[],log:[]};db.communications.templates.push(tpl);activity(db,`Communication template saved · ${tpl.name}`,'communication');await storage.write(db);return json(res,201,{ok:true,template:tpl});}
  if(req.method==='POST'&&p==='/api/communications/log'){const x=await body(req);const item={id:uid('comm'),created:today(),audience:x.audience||'',channel:x.channel||'Email',subject:x.subject||'',body:x.body||'',count:Number(x.count||0)};db.communications.log.unshift(item);activity(db,`Communication prepared · ${item.channel} · ${item.count} recipient(s)`,'communication');await storage.write(db);return json(res,201,{ok:true,item});}

  if(req.method==='POST'&&p==='/api/customer-requests'){const x=await body(req);const r={id:uid('req'),customerId:x.customerId||'',type:x.type||'Service request',message:x.message||'',status:'Open',created:today()};db.customerRequests.unshift(r);activity(db,`Customer portal request received · ${r.type}`,'customer');await storage.write(db);return json(res,201,{ok:true,request:r});}
  if(req.method==='PUT'&&/^\/api\/customer-requests\/[^/]+$/.test(p)){const r=db.customerRequests.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,r,'Request'))return;Object.assign(r,await body(req));activity(db,`Customer request updated · ${r.status}`,'customer');await storage.write(db);return json(res,200,{ok:true,request:r});}


  if(req.method==='POST'&&p==='/api/attachments'){
    const x=await body(req);const dataUrl=String(x.dataUrl||'');
    if(!dataUrl.startsWith('data:image/'))return json(res,400,{error:'Only image attachments are supported in this local prototype'});
    if(dataUrl.length>7_000_000)return json(res,413,{error:'Image attachment is too large; use an image under about 5 MB'});
    db.attachments??=[];const a={id:uid('att'),jobId:x.jobId||'',customerId:x.customerId||'',propertyId:x.propertyId||'',category:x.category||'Property',name:x.name||'Photo',caption:x.caption||'',dataUrl,created:today()};
    db.attachments.unshift(a);activity(db,`Photo attached · ${a.name}`,'photo');await storage.write(db);return json(res,201,{ok:true,attachment:a});
  }
  if(req.method==='DELETE'&&/^\/api\/attachments\/[^/]+$/.test(p)){
    db.attachments??=[];const id=decodeURIComponent(p.split('/')[3]);const before=db.attachments.length;db.attachments=db.attachments.filter(x=>x.id!==id);if(db.attachments.length===before)return json(res,404,{error:'Attachment not found'});activity(db,'Photo attachment removed','photo');await storage.write(db);return json(res,200,{ok:true});
  }

  if(req.method==='POST'&&p==='/api/payroll'){const x=await body(req);db.payroll??=[];const member=(db.team||[]).find(t=>t.id===x.teamId);const hours=Math.max(0,Number(x.hours||0)),rate=Number(x.rate??member?.rate??0),amount=Number(x.amount||hours*rate);const item={id:uid('pay'),date:x.date||today(),teamId:x.teamId||'',employee:x.employee||member?.name||'',hours,rate,amount,notes:x.notes||''};db.payroll.unshift(item);activity(db,`Payroll recorded · ${item.employee} · $${item.amount.toFixed(2)}`,'employee');await storage.write(db);return json(res,201,{ok:true,payroll:item});}
  if(req.method==='POST'&&p==='/api/expenses'){const x=await body(req);const e={id:uid('exp'),date:x.date||today(),category:x.category||'Other',vendor:x.vendor||'',amount:Number(x.amount||0),notes:x.notes||''};db.expenses.unshift(e);activity(db,`Expense recorded · ${e.category} · $${e.amount.toFixed(2)}`,'expense');await storage.write(db);return json(res,201,{ok:true,expense:e});}
  if(req.method==='POST'&&p==='/api/inventory'){const x=await body(req);const item={id:uid('invitem'),name:x.name||'Item',category:x.category||'Consumable',qty:Number(x.qty||0),reorderAt:Number(x.reorderAt||0),unit:x.unit||'units'};db.inventory.push(item);activity(db,`Inventory item added · ${item.name}`,'inventory');await storage.write(db);return json(res,201,{ok:true,item});}
  if(req.method==='PUT'&&/^\/api\/inventory\/[^/]+$/.test(p)){const item=db.inventory.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,item,'Inventory item'))return;const x=await body(req);Object.assign(item,x,{qty:Number(x.qty??item.qty),reorderAt:Number(x.reorderAt??item.reorderAt)});activity(db,`Inventory updated · ${item.name}`,'inventory');await storage.write(db);return json(res,200,{ok:true,item});}
  if(req.method==='POST'&&p==='/api/maintenance'){const x=await body(req);const m={id:uid('maint'),equipment:x.equipment||'Equipment',model:x.model||'',serial:x.serial||'',currentReading:x.currentReading||'',type:x.type||'Maintenance',due:x.due||today(),completedDate:x.completedDate||'',vendor:x.vendor||'',cost:Number(x.cost||0),status:x.status||'Upcoming',notes:x.notes||''};db.maintenance.push(m);activity(db,`Maintenance added · ${m.equipment}`,'maintenance');await storage.write(db);return json(res,201,{ok:true,maintenance:m});}
  if(req.method==='PUT'&&/^\/api\/maintenance\/[^/]+$/.test(p)){const m=db.maintenance.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,m,'Maintenance'))return;const x=await body(req);Object.assign(m,x,{cost:Number(x.cost??m.cost??0)});if(m.status==='Completed'&&!m.completedDate)m.completedDate=today();activity(db,`Maintenance updated · ${m.equipment} · ${m.status}`,'maintenance');await storage.write(db);return json(res,200,{ok:true,maintenance:m});}

  return json(res,404,{error:'API endpoint not found'});
}

async function serve(req,res,url){let rel=url.pathname;if(rel==='/'||rel==='/app')rel='/app/index.html';if(rel==='/website'||rel==='/website/')rel='/website/index.html';const target=path.normalize(path.join(root,rel));if(!target.startsWith(root))return json(res,403,{error:'Forbidden'});try{const s=await stat(target);if(!s.isFile())throw new Error('not file');res.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});createReadStream(target).pipe(res)}catch{res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found')}}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host}`);if(url.pathname.startsWith('/api/'))return await api(req,res,url);return await serve(req,res,url)}catch(err){console.error(err);return json(res,500,{error:'Internal server error',detail:err.message})}});
server.listen(PORT,()=>console.log(`Business in a Box v0.8.0 · Paradise Lawn Care Tenant #1: http://localhost:${PORT}`));
