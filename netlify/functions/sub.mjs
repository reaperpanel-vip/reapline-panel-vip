import { getStore } from '@netlify/blobs';
import { TOKEN_RE, buildSubscription, wantsInfoPage, renderInfoPage } from '../lib/core.mjs';

const plain = (status, text) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export default async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return plain(405, 'Method not allowed');
  const u = new URL(req.url);
  let token = '';
  try { token = decodeURIComponent(u.pathname.split('/').filter(Boolean)[1] || ''); } catch (e) {}
  if (!TOKEN_RE.test(token)) return plain(404, 'Not found');
  const store = getStore({ name: 'subs', consistency: 'strong' });
  const sub = await store.get('sub:' + token, { type: 'json' });
  if (!sub) return plain(404, 'Not found');
  const out = buildSubscription(sub);
  if (wantsInfoPage(req)) {
    const link = u.origin + '/sub/' + token;
    return new Response(renderInfoPage(sub, link, out), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  return new Response(req.method === 'HEAD' ? null : out.body, { status: out.status, headers: out.headers });
};

export const config = { path: '/sub/*' };
