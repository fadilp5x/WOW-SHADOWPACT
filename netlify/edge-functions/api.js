import { handleApi } from '../../src/api.js';
import { MAX_SORT_BYTES, SORT_PATH, SORT_TIMEOUT_MS, readBoundedText, signSortPayload } from '../lib/sort-auth.mjs';

const ENV_KEYS = ['TINYFISH_API_KEY', 'FIREBASE_CONFIG', 'FIREBASE_PROJECT_ID', 'FIREBASE_API_KEY', 'FIREBASE_AUTH_TOKEN', 'FIREBASE_SERVICE_ACCOUNT'];
const encoder = new TextEncoder();
export const config = { path: ['/api/config', '/api/analyze'] };

export async function remoteSort(documents, origin, secret, fetcher = fetch) {
  const payload = JSON.stringify({ documents });
  if (encoder.encode(payload).byteLength > MAX_SORT_BYTES) throw Object.assign(new Error('The extracted policy documents are too large to analyze in one request.'), { code: 'POLICIES_TOO_LARGE' });
  const response = await fetcher(new URL(SORT_PATH, origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...await signSortPayload(payload, secret) },
    body: payload,
    signal: AbortSignal.timeout(SORT_TIMEOUT_MS),
    redirect: 'error',
  });
  if (!response.ok) throw Object.assign(new Error('The policy evidence could not be processed. Please try again.'), { code: 'NETLIFY_SORT_FAILED' });
  const result = await response.json();
  if (!result.sorted || !Array.isArray(result.sorted.takes) || !Number.isFinite(result.sorted.exposureScore)) throw Object.assign(new Error('The policy evidence response was incomplete.'), { code: 'NETLIFY_SORT_FAILED' });
  return result.sorted;
}

function jsonFromEvents(response) {
  // JSON callers also receive headers immediately. Initial whitespace is valid
  // JSON. After headers are sent, downstream errors are represented in the body.
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode('\n'));
      let buffer = '', final = false;
      const decoder = new TextDecoder();
      const emitLine = line => {
        if (!line.trim() || final) return;
        const event = JSON.parse(line);
        if (event.type === 'result' || event.type === 'error') {
          controller.enqueue(encoder.encode(JSON.stringify(event.type === 'result' ? event.data : { error: event.error, code: event.code })));
          final = true;
        }
      };
      try {
        for await (const chunk of response.body) {
          buffer += decoder.decode(chunk, { stream: true });
          let end;
          while ((end = buffer.indexOf('\n')) >= 0) { emitLine(buffer.slice(0, end)); buffer = buffer.slice(end + 1); }
        }
        buffer += decoder.decode();
        emitLine(buffer);
        if (!final) controller.enqueue(encoder.encode(JSON.stringify({ error: 'The policy analysis ended before a result was available.', code: 'INCOMPLETE_STREAM' })));
      } catch {
        if (!final) controller.enqueue(encoder.encode(JSON.stringify({ error: 'The policy analysis was interrupted. Please try again.', code: 'STREAM_FAILED' })));
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { status: response.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store, no-transform' } });
}

export async function netlifyApi(request, environment, fetcher = fetch) {
  const url = new URL(request.url);
  // The destination is constructed only from Netlify's incoming request origin.
  // Client-supplied app URLs, Host override headers, and body fields never select it.
  const env = { ...environment, SORT_POLICIES: documents => remoteSort(documents, url.origin, environment.TINYFISH_API_KEY, fetcher) };
  if (url.pathname !== '/api/analyze') return handleApi(request, env);
  const wantsEvents = (request.headers.get('accept') || '').includes('application/x-ndjson');
  const headers = new Headers(request.headers); headers.set('accept', 'application/x-ndjson');
  let body;
  if (request.method === 'POST') {
    try { body = await readBoundedText(request, 8192); }
    catch {
      const error = { type: 'error', error: 'The app name or website is too long.', code: 'INPUT_TOO_LARGE' };
      return new Response(JSON.stringify(error) + (wantsEvents ? '\n' : ''), { status: 413, headers: { 'content-type': wantsEvents ? 'application/x-ndjson' : 'application/json', 'cache-control': 'no-store' } });
    }
  }
  const internalRequest = new Request(request, { headers, ...(body !== undefined ? { body } : {}) });
  const response = await handleApi(internalRequest, env);
  return wantsEvents || !response.headers.get('content-type')?.includes('application/x-ndjson') ? response : jsonFromEvents(response);
}

export default request => {
  const env = Object.fromEntries(ENV_KEYS.map(key => [key, Netlify.env.get(key)]).filter(([, value]) => value !== undefined));
  return netlifyApi(request, env);
};
