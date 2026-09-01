import { randomBytes, scryptSync, timingSafeEqual, createHmac, createHash } from 'node:crypto';

const b64=v=>Buffer.from(v).toString('base64url');
const unb64=v=>Buffer.from(v,'base64url').toString('utf8');
export function normalizeUsername(v){return String(v||'').trim().toLowerCase()}
export function hashPassword(password,salt=randomBytes(16).toString('hex')){
  const hash=scryptSync(String(password),salt,64).toString('hex');return `scrypt$${salt}$${hash}`;
}
export function verifyPassword(password,stored=''){
  const [kind,salt,hex]=String(stored).split('$');if(kind!=='scrypt'||!salt||!hex)return false;
  const expected=Buffer.from(hex,'hex'),actual=scryptSync(String(password),salt,expected.length);return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
export function tokenHash(token){return createHash('sha256').update(String(token)).digest('hex')}
export function newToken(bytes=32){return randomBytes(bytes).toString('base64url')}
export function sessionSecret(){return process.env.SESSION_SECRET||randomBytes(48).toString('hex')}
export function makeSession(user,secret,ttlSeconds=60*60*12){
  const payload=b64(JSON.stringify({uid:user.id,role:user.role,exp:Math.floor(Date.now()/1000)+ttlSeconds}));const sig=createHmac('sha256',secret).update(payload).digest('base64url');return `${payload}.${sig}`;
}
export function readSessionCookie(req,secret){
  const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('bib_session='))?.slice(12);if(!raw)return null;
  const [payload,sig]=raw.split('.');if(!payload||!sig)return null;const expected=createHmac('sha256',secret).update(payload).digest('base64url');
  try{if(!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;const data=JSON.parse(unb64(payload));if(Number(data.exp||0)<Math.floor(Date.now()/1000))return null;return data}catch{return null}
}
export function sessionCookie(token){return `bib_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${process.env.NODE_ENV==='production'?'; Secure':''}`}
export function clearSessionCookie(){return `bib_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV==='production'?'; Secure':''}`}
export function publicUser(user){if(!user)return null;const {passwordHash,inviteTokenHash,resetTokenHash,...safe}=user;return safe}
