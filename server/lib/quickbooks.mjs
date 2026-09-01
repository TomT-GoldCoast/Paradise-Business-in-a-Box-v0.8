import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const AUTH_URL='https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL='https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const REVOKE_URL='https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
const SCOPE='com.intuit.quickbooks.accounting';

function key(){
  const secret=process.env.BIB_INTEGRATION_SECRET||'';
  if(!secret) return null;
  return createHash('sha256').update(secret).digest();
}
export function qbServerConfig(){
  const clientId=process.env.QBO_CLIENT_ID||'';
  const clientSecret=process.env.QBO_CLIENT_SECRET||'';
  const redirectUri=process.env.QBO_REDIRECT_URI||'';
  const environment=(process.env.QBO_ENVIRONMENT||'production').toLowerCase()==='sandbox'?'sandbox':'production';
  return {clientId,clientSecret,redirectUri,environment,configured:Boolean(clientId&&clientSecret&&redirectUri&&key())};
}
export function encryptSecret(value){
  const k=key(); if(!k) throw new Error('BIB_INTEGRATION_SECRET is not configured');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',k,iv);const enc=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}
export function decryptSecret(value=''){
  const k=key(); if(!k) throw new Error('BIB_INTEGRATION_SECRET is not configured');
  const [ivb,tagb,encb]=String(value).split('.');if(!ivb||!tagb||!encb)throw new Error('Stored integration token is invalid');
  const d=createDecipheriv('aes-256-gcm',k,Buffer.from(ivb,'base64url'));d.setAuthTag(Buffer.from(tagb,'base64url'));return Buffer.concat([d.update(Buffer.from(encb,'base64url')),d.final()]).toString('utf8');
}
export function authorizationUrl(state){
  const c=qbServerConfig();if(!c.configured)throw new Error('QuickBooks server credentials are not configured');
  const u=new URL(AUTH_URL);u.searchParams.set('client_id',c.clientId);u.searchParams.set('response_type','code');u.searchParams.set('scope',SCOPE);u.searchParams.set('redirect_uri',c.redirectUri);u.searchParams.set('state',state);return u.toString();
}
async function tokenRequest(params){
  const c=qbServerConfig();const auth=Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64');
  const r=await fetch(TOKEN_URL,{method:'POST',headers:{authorization:`Basic ${auth}`,'content-type':'application/x-www-form-urlencoded','accept':'application/json'},body:new URLSearchParams(params)});
  const text=await r.text();let payload={};try{payload=JSON.parse(text)}catch{payload={raw:text}}if(!r.ok)throw new Error(payload.error_description||payload.error||`QuickBooks token request failed (${r.status})`);return payload;
}
export async function exchangeCode(code){const c=qbServerConfig();return tokenRequest({grant_type:'authorization_code',code,redirect_uri:c.redirectUri});}
export async function refreshTokens(refreshToken){return tokenRequest({grant_type:'refresh_token',refresh_token:refreshToken});}
export async function revokeToken(token){const c=qbServerConfig();if(!token)return;const auth=Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64');await fetch(REVOKE_URL,{method:'POST',headers:{authorization:`Basic ${auth}`,'content-type':'application/json','accept':'application/json'},body:JSON.stringify({token})});}
function apiBase(realmId){const env=qbServerConfig().environment;return `${env==='sandbox'?'https://sandbox-quickbooks.api.intuit.com':'https://quickbooks.api.intuit.com'}/v3/company/${encodeURIComponent(realmId)}`;}
export async function qboRequest(connection,path,{method='GET',body}={}){
  let access=decryptSecret(connection.accessTokenEnc);const expires=Number(connection.accessTokenExpiresAt||0);
  if(expires && Date.now()>expires-120000){
    const fresh=await refreshTokens(decryptSecret(connection.refreshTokenEnc));
    connection.accessTokenEnc=encryptSecret(fresh.access_token);connection.refreshTokenEnc=encryptSecret(fresh.refresh_token);connection.accessTokenExpiresAt=Date.now()+Number(fresh.expires_in||3600)*1000;connection.refreshTokenExpiresAt=Date.now()+Number(fresh.x_refresh_token_expires_in||8726400)*1000;access=fresh.access_token;
  }
  const url=`${apiBase(connection.realmId)}${path}${path.includes('?')?'&':'?'}minorversion=75`;
  const r=await fetch(url,{method,headers:{authorization:`Bearer ${access}`,'content-type':'application/json','accept':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text();let payload={};try{payload=JSON.parse(text)}catch{payload={raw:text}}if(!r.ok){const detail=payload?.Fault?.Error?.[0]?.Detail||payload?.Fault?.Error?.[0]?.Message||`QuickBooks API request failed (${r.status})`;throw new Error(detail)}return payload;
}
export async function companyInfo(connection){return qboRequest(connection,`/companyinfo/${encodeURIComponent(connection.realmId)}`);}
export async function queryEntities(connection,entity){const safe=['Customer','Item','Account','Invoice','Payment'].includes(entity)?entity:'Customer';return qboRequest(connection,`/query?query=${encodeURIComponent(`select * from ${safe} maxresults 1000`)}`);}
export function publicQuickBooks(db){
  const cfg=qbServerConfig(),q=db.integrations?.quickbooks||{};return {provider:'QuickBooks Online',configured:cfg.configured,environment:cfg.environment,connected:Boolean(q.connected&&q.realmId&&q.accessTokenEnc),companyName:q.companyName||'',realmId:q.realmId||'',lastSyncAt:q.lastSyncAt||'',lastSyncSummary:q.lastSyncSummary||null,mappings:q.mappings||{defaultItemId:'',expenseAccountId:''},syncEnabled:q.syncEnabled!==false,serverRequirements:cfg.configured?[]:['QBO_CLIENT_ID','QBO_CLIENT_SECRET','QBO_REDIRECT_URI','BIB_INTEGRATION_SECRET']};
}
export async function syncCustomersAndInvoices(db){
  const q=db.integrations?.quickbooks;if(!q?.connected)throw new Error('QuickBooks is not connected');
  let customersCreated=0,invoicesCreated=0,paymentsCreated=0,skippedInvoices=0;
  for(const c of db.customers||[]){
    if(c.quickbooksId)continue;
    const payload={DisplayName:c.name,PrimaryEmailAddr:c.email?{Address:c.email}:undefined,PrimaryPhone:c.phone?{FreeFormNumber:c.phone}:undefined,BillAddr:c.property?{Line1:c.property}:undefined};
    const out=await qboRequest(q,'/customer',{method:'POST',body:payload});c.quickbooksId=out.Customer?.Id||'';if(c.quickbooksId)customersCreated++;
  }
  const defaultItemId=q.mappings?.defaultItemId||'';
  for(const inv of db.invoices||[]){
    if(inv.quickbooksId)continue;const c=(db.customers||[]).find(x=>x.id===inv.customerId);if(!c?.quickbooksId||!defaultItemId){skippedInvoices++;continue}
    const lines=(inv.lines?.length?inv.lines:[{description:`Combo Web and App invoice ${inv.id}`,amount:Number(inv.amount||0),qty:1,rate:Number(inv.amount||0)}]).map(l=>({Amount:Number(l.amount??l.rate??0),DetailType:'SalesItemLineDetail',Description:l.description||'Service',SalesItemLineDetail:{ItemRef:{value:defaultItemId},Qty:Number(l.qty||1),UnitPrice:Number(l.rate??l.amount??0)}}));
    const out=await qboRequest(q,'/invoice',{method:'POST',body:{CustomerRef:{value:c.quickbooksId},DocNumber:inv.id,DueDate:inv.due||undefined,Line:lines}});inv.quickbooksId=out.Invoice?.Id||'';if(inv.quickbooksId)invoicesCreated++;
  }
  for(const inv of db.invoices||[]){
    const paid=Math.max(0,Number(inv.paid||0)),synced=Math.max(0,Number(inv.quickbooksSyncedPaid||0));if(!inv.quickbooksId||paid<=synced)continue;const c=(db.customers||[]).find(x=>x.id===inv.customerId);if(!c?.quickbooksId)continue;const amount=Number((paid-synced).toFixed(2));const out=await qboRequest(q,'/payment',{method:'POST',body:{CustomerRef:{value:c.quickbooksId},TotalAmt:amount,Line:[{Amount:amount,LinkedTxn:[{TxnId:inv.quickbooksId,TxnType:'Invoice'}]}]}});if(out.Payment?.Id){inv.quickbooksSyncedPaid=paid;inv.quickbooksPaymentIds=[...(inv.quickbooksPaymentIds||[]),out.Payment.Id];paymentsCreated++;}
  }
  q.lastSyncAt=new Date().toISOString();q.lastSyncSummary={customersCreated,invoicesCreated,paymentsCreated,skippedInvoices};return q.lastSyncSummary;
}
