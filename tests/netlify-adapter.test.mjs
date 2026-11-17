import assert from 'node:assert/strict';
import { signSortPayload, verifySortPayload, readBoundedText, MAX_SORT_BYTES } from '../netlify/lib/sort-auth.mjs';
import { sortRequest } from '../netlify/functions/policy-sort.mjs';
import { netlifyApi, remoteSort, config } from '../netlify/edge-functions/api.js';
import { sortPolicies } from '../src/api.js';

const secret = 'test-only-not-a-real-key';
const documents = [
  { title: 'Privacy Policy', url: 'https://acmewidget.com/privacy', text: '# Information we collect\n\nWe collect photos and precise location when you give us permission.\n\nWe never collect microphone recordings.' },
  { title: 'Terms of Service', url: 'https://acmewidget.com/terms', text: 'You grant us a worldwide, transferable and sublicensable license to content you upload.' },
];
const payload = JSON.stringify({ documents });
const headers = { 'content-type': 'application/json', ...await signSortPayload(payload, secret) };
const request = (body = payload, extraHeaders = headers) => new Request('https://shadowpact.netlify.app/.netlify/functions/policy-sort', { method: 'POST', headers: extraHeaders, body });

assert.equal(await verifySortPayload(payload, new Headers(headers), secret), true);
assert.equal(await verifySortPayload(payload + ' ', new Headers(headers), secret), false);
assert.equal(await verifySortPayload(payload, new Headers(headers), 'wrong-key'), false);
assert.equal(await verifySortPayload(payload, new Headers(await signSortPayload(payload, secret, Date.now() - 120000)), secret), false);
assert.equal((await sortRequest(request(payload, { 'content-type': 'application/json' }), secret)).status, 401);
assert.equal((await sortRequest(request(), '')).status, 503);
let response = await sortRequest(request(), secret);
assert.equal(response.status, 200);
const result = await response.json();
assert.deepEqual(result.sorted, sortPolicies(documents), 'Native compute preserves the exact existing evidence analysis');
assert.deepEqual(result.sorted.takes.map(item => item.bodyTarget), ['EYES', 'FEET']);
for (const item of result.sorted.takes) assert.ok(documents[0].text.includes(item.evidence));
for (const item of result.sorted.worstLines) assert.ok(documents.some(doc => doc.text.includes(item.quote)));

const invalidPayload = JSON.stringify({ documents: [documents[0], { ...documents[1], url: 'http://localhost/policy' }] });
response = await sortRequest(request(invalidPayload, { 'content-type': 'application/json', ...await signSortPayload(invalidPayload, secret) }), secret);
assert.equal(response.status, 400);
const huge = 'x'.repeat(MAX_SORT_BYTES + 1);
response = await sortRequest(request(huge), secret);
assert.equal(response.status, 413);
await assert.rejects(readBoundedText(new Request('https://example.com', { method: 'POST', body: '123456' }), 5), { status: 413 });

let internalUrl;
const remote = await remoteSort(documents, 'https://shadowpact.netlify.app', secret, async (url, options) => {
  internalUrl = String(url);
  assert.equal(options.redirect, 'error');
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(await verifySortPayload(options.body, new Headers(options.headers), secret), true);
  assert.ok(!JSON.stringify(options.headers).includes(secret), 'The API key must never cross the internal hop');
  return sortRequest(new Request(url, options), secret);
});
assert.equal(internalUrl, 'https://shadowpact.netlify.app/.netlify/functions/policy-sort');
assert.deepEqual(remote, result.sorted);
assert.deepEqual(config.path, ['/api/config', '/api/analyze']);

response = await netlifyApi(new Request('https://shadowpact.netlify.app/api/config'), { TINYFISH_API_KEY: secret });
assert.deepEqual(await response.json(), { liveSearchConfigured: true, cacheConfigured: false, cacheProvider: 'browser' });
response = await netlifyApi(new Request('https://shadowpact.netlify.app/api/analyze', { method: 'POST', body: JSON.stringify({ appName: 'x'.repeat(9000) }) }), { TINYFISH_API_KEY: secret });
assert.equal(response.status, 413);

const originalFetch = globalThis.fetch;
let unlock, sortCalls = 0;
const gate = new Promise(resolve => { unlock = resolve; });
try {
  globalThis.fetch = async (url, options) => {
    if (new URL(url).hostname === 'api.search.tinyfish.ai') {
      await gate;
      return new Response(JSON.stringify({ results: [{ title: 'Privacy Policy', url: documents[0].url }, { title: 'Terms of Service', url: documents[1].url }] }));
    }
    assert.equal(new URL(url).hostname, 'api.fetch.tinyfish.ai');
    return new Response(JSON.stringify({ results: documents.map(document => ({ url: document.url, text: `# ${document.title}\n\n` + document.text.repeat(30) })) }));
  };
  const compute = async (url, options) => {
    sortCalls++;
    assert.equal(new URL(url).origin, 'https://shadowpact.netlify.app');
    return sortRequest(new Request(url, options), secret);
  };
  response = await netlifyApi(new Request('https://shadowpact.netlify.app/api/analyze', { method: 'POST', headers: { accept: 'application/x-ndjson', host: 'attacker.invalid' }, body: JSON.stringify({ appName: 'acmewidget.com' }) }), { TINYFISH_API_KEY: secret }, compute);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let eventsText = decoder.decode((await reader.read()).value);
  assert.match(eventsText, /"type":"progress"/, 'Headers and progress arrive while upstream search is still waiting');
  unlock();
  for (;;) { const chunk = await reader.read(); if (chunk.done) break; eventsText += decoder.decode(chunk.value); }
  const events = eventsText.trim().split('\n').map(JSON.parse);
  assert.equal(events.at(-1).type, 'result');
  assert.equal(events.at(-1).data.appName, 'acmewidget.com');
  assert.equal(sortCalls, 1);

  response = await netlifyApi(new Request('https://shadowpact.netlify.app/api/analyze', { method: 'POST', body: JSON.stringify({ appName: 'acmewidget.com' }) }), { TINYFISH_API_KEY: secret }, compute);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal((await response.json()).appName, 'acmewidget.com');
  response = await netlifyApi(new Request('https://shadowpact.netlify.app/api/analyze', { method: 'POST', body: JSON.stringify({ appName: 'http://127.0.0.1' }) }), { TINYFISH_API_KEY: secret }, compute);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'INVALID_APP_NAME');
} finally { globalThis.fetch = originalFetch; }

console.log('Passed Netlify signing, expiry, tampering, authorization, byte limits, native evidence parity, fixed-origin compute, early NDJSON progress, JSON compatibility, and validation.');
