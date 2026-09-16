import { checkPasscode, setAuthCookie, clearAuthCookie, isAuthed } from '../lib/auth.js';

// Per-container, so not a real rate limiter across the fleet - it only takes the
// edge off scripted guessing. The passcode itself is the security boundary.
const recent = new Map();

function tooMany(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 500) recent.clear();
  return hits.length > 10;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ authed: isAuthed(req) });
  }

  if (req.method === 'DELETE') {
    clearAuthCookie(res);
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (tooMany(ip)) return res.status(429).json({ error: 'Too many attempts. Wait a minute.' });

  try {
    if (!checkPasscode(req.body?.passcode)) {
      await new Promise((r) => setTimeout(r, 400));
      return res.status(401).json({ error: 'Wrong passcode' });
    }
    setAuthCookie(res);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server is missing APP_PASSCODE or AUTH_SECRET' });
  }
}
