import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const COOKIE = 'cm_auth';
const MAX_AGE = 60 * 60 * 24 * 30;   // 30 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET is not set');
  return s;
}

function passcode() {
  const p = process.env.APP_PASSCODE;
  if (!p) throw new Error('APP_PASSCODE is not set');
  return p;
}

/** Constant-time compare that tolerates differing lengths. */
function same(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) {
    // still burn a comparison so the timing carries no length signal
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function sign(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function issue() {
  const payload = `${Date.now() + MAX_AGE * 1000}.${randomBytes(6).toString('base64url')}`;
  return `${payload}.${sign(payload)}`;
}

function valid(token) {
  if (!token) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  if (!same(sign(payload), token.slice(i + 1))) return false;
  const expiry = Number(payload.split('.')[0]);
  return Number.isFinite(expiry) && expiry > Date.now();
}

function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function isAuthed(req) {
  try {
    return valid(readCookie(req, COOKIE)) || checkApiKey(req);
  } catch {
    return false;   // misconfigured secret fails closed
  }
}

export function checkPasscode(input) {
  return same(String(input ?? ''), passcode());
}

export function checkApiKey(req) {
  const configured = process.env.API_KEY || process.env.APP_PASSCODE;
  if (!configured) return false;

  let provided = req.headers && (req.headers['x-api-key'] || req.headers['x-api-token']);
  if (!provided && req.headers && req.headers.authorization) {
    const m = req.headers.authorization.match(/^Bearer\s+(.*)$/i);
    if (m) provided = m[1];
  }
  if (!provided && req.query) {
    provided = req.query.api_key || req.query.key;
  }
  if (!provided && req.body) {
    provided = req.body.api_key || req.body.key;
  }

  return same(String(provided ?? ''), configured);
}

export function setAuthCookie(res) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${issue()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`);
}

export function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

/** Wrap a handler so it 401s without a valid cookie. */
export function guard(handler) {
  return async (req, res) => {
    if (!isAuthed(req)) return res.status(401).json({ error: 'auth required' });
    try {
      return await handler(req, res);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || 'server error' });
    }
  };
}
