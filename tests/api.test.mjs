import assert from 'node:assert/strict';
import { sortPolicies, handleApi, normalizeAppInput } from '../src/api.js';

const doc = (text, title = 'Privacy Policy') => ({ title, url: 'https://example.com/privacy', text });
const sort = text => sortPolicies([doc(text)]);

assert.deepEqual(sort('We never collect your location or microphone recordings.').takes, []);
assert.deepEqual(sort('# Information we collect\n\nWe may not collect your photos, microphone recordings, or precise location.').takes, []);
assert.deepEqual(sort('We use the information we have to study our Service and collaborate with others on research to make our Service better and contribute to the well-being of our community.').takes, []);
assert.deepEqual(sort('For example, if you use payment features, you will be asked to agree to the Community Payment Terms.').takes, []);
assert.deepEqual(sort('You must not buy or sell your account or any data from our service.').worstLines, []);
assert.deepEqual(sort('We retain all rights to our content and our intellectual property.').worstLines, []);
assert.deepEqual(sort('You may delete your photos. Posts containing medical advice are prohibited.').takes, []);
const conditional = sort('If you enable contact syncing, we upload your contacts.');
assert.equal(conditional.takes[0].bodyTarget, 'HANDS');
assert.equal(conditional.takes[0].evidence, 'If you enable contact syncing, we upload your contacts.');
const mixed = sort('We collect photos but do not collect microphone recordings.');
assert.deepEqual(mixed.takes.map(x => x.bodyTarget), ['EYES']);
const all = sort('# Information we collect\n\nWe collect your photos, microphone audio, messages, browsing interests, health data, contacts, location and payment information.');
assert.equal(all.takes.length, 8);
assert.equal(new Set(all.takes.map(x => x.bodyTarget)).size, 8);
assert.ok(all.exposureScore >= 0 && all.exposureScore <= 100);
assert.equal(sort('We do not sell personal information to advertising partners.').sharesWith.length, 0);
assert.equal(sort('We share device identifiers with advertising partners.').sharesWith[0].name, 'Advertisers');
assert.equal(sort('We share device identifiers with advertising partners.').takes.length, 0);
const retention = sort('We keep records for seven years to comply with tax law.');
assert.match(retention.retention.summary, /seven years/);
assert.match(retention.retention.summary, /records described/);
const clauses = 'We grant our partners a worldwide, transferable and sublicensable license to content you upload. We retain personal information for as long as necessary for legal obligations. We may share your data with advertising partners for targeted advertising.';
for (const clause of sort(clauses).worstLines) assert.ok(clauses.includes(clause.quote), 'Each quote must be verbatim in the source');
assert.equal(sort('We never sell your data.').worstLines.length, 0);

assert.deepEqual(normalizeAppInput('instagram.com'), { appName: 'Instagram', officialHost: null });
assert.deepEqual(normalizeAppInput('https://www.instagram.com/some-page?anything=yes'), { appName: 'Instagram', officialHost: null });
assert.deepEqual(normalizeAppInput('https://privacycenter.instagram.com/policy'), { appName: 'Instagram', officialHost: null });
assert.deepEqual(normalizeAppInput('google.com'), { appName: 'Google', officialHost: null });
assert.deepEqual(normalizeAppInput('chatgpt.com'), { appName: 'ChatGPT', officialHost: null });
assert.deepEqual(normalizeAppInput('https://www.chatgpt.com/'), { appName: 'ChatGPT', officialHost: null });
assert.deepEqual(normalizeAppInput('Meta'), { appName: 'Meta', officialHost: null });
assert.deepEqual(normalizeAppInput('meta.com'), { appName: 'Meta', officialHost: null });
assert.deepEqual(normalizeAppInput('https://www.acmewidget.com/private-path'), { appName: 'acmewidget.com', officialHost: 'acmewidget.com' });
assert.deepEqual(normalizeAppInput('shop.acmewidget.com'), { appName: 'shop.acmewidget.com', officialHost: 'shop.acmewidget.com' });
for (const value of ['http://localhost', 'localhost', 'http://127.0.0.1', 'http://2130706433', 'http://0x7f000001', 'http://[::1]', 'http://10.1.2.3', 'http://169.254.169.254/latest/meta-data', 'https://metadata.google.internal', 'https://user:password@instagram.com', 'file:///etc/passwd', 'ftp://instagram.com', 'https://instagram.com:8443', 'https://bad.invalid']) assert.throws(() => normalizeAppInput(value), { code: 'INVALID_APP_NAME' }, value);

