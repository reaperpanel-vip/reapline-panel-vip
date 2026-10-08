import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { TOKEN_RE, cleanSub } from '../lib/core.mjs';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-sync-key', 'access-control-allow-methods': 'POST, OPTIONS' };
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });
const sha = s => createHash('sha256').update(String(s)).digest();
const envKey = () => (globalThis.Netlify && Netlify.env ? Netlify.env.get('SYNC_KEY') : process.env.SYNC_KEY) || '';

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method' });
  const key = envKey();
  if (!key) return json(500, { ok: false, error: 'SYNC_KEY is not set on the server' });
  if (!timingSafeEqual(sha(req.headers.get('x-sync-key') || ''), sha(key))) return json(401, { ok: false, error: 'bad key' });
  let body;
  try { const txt = await req.text(); if (txt.length > 4e6) return json(413, { ok: false, error: 'too large' }); body = JSON.parse(txt || '{}'); } catch (e) { return json(400, { ok: false, error: 'bad json' }); }
  if (body.ping) return json(200, { ok: true, ping: true });
  const store = getStore({ name: 'subs', consistency: 'strong' });
  let upserted = 0, removed = 0;
  for (const raw of (Array.isArray(body.upsert) ? body.upsert : []).slice(0, 100)) {
    const sub = cleanSub(raw); if (!sub) continue;
    await store.setJSON('sub:' + sub.token, sub); upserted++;
  }
  for (const t of (Array.isArray(body.remove) ? body.remove : []).slice(0, 500)) {
    if (typeof t === 'string' && TOKEN_RE.test(t)) { await store.delete('sub:' + t); removed++; }
  }
  return json(200, { ok: true, upserted, removed });
};

export const config = { path: '/api/sync' };
