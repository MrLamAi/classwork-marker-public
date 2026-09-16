/**
 * Local dev server - runs the real api/*.js handlers over node:http with a
 * Vercel-shaped req/res shim, and serves public/ statically.
 *
 * No Vercel CLI and no install required:  npm run dev
 *
 * With DATABASE_URL set (in .env, .env.local or the environment) it talks to
 * that Postgres. Without one it falls back to an in-memory store seeded with a
 * demo class, so the interface can be worked on offline.
 *
 * `vercel dev` remains the faithful emulation - see npm run dev:vercel.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;

/* ------------------------------------------------------------------- .env */

for (const file of ['.env', '.env.local']) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!m) continue;
    const value = m[2].trim().replace(/^["'](.*)["']$/s, '$1');
    if (value && !process.env[m[1]]) process.env[m[1]] = value;
  }
}

/* --------------------------------------------------------------- database */

const useMemory = !process.env.DATABASE_URL;
if (useMemory) {
  register(new URL('./pg-hook.mjs', import.meta.url));
  const mem = await import('./memory-pg.mjs');
  mem.seed();
  process.env.DATABASE_URL = 'memory://dev';
}

process.env.AUTH_SECRET ||= 'dev-only-secret-not-for-production';
process.env.APP_PASSCODE ||= 'dev';

/* --------------------------------------------------------------- handlers */

const api = {};
for (const name of ['login', 'bundle', 'status', 'action', 'external']) {
  api['/api/' + name] = (await import(pathToFileURL(path.join(ROOT, 'api', name + '.js')).href)).default;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png'
};

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => resolve(b));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const handler = api[url.pathname];

  if (handler) {
    // --- the bits of the Vercel request/response the handlers rely on ---
    req.query = Object.fromEntries(url.searchParams);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const raw = await readBody(req);
      try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    }
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => {
      if (!res.hasHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(o));
      return res;
    };

    try {
      await handler(req, res);
    } catch (err) {
      console.error('[api]', err);
      if (!res.headersSent) res.status(500).json({ error: String(err.message || err) });
    }
    return;
  }

  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.join(PUBLIC, rel);
  if (file.startsWith(PUBLIC) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(fs.readFileSync(file));
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  Marker Pro dev server   http://localhost:${PORT}`);
  console.log(`  passcode                ${process.env.APP_PASSCODE}`);
  console.log(`  data                    ${useMemory
    ? 'in-memory (demo class, resets on restart)'
    : 'DATABASE_URL'}\n`);
});
