import assert from 'node:assert/strict';
import { sortPolicies, handleApi } from '../src/api.js';

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
  globalThis.fetch = async (url) => { calls.push(String(url)); return new Response(JSON.stringify({ results: [{ title: 'Privacy Policy', url: 'https://unrelated-review-blog.com/privacy' }] })); };
  response = await handleApi(new Request('https://example.com/api/analyze', { method: 'POST', body: JSON.stringify({ appName: 'DefinitelyNonexistentAppName' }) }), { TINYFISH_API_KEY: 'test-key' });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, 'OFFICIAL_POLICIES_NOT_FOUND');
  assert.equal(calls.length, 2);
} finally { globalThis.fetch = originalFetch; }

console.log('Passed: collection negation, condition preservation, eight body targets, sharing evidence, verbatim quotes, scoped retention, score bounds, input errors, Firestore-first cache, official-source rejection.');
