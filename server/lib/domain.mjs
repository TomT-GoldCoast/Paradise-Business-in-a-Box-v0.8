import crypto from 'node:crypto';

export const today=()=>new Date().toISOString().slice(0,10);
export const uid=prefix=>`${prefix}_${crypto.randomUUID().slice(0,8)}`;
export const nowLabel=()=>new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
export function activity(db,text,type='system'){ db.activity??=[];db.activity.unshift({time:nowLabel(),text,type});db.activity=db.activity.slice(0,500); }

export const quoteTransitions={
  Draft:['Sent','Accepted','Declined'],
  Sent:['Viewed','Accepted','Declined','Expired'],
  Viewed:['Accepted','Declined','Expired'],
  Accepted:[],
  Converted:[],
  Declined:[],
  Expired:[]
};
export function canTransitionQuote(from,to){return (quoteTransitions[from]||[]).includes(to)}

export function permissions(role){
  const map={
    owner:['dashboard','fullworkspace','alerts','leads','customers','quotes','schedule','routes','jobs','billing','documents','photos','communications','team','operations','weather','history','reports','backup','settings'],
    office:['dashboard','fullworkspace','alerts','leads','customers','quotes','schedule','routes','jobs','billing','documents','photos','communications','operations','weather','history'],
    crew:['today','jobs','navigation','photos'],
    customer:['portal','services','billing','messages']
  };
  return map[role]||map.owner;
}
export function nextAccountNumber(db){
  db.counters??={};db.counters.account=Number(db.counters.account||1);
  const prefix=(db.tenant?.accountPrefix||'BIB').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)||'BIB';
  return `${prefix}-${String(db.counters.account++).padStart(6,'0')}`;
}
export function nextPropertyId(db){db.counters.property=Number(db.counters.property||1);return `prop_${String(db.counters.property++).padStart(4,'0')}`}
export function recalc(db){
  db.metrics??={};
  db.metrics.activeCustomers=(db.customers||[]).filter(x=>x.status==='Active').length;
  db.metrics.monthlyRevenue=(db.customers||[]).filter(x=>x.status==='Active').reduce((s,x)=>s+Number(x.monthlyValue||0),0);
  db.metrics.openReceivables=(db.invoices||[]).filter(x=>x.status!=='Paid'&&x.status!=='Void').reduce((s,x)=>s+Math.max(0,Number(x.amount||0)-Number(x.paid||0)),0);
  db.metrics.jobsToday=(db.jobs||[]).filter(x=>x.date===today()).length;
}
const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const digits=s=>String(s||'').replace(/\D/g,'');
export function duplicateMatches(db,input,excludeId=''){
  const email=norm(input.email),phone=digits(input.phone),address=norm(input.property||input.address),name=norm(input.name);
  return (db.customers||[]).filter(c=>c.id!==excludeId).filter(c=>{
    if(email&&norm(c.email)===email)return true;
    if(phone&&digits(c.phone)===phone)return true;
    const props=c.properties?.map(p=>norm(p.address))||[norm(c.property)];
    if(address&&props.includes(address))return true;
    return name&&norm(c.name)===name;
  }).map(c=>({id:c.id,accountNumber:c.accountNumber,name:c.name,email:c.email,phone:c.phone,property:c.property}));
}
export function customerFor(db,id){return (db.customers||[]).find(x=>x.id===id)}
export function syncCustomerDenormalized(db,c){
  const primary=c.properties?.find(p=>p.id===c.primaryPropertyId)||c.properties?.[0];
  if(primary){c.property=primary.address;c.notes=primary.serviceNotes||c.notes||'';}
  for(const collection of [db.quotes||[],db.jobs||[],db.invoices||[]]){
    for(const r of collection.filter(x=>x.customerId===c.id)){r.customer=c.name;r.accountNumber=c.accountNumber;}
  }
}
export function publicConfig(db){
  return {tenant:db.tenant,services:(db.services||[]).filter(x=>x.active!==false).map(({id,name,description,unit,active})=>({id,name,description,unit,active}))};
}
