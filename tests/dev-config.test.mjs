import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import config from '../vite.config.js';

test('local .env is available to the API and production config has no dev middleware', async () => {
  const cwd = process.cwd();
  const saved = process.env.TINYFISH_API_KEY;
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shadowpact-env-'));
  try {
    delete process.env.TINYFISH_API_KEY;
    await fs.writeFile(path.join(directory, '.env'), 'TINYFISH_API_KEY=SHADOWPACT_TEST_SECRET_SENTINEL\n');
    process.chdir(directory);
    let handler, status, text = ''; 
    config({ command: 'serve', mode: 'development' }).plugins[0].configureServer({ middlewares: { use(fn) { handler = fn; } } });
    const request = { url: '/api/config', method: 'GET', headers: {}, async *[Symbol.asyncIterator]() {} };
    await handler(request, { writeHead(code) { status = code; }, end(value) { if (value) text += value; }, write(value) { text += value; } }, () => assert.fail('API request must be handled'));
    assert.equal(status, 200);
    assert.equal(JSON.parse(text).liveSearchConfigured, true);
    const production = config({ command: 'build', mode: 'production' });
    assert.deepEqual(production.plugins, []);
    assert.equal(production.define, undefined);
    assert.ok(!JSON.stringify(production).includes('SHADOWPACT_TEST_SECRET_SENTINEL'));
  } finally {
    process.chdir(cwd);
    if (saved === undefined) delete process.env.TINYFISH_API_KEY; else process.env.TINYFISH_API_KEY = saved;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
