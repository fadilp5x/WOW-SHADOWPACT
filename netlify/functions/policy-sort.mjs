import { sortPolicies } from '../../src/api.js';
import { readBoundedText, verifySortPayload } from '../lib/sort-auth.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export function validDocuments(documents) {
  return Array.isArray(documents) && documents.length === 2
    && new Set(documents.map(document => document?.title)).size === 2
    && documents.every(document => {
      if (!document || !['Privacy Policy', 'Terms of Service'].includes(document.title) || typeof document.text !== 'string' || document.text.length < 1 || document.text.length > 900000 || typeof document.url !== 'string' || document.url.length > 2048) return false;
      try { const url = new URL(document.url); return url.protocol === 'https:' && !url.username && !url.password && !url.port; } catch { return false; }
    });
}

export async function sortRequest(request, secret) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!secret) return json({ error: 'Policy analysis is not configured.', code: 'SORT_NOT_CONFIGURED' }, 503);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'A JSON request is required.' }, 415);
  try {
    // Reject unsigned traffic before reading its payload or doing any parsing.
    if (!request.headers.has('x-shadowpact-signature')) return json({ error: 'Unauthorized.' }, 401);
    const payload = await readBoundedText(request);
    if (!await verifySortPayload(payload, request.headers, secret)) return json({ error: 'Unauthorized.' }, 401);
    let data; try { data = JSON.parse(payload); } catch { return json({ error: 'Invalid policy payload.' }, 400); }
    if (!validDocuments(data.documents)) return json({ error: 'Two valid official policy documents are required.' }, 400);
    return json({ sorted: sortPolicies(data.documents) });
  } catch (error) {
    return json({ error: error.status === 413 ? error.message : 'The policy evidence could not be processed.', code: error.status === 413 ? 'POLICIES_TOO_LARGE' : 'SORT_FAILED' }, error.status || 500);
  }
}

export default request => sortRequest(request, process.env.TINYFISH_API_KEY);