let response = await handleApi(new Request('https://example.com/api/config'), {});
assert.deepEqual(await response.json(), { liveSearchConfigured: false, cacheConfigured: false, cacheProvider: 'browser' });
response = await handleApi(new Request('https://example.com/api/analyze', { method: 'POST', body: JSON.stringify({ appName: 'https://evil.example' }) }));
assert.equal(response.status, 400);
response = await handleApi(new Request('https://example.com/api/analyze', { method: 'POST', body: JSON.stringify({ appName: 'Instagram' }) }));
assert.equal(response.status, 503);
assert.equal((await response.json()).code, 'TINYFISH_NOT_CONFIGURED');

const originalFetch = globalThis.fetch;
let calls = [];
const encode = value => typeof value === 'string' ? { stringValue: value } : typeof value === 'number' ? { integerValue: String(value) } : Array.isArray(value) ? { arrayValue: { values: value.map(encode) } } : { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k,v]) => [k,encode(v)])) } };
const record = { appName: 'Cached App', privacyUrl: 'https://cachedapp.com/privacy', termsUrl: 'https://cachedapp.com/terms', rawText: clauses, sorted: sort(clauses), exposureScore: 23, fetchedAt: '2026-11-17T00:00:00Z' };
try {
  globalThis.fetch = async (url, options) => { calls.push(String(url)); assert.match(String(url), /^https:\/\/firestore.googleapis.com/); return new Response(JSON.stringify(encode(record).mapValue)); };
  response = await handleApi(new Request('https://example.com/api/analyze', { method: 'POST', body: JSON.stringify({ appName: 'Cached App' }) }), { FIREBASE_CONFIG: JSON.stringify({ projectId: 'test-project', apiKey: 'test-key' }), FIREBASE_AUTH_TOKEN: 'test-token', TINYFISH_API_KEY: 'unused' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).cacheStatus, 'firestore-hit');
  assert.equal(calls.length, 1, 'A Firestore cache hit must never call TinyFish');

  calls = [];
  response = await handleApi(new Request('https://example.com/api/analyze', { method: 'POST', headers: { accept: 'application/x-ndjson' }, body: JSON.stringify({ appName: 'Cached App' }) }), { FIREBASE_CONFIG: JSON.stringify({ projectId: 'test-project', apiKey: 'test-key' }), FIREBASE_AUTH_TOKEN: 'test-token', TINYFISH_API_KEY: 'unused' });
  assert.match(response.headers.get('content-type'), /application\/x-ndjson/);
  const cachedEvents = (await response.text()).trim().split('\n').map(JSON.parse);
  assert.deepEqual(cachedEvents.map(event => event.type === 'progress' ? `${event.stage}:${event.status}` : event.type), ['cache:running', 'cache:complete', 'result']);
  assert.equal(cachedEvents.at(-1).data.cacheStatus, 'firestore-hit');
  assert.equal(calls.length, 1);

  calls = [];
  globalThis.fetch = async (url) => { calls.push(String(url)); return new Response(JSON.stringify({ results: [{ title: 'Privacy Policy', url: 'https://unrelated-review-blog.com/privacy' }] })); };
  response = await handleApi(new Request('https://example.com/api/analyze', { method: 'POST', body: JSON.stringify({ appName: 'DefinitelyNonexistentAppName' }) }), { TINYFISH_API_KEY: 'test-key' });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, 'OFFICIAL_POLICIES_NOT_FOUND');
  assert.equal(calls.length, 2);

  calls = [];
  let releaseSearch;
  const gate = new Promise(resolve => { releaseSearch = resolve; });
  globalThis.fetch = async (url, options) => {
    const target = new URL(url); calls.push(String(url));
    if (target.hostname === 'api.search.tinyfish.ai') {
      assert.equal(target.searchParams.get('include_domains'), 'acmewidget.com');
      assert.ok(!target.searchParams.get('query').includes('private-path'));
      await gate;
      return new Response(JSON.stringify({ results: [{ title: 'Privacy Policy', url: 'https://acmewidget.com/privacy' }, { title: 'Terms of Service', url: 'https://acmewidget.com/terms' }, { title: 'Privacy Policy', url: 'https://acmewidget.com.evil.org/privacy' }] }));
    }
    assert.equal(target.hostname, 'api.fetch.tinyfish.ai', 'The server only calls TinyFish, never the submitted website directly');
    const body = JSON.parse(options.body);
    assert.deepEqual(new Set(body.urls), new Set(['https://acmewidget.com/privacy', 'https://acmewidget.com/terms']));
    return new Response(JSON.stringify({ results: [
      { url: 'https://acmewidget.com/privacy', text: '# Privacy Policy\n\n' + 'We collect your photos and location information to provide the service. '.repeat(30) },
      { url: 'https://acmewidget.com/terms', text: '# Terms of Service\n\n' + 'These terms govern your use of the service and the agreement between you and our company. '.repeat(30) },
    ] }));
  };
  response = await handleApi(new Request('https://example.com/api/analyze', { method: 'POST', headers: { accept: 'application/x-ndjson' }, body: JSON.stringify({ appName: 'https://www.acmewidget.com/private-path' }) }), { TINYFISH_API_KEY: 'test-key' });
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let streamText = decoder.decode((await reader.read()).value);
  assert.match(streamText, /"stage":"cache"/, 'Progress must arrive before search has finished');
  releaseSearch();
  for (;;) { const part = await reader.read(); if (part.done) break; streamText += decoder.decode(part.value, { stream: true }); }
  const events = streamText.trim().split('\n').map(JSON.parse);
  assert.deepEqual(events.map(event => event.type === 'progress' ? `${event.stage}:${event.status}` : event.type), ['cache:skipped', 'search:running', 'search:complete', 'extract:running', 'extract:complete', 'sort:running', 'sort:complete', 'save:skipped', 'result']);
  assert.equal(events.at(-1).data.appName, 'acmewidget.com');
  assert.equal(events.at(-1).data.sorted.takes.length, 2);
  assert.equal(calls.length, 3);

  response = await handleApi(new Request('https://example.com/api/analyze', { method: 'POST', headers: { accept: 'application/x-ndjson' }, body: JSON.stringify({ appName: 'http://127.0.0.1' }) }), {});
  assert.equal(response.status, 400);
  assert.deepEqual(JSON.parse((await response.text()).trim()).code, 'INVALID_APP_NAME');
  response = await handleApi(new Request('https://example.com/api/analyze', { method: 'POST', headers: { accept: 'application/x-ndjson' }, body: JSON.stringify({ appName: 'Spotify' }) }), {});
  const errors = (await response.text()).trim().split('\n').map(JSON.parse);
  assert.equal(errors.at(-1).type, 'error');
  assert.equal(errors.at(-1).code, 'TINYFISH_NOT_CONFIGURED');
  assert.ok(!errors.some(event => event.type === 'result'));
} finally { globalThis.fetch = originalFetch; }

console.log('Passed: extraction evidence, input normalization, SSRF rejection, JSON compatibility, live NDJSON stage ordering, stream errors, Firestore-first cache, and official-source restriction.');
