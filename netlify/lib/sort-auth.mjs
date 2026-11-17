// Shared signing protocol for the Edge-to-Function hop. The API credential never
// crosses this hop. Signatures are bound to this operation, payload and time.
export const SORT_PATH = '/.netlify/functions/policy-sort';
export const MAX_SORT_BYTES = 2 * 1024 * 1024;
export const SORT_TIMEOUT_MS = 20000;
const DOMAIN = 'shadowpact:netlify:policy-sort:v1';
const encoder = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
const keyFor = secret => crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
async function digest(payload) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(payload))); }

export async function signSortPayload(payload, secret, timestamp = Date.now()) {
  if (!secret) throw new Error('Policy analysis is not configured.');
  const time = String(timestamp), hash = await digest(payload);
  const message = encoder.encode(`${DOMAIN}\n${time}\n${hash}`);
  const signature = hex(await crypto.subtle.sign('HMAC', await keyFor(secret), message));
  return { 'x-shadowpact-time': time, 'x-shadowpact-digest': hash, 'x-shadowpact-signature': signature };
}

export async function verifySortPayload(payload, headers, secret, now = Date.now()) {
  if (!secret) return false;
  const time = headers.get('x-shadowpact-time') || '';
  const suppliedDigest = headers.get('x-shadowpact-digest') || '';
  const signature = headers.get('x-shadowpact-signature') || '';
  if (!/^\d{13}$/.test(time) || Math.abs(now - Number(time)) > 90000 || !/^[a-f0-9]{64}$/.test(suppliedDigest) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const actualDigest = await digest(payload);
  if (actualDigest !== suppliedDigest) return false;
  const bytes = Uint8Array.from(signature.match(/../g), value => parseInt(value, 16));
  return crypto.subtle.verify('HMAC', await keyFor(secret), bytes, encoder.encode(`${DOMAIN}\n${time}\n${actualDigest}`));
}

export async function readBoundedText(request, limit = MAX_SORT_BYTES) {
  if (Number(request.headers.get('content-length')) > limit) throw Object.assign(new Error('Policy document is too large to analyze.'), { status: 413 });
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let count = 0, text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > limit) { await reader.cancel(); throw Object.assign(new Error('Policy document is too large to analyze.'), { status: 413 }); }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}
