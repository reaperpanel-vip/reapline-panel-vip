// Shared helpers: validation, subscription output (Happ / INCY / V2Box compatible), info page.
export const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;
const PROTO = /^(vless|vmess|trojan|ss|hysteria2?|hy2):\/\/\S+$/i;
const NON_ASCII = /[^\x20-\x7e]/;
const b64 = s => Buffer.from(String(s), 'utf8').toString('base64');
// header values must be ASCII: non-ASCII text is sent as "base64:<...>" (understood by Happ and most clients)
const hv = s => (NON_ASCII.test(s) ? 'base64:' + b64(s) : String(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function cleanSub(raw) {
  if (!raw || typeof raw !== 'object' || !TOKEN_RE.test(String(raw.token))) return null;
  const str = (v, n) => String(v == null ? '' : v).slice(0, n);
  const num = (v, max) => { v = Number(v); return Number.isFinite(v) && v > 0 ? Math.min(v, max) : 0; };
  const links = Array.isArray(raw.links) ? raw.links.filter(l => typeof l === 'string' && l.length <= 8000 && PROTO.test(l)).slice(0, 500) : [];
  return {
    token: String(raw.token), name: str(raw.name, 80), title: str(raw.title || raw.name, 80),
    web: str(raw.web, 300), support: str(raw.support, 300), announcement: str(raw.announcement, 200),
    interval: num(raw.interval, 720) || 1, gbLimit: num(raw.gbLimit, 100000), expiresAt: num(raw.expiresAt, 8.64e15),
    disabled: !!raw.disabled, links, updatedAt: Date.now(),
  };
}

export function buildSubscription(sub, now = Date.now()) {
  const expired = !!sub.expiresAt && sub.expiresAt <= now;
  const off = !!sub.disabled || expired;
  const title = sub.title || sub.name || 'Subscription';
  const total = Math.round((sub.gbLimit || 0) * 1073741824);
  const headers = {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'profile-title': hv(title),
    'profile-update-interval': String(Math.max(1, Math.round(sub.interval || 1))),
    'subscription-userinfo': `upload=0; download=0; total=${total}` + (sub.expiresAt ? `; expire=${Math.floor(sub.expiresAt / 1000)}` : ''),
    'content-disposition': `attachment; filename="${title.replace(/[^\x20-\x7e]|["\\]/g, '_') || 'subscription'}"; filename*=UTF-8''${encodeURIComponent(title)}`,
  };
  if (sub.support && !NON_ASCII.test(sub.support)) headers['support-url'] = sub.support;
  if (sub.web && !NON_ASCII.test(sub.web)) headers['profile-web-page-url'] = sub.web;
  const note = off ? (sub.disabled ? 'Subscription disabled' : 'Subscription expired') : sub.announcement;
  if (note) headers['announce'] = hv(note);
  const body = off ? '' : b64((sub.links || []).join('\n'));
  return { status: 200, headers, body, off, expired };
}

const APP_UA = /happ|incy|v2box|v2ray|xray|clash|sing-?box|hiddify|streisand|shadowrocket|nekobox|nekoray|karing|foxray|quantumult|surge|loon|stash|okhttp|dalvik|cfnetwork/i;
export function wantsInfoPage(req) {
  const u = new URL(req.url);
  if (u.searchParams.has('raw')) return false;
  if (u.searchParams.has('info')) return true;
  const ua = req.headers.get('user-agent') || '', accept = req.headers.get('accept') || '';
  return accept.includes('text/html') && !APP_UA.test(ua);
}

export function renderInfoPage(sub, url, out) {
  const exp = sub.expiresAt ? new Date(sub.expiresAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '∞';
  const days = sub.expiresAt ? Math.ceil((sub.expiresAt - Date.now()) / 864e5) : null;
  const status = out.off ? (sub.disabled ? 'Disabled' : 'Expired') : 'Active';
  const color = out.off ? '#ef4444' : '#22c55e';
  const traffic = sub.gbLimit ? sub.gbLimit + ' GB' : '∞';
  const happ = 'happ://add/' + url;
  const v2box = 'v2box://install-sub?url=' + encodeURIComponent(url) + '&name=' + encodeURIComponent(sub.title || sub.name || 'Subscription');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(sub.title || sub.name)}</title>
<style>*{box-sizing:border-box;margin:0}body{background:#0a0a0a;color:#fff;font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:20px;display:flex;justify-content:center}
.c{width:100%;max-width:440px;background:#141414;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:14px}
h1{font-size:22px;word-break:break-word}.b{display:inline-block;font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;border:1px solid ${color};color:${color}}
.g{display:grid;grid-template-columns:1fr 1fr;gap:8px}.g div{background:#1a1a1a;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:10px 12px;font-size:13px;color:rgba(255,255,255,.55)}.g b{display:block;color:#fff;font-size:15px;margin-top:2px}
code{display:block;background:#101010;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;font-size:12px;word-break:break-all;color:rgba(255,255,255,.7)}
a,button{display:block;text-align:center;text-decoration:none;font:600 15px inherit;padding:13px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:#1a1a1a;color:#fff;cursor:pointer;width:100%}
.p{background:#f5f5f5;color:#0a0a0a;border-color:transparent}small{color:rgba(255,255,255,.45);font-size:12px;line-height:1.5}</style></head><body><div class="c">
<div><h1>${esc(sub.title || sub.name)}</h1><span class="b">${status}</span></div>
<div class="g"><div>Expires<b>${esc(exp)}${days !== null && days > 0 ? ' (' + days + 'd)' : ''}</b></div><div>Traffic<b>${esc(traffic)}</b></div><div>Configs<b>${(sub.links || []).length}</b></div><div>Update<b>${Math.max(1, Math.round(sub.interval || 1))}h</b></div></div>
${sub.announcement ? `<small>📢 ${esc(sub.announcement)}</small>` : ''}
<code id="u">${esc(url)}</code>
<button class="p" onclick="navigator.clipboard.writeText(document.getElementById('u').textContent).then(()=>{this.textContent='Copied'})">Copy link</button>
<a href="${esc(happ)}">Open in Happ</a><a href="${esc(v2box)}">Open in V2Box</a>
<small>INCY and other apps: copy the link and add it as a subscription URL inside the app.</small></div></body></html>`;
}
