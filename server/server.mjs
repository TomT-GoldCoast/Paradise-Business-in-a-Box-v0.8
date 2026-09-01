import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStorage } from './lib/storage.mjs';
import { clearSessionCookie, hashPassword, makeSession, newToken, normalizeUsername, publicUser, readSessionCookie, sessionCookie, sessionSecret, tokenHash, verifyPassword } from './lib/auth.mjs';
import { BackupManager } from './lib/backup-manager.mjs';
import { activity, canTransitionQuote, customerFor, duplicateMatches, nextAccountNumber, nextPropertyId, permissions, publicConfig, recalc, syncCustomerDenormalized, today, uid } from './lib/domain.mjs';
import { authorizationUrl, companyInfo, decryptSecret, encryptSecret, exchangeCode, publicQuickBooks, qbServerConfig, revokeToken, syncCustomersAndInvoices } from './lib/quickbooks.mjs';
import { notificationConfig, notifyEstimate, providerStatus } from './lib/estimate-notifications.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const dataFile=path.join(__dirname,'data','production.json');
const productionSeedFile=path.join(__dirname,'data','production-seed.json');
const trainingDataFile=path.join(__dirname,'data','training.json');
const trainingSeedFile=path.join(__dirname,'data','training-seed.json');
const productionStorage=createStorage(dataFile);
const trainingStorage=createStorage(trainingDataFile);
const authSecret=sessionSecret();
const backupManager=new BackupManager({archiveDir:process.env.BACKUP_ARCHIVE_DIR||path.join(__dirname,'backups'),version:'0.8.9'});
const PORT=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const json=(res,status,payload)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(payload));};
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return{}}}
const roleFrom=url=>url.searchParams.get('role')||'owner';
function bootstrap(db,user,requestedCustomer='',trainingMode=false){
  recalc(db);const role=user?.role||'owner';let customer=null,jobs=[],customers=[],invoices=[],team=[],activityRows=[],communications={templates:[],log:[]},customerRequests=[],expenses=[],inventory=[],maintenance=[],payroll=[],attachments=[],leads=[],quotes=[];
  if(role==='owner'){
    customers=db.customers||[];jobs=db.jobs||[];invoices=db.invoices||[];team=db.team||[];activityRows=db.activity||[];communications=db.communications||{templates:[],log:[]};customerRequests=db.customerRequests||[];expenses=db.expenses||[];inventory=db.inventory||[];maintenance=db.maintenance||[];payroll=db.payroll||[];attachments=db.attachments||[];leads=db.leads||[];quotes=db.quotes||[];
  }else if(role==='office'){
    customers=db.customers||[];jobs=db.jobs||[];invoices=db.invoices||[];team=(db.team||[]).map(({rate,emergencyContact,emergencyPhone,...x})=>x);activityRows=db.activity||[];communications=db.communications||{templates:[],log:[]};customerRequests=db.customerRequests||[];expenses=db.expenses||[];inventory=db.inventory||[];maintenance=db.maintenance||[];attachments=db.attachments||[];leads=db.leads||[];quotes=db.quotes||[];
  }else if(role==='crew'){
    const member=(db.team||[]).find(t=>t.id===user.teamId)||null;const assigned=(db.jobs||[]).filter(j=>assignedToUser(j,user,member));jobs=assigned;const ids=new Set(assigned.map(j=>j.customerId));customers=(db.customers||[]).filter(c=>ids.has(c.id)).map(c=>({id:c.id,accountNumber:c.accountNumber,name:c.name,phone:c.phone,preferredContact:c.preferredContact,property:c.property,properties:c.properties,primaryPropertyId:c.primaryPropertyId,plan:c.plan,nextService:c.nextService,lastService:c.lastService,notes:c.notes,customerType:c.customerType,propertyUse:c.propertyUse,lotType:c.lotType,serviceFrequency:c.serviceFrequency}));team=member?[{id:member.id,name:member.name,role:member.role,status:member.status,phone:member.phone,email:member.email,skills:member.skills,assignedEquipment:member.assignedEquipment}]:[];const jobIds=new Set(assigned.map(j=>j.id));attachments=(db.attachments||[]).filter(a=>jobIds.has(a.jobId));
  }else if(role==='customer'){
    customer=customerFor(db,user.customerId||requestedCustomer);if(customer){customers=[customer];invoices=(db.invoices||[]).filter(i=>i.customerId===customer.id);customerRequests=(db.customerRequests||[]).filter(r=>r.customerId===customer.id);jobs=(db.jobs||[]).filter(j=>j.customerId===customer.id).map(({crew,completionNote,...j})=>j);}
  }
  if(!customer&&role!=='customer')customer=(requestedCustomer&&customerFor(db,requestedCustomer))||customers[0]||null;
  const billingQueue=(role==='owner'||role==='office')?billingGroups(db):[];
  return {tenant:db.tenant,user:publicUser(user),trainingMode,users:role==='owner'?(db.users||[]).map(publicUser):[],permissions:permissions(role),metrics:role==='owner'||role==='office'?db.metrics:{},leads,quotes,jobs,invoices,customers,team,services:db.services||[],customer,activity:activityRows,communications,customerRequests,expenses,inventory,maintenance,payroll,attachments,billingQueue,billingSummary:{ready:billingQueue.filter(g=>g.period.ready).length,pending:billingQueue.filter(g=>!g.period.ready).length,unbilledTotal:billingQueue.reduce((sum,g)=>sum+g.total,0)}};
}
function trainingCookie(enabled){return `bib_training=${enabled?'1':'0'}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${process.env.NODE_ENV==='production'?'; Secure':''}`}
function wantsTraining(req){return String(req.headers.cookie||'').split(';').map(x=>x.trim()).includes('bib_training=1')}
function authUser(req,db,url){
  if(process.env.BIB_TEST_AUTH_BYPASS==='1'){const role=url.searchParams.get('role')||'owner';return db.users.find(u=>u.role===role)||db.users[0]}
  const session=readSessionCookie(req,authSecret);return session?(db.users||[]).find(u=>u.id===session.uid&&u.status!=='Disabled'):null;
}
function loginRequired(res){json(res,401,{error:'Sign in required',code:'AUTH_REQUIRED'});return false}
function forbidden(res){json(res,403,{error:'You do not have permission for this action',code:'FORBIDDEN'});return false}
function apiAllowed(user,req,p){
  if(!user)return false;if(user.role==='owner')return true;
  if(p==='/api/bootstrap'||p==='/api/auth/logout'||p==='/api/auth/me'||p==='/api/training/mode')return true;
  if(user.role==='office')return ['/api/customers','/api/leads','/api/quotes','/api/jobs','/api/invoices','/api/billing','/api/services','/api/communications','/api/customer-requests','/api/attachments','/api/inventory','/api/maintenance','/api/expenses'].some(x=>p.startsWith(x))||(req.method==='GET'&&p==='/api/tenant');
  if(user.role==='crew')return (req.method==='POST'&&/^\/api\/jobs\/[^/]+\/status$/.test(p))||(req.method==='POST'&&p==='/api/attachments');
  if(user.role==='customer')return req.method==='POST'&&p==='/api/customer-requests';
  return false;
}
function assignedToUser(job,user,member){if(!job)return false;if(job.crewId&&member?.id&&job.crewId===member.id)return true;const label=String(job.crew||'').toLowerCase(),names=[member?.name,user?.name].filter(Boolean);return names.some(n=>{const full=String(n).toLowerCase();const first=full.split(/\s+/)[0];return label===full||new RegExp(`(^|[^a-z])${first.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^a-z]|$)`).test(label)})}
function crewOwnsJob(db,user,job){const member=(db.team||[]).find(t=>t.id===user.teamId);return assignedToUser(job,user,member)}
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
  const anchorDay=Math.max(1,Math.min(28,Number(String(anchor).slice(8,10)||1))),jobDate=new Date(`${date}T12:00:00`);let y=jobDate.getFullYear(),m=jobDate.getMonth();if(jobDate.getDate()>anchorDay){m+=1;if(m>11){m=0;y+=1}}const readyDate=`${y}-${String(m+1).padStart(2,'0')}-${String(anchorDay).padStart(2,'0')}`;const prior=new Date(`${readyDate}T12:00:00`);prior.setMonth(prior.getMonth()-1);const start=addDays(prior.toISOString().slice(0,10),1);return {key:`monthly:${readyDate}`,label:`${start} to ${readyDate}`,ready:asOf>=readyDate,readyDate};
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
  let storage=productionStorage;let db=await productionStorage.read();const p=url.pathname;if(process.env.BIB_TEST_AUTH_BYPASS==='1'&&process.env.BIB_TEST_PRODUCTION!=='1'){storage=trainingStorage;db=await trainingStorage.read();}
  if(req.method==='GET'&&p==='/api/health')return json(res,200,{ok:true,version:'0.8.9',storage:'json-storage-adapter',architecture:'authenticated-api-first-multi-role'});
  if(req.method==='GET'&&p==='/api/auth/status')return json(res,200,{initialized:(db.users||[]).some(u=>u.role==='owner'&&u.passwordHash),tenant:db.tenant?.shortName||db.tenant?.name});
  if(req.method==='POST'&&p==='/api/auth/setup-owner'){
    if((db.users||[]).some(u=>u.role==='owner'&&u.passwordHash))return json(res,409,{error:'Owner account is already initialized'});const x=await body(req);if(String(x.password||'').length<10)return json(res,400,{error:'Use a password of at least 10 characters'});let owner=(db.users||[]).find(u=>u.role==='owner');if(!owner){owner={id:uid('user'),name:x.name||'Owner',role:'owner',title:'Owner / Administrator'};db.users.push(owner)}owner.username=normalizeUsername(x.username||x.email);owner.email=x.email||owner.email||'';owner.passwordHash=hashPassword(x.password);owner.status='Active';owner.passwordChangedAt=new Date().toISOString();activity(db,`Owner account initialized · ${owner.name}`,'security');await storage.write(db);const token=makeSession(owner,authSecret);res.setHeader('set-cookie',sessionCookie(token));return json(res,201,{ok:true,user:publicUser(owner)});
  }
  if(req.method==='POST'&&p==='/api/auth/login'){
    const x=await body(req),username=normalizeUsername(x.username);const user=(db.users||[]).find(u=>normalizeUsername(u.username||u.email)===username&&u.status!=='Disabled');if(!user||!user.passwordHash||!verifyPassword(x.password,user.passwordHash))return json(res,401,{error:'Incorrect username or password'});user.lastLoginAt=new Date().toISOString();activity(db,`Signed in · ${user.name}`,'security');await storage.write(db);res.setHeader('set-cookie',sessionCookie(makeSession(user,authSecret)));return json(res,200,{ok:true,user:publicUser(user),redirect:user.role==='customer'?'/app':user.role==='crew'?'/app':'/app'});
  }
  if(req.method==='POST'&&p==='/api/auth/activate'){
    const x=await body(req),h=tokenHash(x.token||''),user=(db.users||[]).find(u=>u.inviteTokenHash===h&&u.inviteExpiresAt&&u.inviteExpiresAt>new Date().toISOString());if(!user)return json(res,400,{error:'Invitation is invalid or expired'});if(String(x.password||'').length<10)return json(res,400,{error:'Use a password of at least 10 characters'});user.passwordHash=hashPassword(x.password);user.username=normalizeUsername(x.username||user.username||user.email);delete user.inviteTokenHash;delete user.inviteExpiresAt;user.status='Active';user.passwordChangedAt=new Date().toISOString();activity(db,`Account activated · ${user.name}`,'security');await storage.write(db);return json(res,200,{ok:true});
  }
  if(req.method==='GET'&&p==='/api/integrations/quickbooks/callback'){
    const q=db.integrations?.quickbooks||{},state=String(url.searchParams.get('state')||''),code=String(url.searchParams.get('code')||''),realmId=String(url.searchParams.get('realmId')||'');
    if(!state||tokenHash(state)!==q.oauthStateHash||!q.oauthStateExpiresAt||q.oauthStateExpiresAt<new Date().toISOString())return json(res,400,{error:'QuickBooks authorization state is invalid or expired'});
    if(!code||!realmId)return json(res,400,{error:url.searchParams.get('error')||'QuickBooks did not return an authorization code'});
    const tokens=await exchangeCode(code);q.accessTokenEnc=encryptSecret(tokens.access_token);q.refreshTokenEnc=encryptSecret(tokens.refresh_token);q.accessTokenExpiresAt=Date.now()+Number(tokens.expires_in||3600)*1000;q.refreshTokenExpiresAt=Date.now()+Number(tokens.x_refresh_token_expires_in||8726400)*1000;q.realmId=realmId;q.connected=true;delete q.oauthStateHash;delete q.oauthStateExpiresAt;db.integrations??={};db.integrations.quickbooks=q;
    try{const info=await companyInfo(q);q.companyName=info.CompanyInfo?.CompanyName||info.CompanyInfo?.LegalName||''}catch{}
    activity(db,`QuickBooks Online connected${q.companyName?` · ${q.companyName}`:''}`,'integration');await productionStorage.write(db);res.writeHead(302,{location:'/app?integration=quickbooks-connected'});return res.end();
  }
  if(req.method==='POST'&&p==='/api/public/leads'){const x=await body(req),photos=Array.isArray(x.photos)?x.photos.slice(0,8):[];if(photos.some(ph=>!String(ph.dataUrl||'').startsWith('data:image/')))return json(res,400,{error:'Only image estimate attachments are supported'});if(photos.some(ph=>String(ph.dataUrl||'').length>3_500_000))return json(res,413,{error:'One or more estimate photos are too large'});const lead={id:uid('lead'),name:x.name||'Website visitor',service:x.service||'Service request',address:x.address||'',phone:x.phone||'',email:x.email||'',source:x.source||'Website',status:'New',created:'Just now',notes:x.notes||'',photos:photos.map(ph=>({yard:ph.yard||'Property',label:ph.label||'Estimate photo',name:ph.name||'Photo',dataUrl:ph.dataUrl})),notificationStatus:{email:'Pending'}};db.leads.unshift(lead);activity(db,`Website lead received from ${lead.name}${lead.photos.length?` · ${lead.photos.length} photos`:''}`,'lead');await storage.write(db);lead.notificationStatus=await notifyEstimate(lead,db.tenant);activity(db,`Estimate notification · email ${lead.notificationStatus.email}`,'communication');await storage.write(db);return json(res,201,{ok:true,lead:{...lead,photos:lead.photos.map(({dataUrl,...ph})=>ph)}});}
  if(req.method==='GET'&&p==='/api/public/config')return json(res,200,publicConfig(db));
  if(req.method==='GET'&&p==='/api/backup/device/latest'){
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const h=tokenHash(token),valid=(db.backupConfig?.deviceTokens||[]).some(t=>t.tokenHash===h&&t.active!==false);if(!valid)return json(res,401,{error:'Invalid backup device key'});await backupManager.snapshotIfDue(db);const latest=await backupManager.latest();if(!latest){await backupManager.snapshot(db,'device-request');return api(req,res,url)}res.writeHead(200,{'content-type':'application/json','content-disposition':`attachment; filename="${latest.meta.name}"`,'cache-control':'no-store'});return res.end(latest.content);
  }
  const user=authUser(req,db,url);if(!user)return loginRequired(res);
  if(req.method==='POST'&&p==='/api/auth/logout'){res.setHeader('set-cookie',clearSessionCookie());return json(res,200,{ok:true});}
  if(req.method==='POST'&&p==='/api/training/mode'){if(!['owner','office'].includes(user.role))return forbidden(res);const x=await body(req),enabled=Boolean(x.enabled);res.setHeader('set-cookie',trainingCookie(enabled));return json(res,200,{ok:true,trainingMode:enabled});}
  const trainingMode=(wantsTraining(req)||(process.env.BIB_TEST_AUTH_BYPASS==='1'&&process.env.BIB_TEST_PRODUCTION!=='1'))&&['owner','office'].includes(user.role);
  if(trainingMode){storage=trainingStorage;db=await trainingStorage.read();}
  if(req.method==='GET'&&p==='/api/auth/me')return json(res,200,{user:publicUser(user),trainingMode});
  if(!apiAllowed(user,req,p))return forbidden(res);
  if(req.method==='GET'&&p==='/api/bootstrap'){const created=(user.role==='owner'||user.role==='office')?processBilling(db):[];if(created.length)await storage.write(db);return json(res,200,bootstrap(db,user,process.env.BIB_TEST_AUTH_BYPASS==='1'?url.searchParams.get('customer'):'',trainingMode));}
  if(req.method==='GET'&&p==='/api/public/config')return json(res,200,publicConfig(db));
  if(req.method==='GET'&&p==='/api/users')return json(res,200,{users:(db.users||[]).map(publicUser)});
  if(req.method==='POST'&&p==='/api/users'){
    const x=await body(req);if(!['owner','office','crew','customer'].includes(x.role))return json(res,400,{error:'Invalid user role'});const username=normalizeUsername(x.username||x.email);if(username&&(db.users||[]).some(u=>normalizeUsername(u.username||u.email)===username))return json(res,409,{error:'Username/email is already in use'});const u={id:uid('user'),name:x.name||'New User',email:x.email||'',username,role:x.role,title:x.title||x.role,status:'Pending',teamId:x.teamId||'',customerId:x.customerId||''};db.users.push(u);activity(db,`User account created · ${u.name} · ${u.role}`,'security');await storage.write(db);return json(res,201,{ok:true,user:publicUser(u)});
  }
  if(req.method==='PUT'&&/^\/api\/users\/[^/]+$/.test(p)){
    const u=(db.users||[]).find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,u,'User'))return;const x=await body(req);for(const k of ['name','email','username','role','title','status','teamId','customerId'])if(x[k]!==undefined)u[k]=k==='username'?normalizeUsername(x[k]):x[k];if(x.password){if(String(x.password).length<10)return json(res,400,{error:'Use a password of at least 10 characters'});u.passwordHash=hashPassword(x.password);u.passwordChangedAt=new Date().toISOString();u.status='Active'}activity(db,`User account updated · ${u.name}`,'security');await storage.write(db);return json(res,200,{ok:true,user:publicUser(u)});
  }
  if(req.method==='POST'&&/^\/api\/users\/[^/]+\/invite$/.test(p)){
    const u=(db.users||[]).find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,u,'User'))return;const token=newToken();u.inviteTokenHash=tokenHash(token);u.inviteExpiresAt=new Date(Date.now()+72*3600000).toISOString();u.status='Pending';activity(db,`Account invitation created · ${u.name}`,'security');await storage.write(db);return json(res,200,{ok:true,activationPath:`/login?activate=${encodeURIComponent(token)}`,expiresAt:u.inviteExpiresAt});
  }
  if(trainingMode&&p.startsWith('/api/backup/'))return json(res,409,{error:'Production backups are unavailable in Training Mode'});
  if(req.method==='POST'&&p==='/api/backup/device-key'){
    const token=newToken();db.backupConfig??={};db.backupConfig.deviceTokens??=[];db.backupConfig.deviceTokens.push({id:uid('bkey'),name:(await body(req)).name||'Windows backup computer',tokenHash:tokenHash(token),createdAt:new Date().toISOString(),active:true});activity(db,'Backup Device Key created','backup');await storage.write(db);return json(res,201,{ok:true,token});
  }
  if(req.method==='GET'&&p==='/api/backup/status'){await backupManager.snapshotIfDue(db);return json(res,200,{retention:{daily:30,weekly:12,monthly:12},archiveDirConfigured:!!process.env.BACKUP_ARCHIVE_DIR,archives:await backupManager.list(),deviceKeys:(db.backupConfig?.deviceTokens||[]).map(({tokenHash,...x})=>x)});}
  if(req.method==='POST'&&p==='/api/backup/snapshot'){const file=await backupManager.snapshot(db,'manual');activity(db,'Hosted backup snapshot created','backup');await storage.write(db);return json(res,201,{ok:true,file:path.basename(file)});}
  if(req.method==='GET'&&p==='/api/tenant')return json(res,200,{tenant:db.tenant});
  if(req.method==='GET'&&p==='/api/estimate-notifications/status')return json(res,200,{settings:notificationConfig(db.tenant),providers:providerStatus()});
  if(req.method==='PUT'&&p==='/api/tenant'){
    const x=await body(req);db.tenant={...db.tenant,...x,brand:{...(db.tenant.brand||{}),...(x.brand||{})},websiteHero:{...(db.tenant.websiteHero||{}),...(x.websiteHero||{})},workflow:{...(db.tenant.workflow||{}),...(x.workflow||{})}};
    activity(db,`Tenant configuration updated · ${db.tenant.shortName||db.tenant.name}`,'settings');await storage.write(db);return json(res,200,{ok:true,tenant:db.tenant});
  }
  if(req.method==='POST'&&p==='/api/demo/reset'){if(!trainingMode)return json(res,409,{error:'Training data can only be reset while Training Mode is on'});await trainingStorage.reset(trainingSeedFile);return json(res,200,{ok:true,trainingMode:true});}
  if(req.method==='GET'&&p==='/api/integrations/quickbooks/status'){if(trainingMode)return json(res,200,{...publicQuickBooks({integrations:{quickbooks:{}}}),trainingBlocked:true,connected:false});return json(res,200,publicQuickBooks(db));}
  if(req.method==='POST'&&p==='/api/integrations/quickbooks/connect'){if(trainingMode)return json(res,409,{error:'QuickBooks is disabled in Training Mode'});const cfg=qbServerConfig();if(!cfg.configured)return json(res,409,{error:'QuickBooks server credentials are not configured',requirements:publicQuickBooks(db).serverRequirements});const state=newToken();db.integrations??={};db.integrations.quickbooks??={provider:'quickbooks-online',mappings:{defaultItemId:'',expenseAccountId:''}};db.integrations.quickbooks.oauthStateHash=tokenHash(state);db.integrations.quickbooks.oauthStateExpiresAt=new Date(Date.now()+10*60*1000).toISOString();await productionStorage.write(db);return json(res,200,{authorizationUrl:authorizationUrl(state)});}
  if(req.method==='POST'&&p==='/api/integrations/quickbooks/disconnect'){if(trainingMode)return json(res,409,{error:'QuickBooks is disabled in Training Mode'});const q=db.integrations?.quickbooks||{};try{if(q.refreshTokenEnc)await revokeToken(decryptSecret(q.refreshTokenEnc))}catch{}const mappings=q.mappings||{};db.integrations.quickbooks={provider:'quickbooks-online',connected:false,syncEnabled:true,customerSync:true,invoiceSync:true,paymentSync:true,expenseSync:false,mappings};activity(db,'QuickBooks Online disconnected','integration');await productionStorage.write(db);return json(res,200,{ok:true});}
  if(req.method==='PUT'&&p==='/api/integrations/quickbooks/settings'){if(trainingMode)return json(res,409,{error:'QuickBooks is disabled in Training Mode'});const x=await body(req);db.integrations??={};db.integrations.quickbooks??={provider:'quickbooks-online'};db.integrations.quickbooks.mappings={...(db.integrations.quickbooks.mappings||{}),defaultItemId:String(x.defaultItemId||''),expenseAccountId:String(x.expenseAccountId||'')};db.integrations.quickbooks.syncEnabled=x.syncEnabled!==false;await productionStorage.write(db);return json(res,200,{ok:true,status:publicQuickBooks(db)});}
  if(req.method==='POST'&&p==='/api/integrations/quickbooks/sync'){if(trainingMode)return json(res,409,{error:'Training Mode can never sync to QuickBooks'});const summary=await syncCustomersAndInvoices(db);activity(db,`QuickBooks sync completed · ${summary.customersCreated} customer(s), ${summary.invoicesCreated} invoice(s)`,'integration');await productionStorage.write(db);return json(res,200,{ok:true,summary,status:publicQuickBooks(db)});}
  if(req.method==='GET'&&p==='/api/backup/export'){await backupManager.snapshotIfDue(db);return json(res,200,{ok:true,version:'0.8.9',exportedAt:new Date().toISOString(),data:db});}
  if(req.method==='POST'&&p==='/api/backup/restore'){
    const payload=await body(req);const candidate=payload?.data||payload;
    const required=['customers','leads','quotes','jobs','invoices','services','users'];
    if(!candidate||typeof candidate!=='object'||!candidate.tenant||required.some(key=>!Array.isArray(candidate[key])))return json(res,400,{error:'Backup is not a valid Combo Web and App tenant export',code:'INVALID_BACKUP'});
    if(!candidate.tenant.name||!candidate.tenant.brand)return json(res,400,{error:'Backup tenant identity or branding is incomplete',code:'INVALID_BACKUP_TENANT'});
    candidate.activity=Array.isArray(candidate.activity)?candidate.activity:[];activity(candidate,'Backup restored through validated import','backup');await storage.write(candidate);return json(res,200,{ok:true,tenant:candidate.tenant.name});
  }

  if(req.method==='GET'&&p==='/api/customers/duplicates')return json(res,200,{matches:duplicateMatches(db,Object.fromEntries(url.searchParams))});
  if(req.method==='GET'&&p==='/api/customers')return json(res,200,{customers:db.customers});
  if(req.method==='POST'&&p==='/api/customers'){
    const x=await body(req);const matches=duplicateMatches(db,x);if(matches.length&&!x.allowDuplicate)return json(res,409,{error:'Possible duplicate customer',code:'DUPLICATE_CUSTOMER',matches});
    const propertyId=nextPropertyId(db);const c={id:uid('cust'),trainingOnly:trainingMode,accountNumber:nextAccountNumber(db),name:x.name||'New Customer',email:x.email||'',phone:x.phone||'',status:x.status||'Active',preferredContact:x.preferredContact||'Phone',preferredPayment:x.preferredPayment||'Invoice',customerType:x.customerType||'Residential',serviceFrequency:x.serviceFrequency||'Weekly',billingMethod:x.billingMethod||'Per Service',billingAnchor:x.billingAnchor||today(),property:x.property||'',properties:[{id:propertyId,label:'Primary Property',address:x.property||'',propertyUse:x.propertyUse||((x.customerType||'Residential')==='Commercial'?'Commercial':'Residential'),lotType:x.lotType||((x.customerType||'Residential')==='Commercial'?'Commercial Lot':'Regular Lot'),serviceNotes:x.notes||'',active:true}],primaryPropertyId:propertyId,plan:x.plan||db.services?.[0]?.name||'Service plan',monthlyValue:Number(x.monthlyValue||0),nextService:x.nextService||'',balance:Number(x.balance||0),lastService:x.lastService||'',notes:x.notes||''};
    db.customers.unshift(c);syncCustomerDenormalized(db,c);recalc(db);activity(db,`Customer ${c.accountNumber} created · ${c.name}`,'customer');await storage.write(db);return json(res,201,{ok:true,customer:c});
  }
  if(/^\/api\/customers\/[^/]+$/.test(p)){
    const customerId=decodeURIComponent(p.split('/')[3]);const c=customerFor(db,customerId);if(!requireItem(res,c,'Customer'))return;
    if(req.method==='GET')return json(res,200,{customer:c});
    if(req.method==='PUT'){
      const x=await body(req);const matches=duplicateMatches(db,x,customerId);if(matches.length&&!x.allowDuplicate)return json(res,409,{error:'Possible duplicate customer',code:'DUPLICATE_CUSTOMER',matches});
      for(const k of ['name','email','phone','status','preferredContact','preferredPayment','customerType','serviceFrequency','billingMethod','billingAnchor','plan','nextService','lastService','notes','propertyUse','lotType'])if(x[k]!==undefined)c[k]=x[k];
      if(x.monthlyValue!==undefined)c.monthlyValue=Number(x.monthlyValue||0);if(x.balance!==undefined)c.balance=Number(x.balance||0);
      if(x.property!==undefined){const primary=c.properties?.find(y=>y.id===c.primaryPropertyId)||c.properties?.[0];if(primary){primary.address=x.property;if(x.propertyUse!==undefined)primary.propertyUse=x.propertyUse;if(x.lotType!==undefined)primary.lotType=x.lotType;}else{const pid=nextPropertyId(db);c.properties=[{id:pid,label:'Primary Property',address:x.property,propertyUse:x.propertyUse||((c.customerType==='Commercial')?'Commercial':'Residential'),lotType:x.lotType||((c.customerType==='Commercial')?'Commercial Lot':'Regular Lot'),serviceNotes:x.notes||'',active:true}];c.primaryPropertyId=pid;}}
      syncCustomerDenormalized(db,c);recalc(db);activity(db,`Customer ${c.accountNumber} updated · ${c.name}`,'customer');await storage.write(db);return json(res,200,{ok:true,customer:c});
    }
  }
  if(req.method==='POST'&&/^\/api\/customers\/[^/]+\/properties$/.test(p)){
    const customerId=decodeURIComponent(p.split('/')[3]);const c=customerFor(db,customerId);if(!requireItem(res,c,'Customer'))return;const x=await body(req);const property={id:nextPropertyId(db),label:x.label||`Property ${(c.properties?.length||0)+1}`,address:x.address||'',propertyUse:x.propertyUse||((c.customerType==='Commercial')?'Commercial':'Residential'),lotType:x.lotType||((c.customerType==='Commercial')?'Commercial Lot':'Regular Lot'),serviceNotes:x.serviceNotes||'',active:x.active!==false};c.properties??=[];c.properties.push(property);if(!c.primaryPropertyId)c.primaryPropertyId=property.id;syncCustomerDenormalized(db,c);activity(db,`Property added · ${c.accountNumber} · ${property.label}`,'customer');await storage.write(db);return json(res,201,{ok:true,property,customer:c});
  }
  if(req.method==='PUT'&&/^\/api\/customers\/[^/]+\/properties\/[^/]+$/.test(p)){
    const parts=p.split('/');const c=customerFor(db,decodeURIComponent(parts[3]));if(!requireItem(res,c,'Customer'))return;const property=c.properties?.find(x=>x.id===decodeURIComponent(parts[5]));if(!requireItem(res,property,'Property'))return;Object.assign(property,await body(req));syncCustomerDenormalized(db,c);activity(db,`Property updated · ${c.accountNumber} · ${property.label}`,'customer');await storage.write(db);return json(res,200,{ok:true,property,customer:c});
  }

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
    const j=db.jobs.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,j,'Job'))return;if(user.role==='crew'&&!crewOwnsJob(db,user,j))return forbidden(res);const x=await body(req);j.status=x.status||j.status;if(x.completionNote!==undefined)j.completionNote=x.completionNote;
    let invoice=null;if(j.status==='Completed'){const c=customerFor(db,j.customerId);j.completedDate=x.completedDate||today();j.completedAt=new Date().toISOString();if(c)c.lastService=j.completedDate;if(db.tenant.workflow?.autoInvoiceOnCompletion){const created=processBilling(db,j.completedDate);invoice=created.find(i=>(i.jobIds||[]).includes(j.id))||null;}}
    recalc(db);activity(db,`${j.id} · ${j.customer} · ${j.status}`,'job');await storage.write(db);return json(res,200,{ok:true,job:j,invoice});
  }

  if(req.method==='POST'&&p==='/api/invoices'){const x=await body(req);const c=customerFor(db,x.customerId);const amount=Number(x.amount||0);const inv={id:`INV-${String(db.counters.invoice++).padStart(5,'0')}`,customerId:x.customerId||'',accountNumber:c?.accountNumber||'',propertyId:x.propertyId||c?.primaryPropertyId||'',jobId:x.jobId||'',customer:x.customer||c?.name||'',preferredContact:x.preferredContact||c?.preferredContact||'Phone',amount,status:x.status||'Ready to Send',communicationStatus:x.communicationStatus||'Ready to Send',due:x.due||today(),created:today(),paid:0,lines:x.lines||[{description:x.description||'Service',qty:1,rate:amount,amount}]};db.invoices.unshift(inv);if(c&&inv.status!=='Paid')c.balance=Number(c.balance||0)+inv.amount;recalc(db);activity(db,`${inv.id} created · ${inv.customer}`,'invoice');await storage.write(db);return json(res,201,{ok:true,invoice:inv});}
  if(req.method==='GET'&&p==='/api/billing/queue')return json(res,200,{groups:billingGroups(db),summary:{ready:billingGroups(db).filter(g=>g.period.ready).length,pending:billingGroups(db).filter(g=>!g.period.ready).length,total:billingGroups(db).reduce((s,g)=>s+g.total,0)}});
  if(req.method==='POST'&&p==='/api/billing/process'){const x=await body(req);const created=processBilling(db,x.asOf||today());await storage.write(db);return json(res,200,{ok:true,created,groups:billingGroups(db,x.asOf||today())});}
  if(req.method==='POST'&&/^\/api\/invoices\/[^/]+\/send$/.test(p)){const inv=db.invoices.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,inv,'Invoice'))return;const x=await body(req);inv.status=inv.status==='Paid'?'Paid':'Sent';inv.communicationStatus=x.channel?`Sent by ${x.channel}`:'Sent';inv.sentAt=new Date().toISOString();activity(db,`${inv.id} marked sent · ${inv.customer} · ${inv.preferredContact||'preferred contact'}`,'invoice');await storage.write(db);return json(res,200,{ok:true,invoice:inv});}
  if(req.method==='POST'&&/^\/api\/invoices\/[^/]+\/payment$/.test(p)){const inv=db.invoices.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,inv,'Invoice'))return;const x=await body(req);const amt=Math.max(0,Number(x.amount||0)),before=Number(inv.paid||0),remaining=Math.max(0,Number(inv.amount||0)-before),applied=Math.min(amt,remaining);inv.paid=before+applied;inv.status=inv.paid>=inv.amount?'Paid':'Partial';inv.paymentMethod=x.method||inv.paymentMethod||'Recorded payment';const c=customerFor(db,inv.customerId);if(c)c.balance=Math.max(0,Number(c.balance||0)-applied);recalc(db);activity(db,`${inv.id} payment recorded · $${applied.toFixed(2)}${amt>applied?` · $${(amt-applied).toFixed(2)} unapplied`:''}`,'payment');await storage.write(db);return json(res,200,{ok:true,invoice:inv});}

  if(req.method==='POST'&&p==='/api/services'){const x=await body(req);const s={id:uid('svc'),name:x.name||'New service',description:x.description||'',price:Number(x.price||0),unit:x.unit||'per service',active:x.active!==false};db.services.push(s);activity(db,`Service created · ${s.name}`,'service');await storage.write(db);return json(res,201,{ok:true,service:s});}
  if(req.method==='PUT'&&/^\/api\/services\/[^/]+$/.test(p)){const s=db.services.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,s,'Service'))return;const x=await body(req);Object.assign(s,x,{price:Number(x.price??s.price)});activity(db,`Service updated · ${s.name}`,'service');await storage.write(db);return json(res,200,{ok:true,service:s});}

  if(req.method==='POST'&&p==='/api/team'){const x=await body(req);const member={id:uid('team'),name:x.name||'New team member',role:x.role||'Crew Member',phone:x.phone||'',email:x.email||'',status:x.status||'Active',rate:Number(x.rate||0),skills:x.skills||'',emergencyContact:x.emergencyContact||'',emergencyPhone:x.emergencyPhone||'',employmentType:x.employmentType||'Employee',assignedEquipment:x.assignedEquipment||''};db.team.push(member);activity(db,`Team member added · ${member.name}`,'team');await storage.write(db);return json(res,201,{ok:true,member});}
  if(req.method==='PUT'&&/^\/api\/team\/[^/]+$/.test(p)){const member=db.team.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,member,'Team member'))return;const x=await body(req);Object.assign(member,x,{rate:Number(x.rate??member.rate)});activity(db,`Team member updated · ${member.name}`,'team');await storage.write(db);return json(res,200,{ok:true,member});}

  if(req.method==='POST'&&p==='/api/communications/templates'){const x=await body(req);const tpl={id:uid('tpl'),name:x.name||'Template',channel:x.channel||'Both',subject:x.subject||'',body:x.body||''};db.communications??={templates:[],log:[]};db.communications.templates.push(tpl);activity(db,`Communication template saved · ${tpl.name}`,'communication');await storage.write(db);return json(res,201,{ok:true,template:tpl});}
  if(req.method==='POST'&&p==='/api/communications/log'){const x=await body(req);const item={id:uid('comm'),created:today(),audience:x.audience||'',channel:trainingMode?'Training Only':(x.channel||'Email'),subject:x.subject||'',body:x.body||'',count:Number(x.count||0),trainingOnly:trainingMode};db.communications.log.unshift(item);activity(db,`Communication prepared · ${item.channel} · ${item.count} recipient(s)`,'communication');await storage.write(db);return json(res,201,{ok:true,item});}

  if(req.method==='POST'&&p==='/api/customer-requests'){const x=await body(req);if(user.role==='customer')x.customerId=user.customerId;const r={id:uid('req'),customerId:x.customerId||'',type:x.type||'Service request',message:x.message||'',status:'Open',created:today()};db.customerRequests.unshift(r);activity(db,`Customer portal request received · ${r.type}`,'customer');await storage.write(db);return json(res,201,{ok:true,request:r});}
  if(req.method==='PUT'&&/^\/api\/customer-requests\/[^/]+$/.test(p)){const r=db.customerRequests.find(x=>x.id===decodeURIComponent(p.split('/')[3]));if(!requireItem(res,r,'Request'))return;Object.assign(r,await body(req));activity(db,`Customer request updated · ${r.status}`,'customer');await storage.write(db);return json(res,200,{ok:true,request:r});}


  if(req.method==='POST'&&p==='/api/attachments'){
    const x=await body(req);if(user.role==='crew'&&!crewOwnsJob(db,user,(db.jobs||[]).find(j=>j.id===x.jobId)))return forbidden(res);const dataUrl=String(x.dataUrl||'');
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

async function serve(req,res,url){let rel=url.pathname;if(rel==='/'||rel==='/login')rel='/app/login.html';else if(rel==='/app')rel='/app/index.html';if(rel==='/website'||rel==='/website/')rel='/website/index.html';const target=path.normalize(path.join(root,rel));if(!target.startsWith(root))return json(res,403,{error:'Forbidden'});try{const s=await stat(target);if(!s.isFile())throw new Error('not file');res.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});createReadStream(target).pipe(res)}catch{res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found')}}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host}`);if(url.pathname.startsWith('/api/'))return await api(req,res,url);return await serve(req,res,url)}catch(err){console.error(err);return json(res,500,{error:'Internal server error',detail:err.message})}});
server.listen(PORT,async()=>{console.log(`Combo Web and App v0.8.9 · Paradise Lawn Care Tenant #1: http://localhost:${PORT}`);try{await backupManager.snapshotIfDue(await productionStorage.read())}catch(e){console.error('Initial hosted backup failed:',e.message)}setInterval(async()=>{try{await backupManager.snapshotIfDue(await productionStorage.read())}catch(e){console.error('Scheduled hosted backup failed:',e.message)}},6*60*60*1000).unref();});
