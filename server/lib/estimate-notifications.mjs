const env=name=>String(process.env[name]||'').trim();
const safe=v=>String(v||'').trim();
export function notificationConfig(tenant={}){
  const n=tenant.estimateNotifications||{};
  return {email:safe(n.email||tenant.email)};
}
export function providerStatus(){return {emailConfigured:!!(env('SENDGRID_API_KEY')&&env('ESTIMATE_FROM_EMAIL'))};}
function appUrl(){return env('APP_BASE_URL')||'https://paradiselawncaretreasurecoast.com/app';}
function summary(lead,tenant){return `New ${tenant.shortName||tenant.name||'company'} estimate request: ${lead.name}, ${lead.address||'address not supplied'} - ${lead.service}. Phone: ${lead.phone||'not supplied'}. Open ${appUrl()} to review the complete request and photos.`;}
async function sendEmail(lead,tenant,to){
  if(!providerStatus().emailConfigured)throw new Error('Email provider is not configured');
  const text=[summary(lead,tenant),'',`Email: ${lead.email||'Not supplied'}`,`Notes: ${lead.notes||'None'}`,`Photos: ${(lead.photos||[]).length} attached to the saved estimate record.`].join('\n');
  const r=await fetch('https://api.sendgrid.com/v3/mail/send',{method:'POST',headers:{authorization:`Bearer ${env('SENDGRID_API_KEY')}`,'content-type':'application/json'},body:JSON.stringify({personalizations:[{to:[{email:to}]}],from:{email:env('ESTIMATE_FROM_EMAIL'),name:tenant.shortName||tenant.name||'Estimate Notifications'},subject:`New estimate request - ${lead.name}`,content:[{type:'text/plain',value:text}]})});
  if(!r.ok)throw new Error(`Email provider returned ${r.status}`);return true;
}
export async function notifyEstimate(lead,tenant={}){
  const cfg=notificationConfig(tenant);
  const status={attemptedAt:new Date().toISOString(),email:'Pending'};
  try{await sendEmail(lead,tenant,cfg.email);status.email='Sent'}catch(e){status.email='Failed';status.emailError=e.message}
  return status;
}
