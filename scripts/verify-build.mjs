import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = 'dist/client';
const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
assert.match(html, /SEE WHAT IT TAKES/);
assert.match(html, /type="module"/);
for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) {
  assert.ok((await fs.stat(path.join(root, match[1]))).size > 0, 'Referenced browser assets must exist');
}
const model = await fs.readFile(path.join(root, 'assets/boy.glb'));
assert.equal(model.subarray(0, 4).toString(), 'glTF', 'The real 3D character must ship');
const forbidden = [/sk-tinyfish-[\w-]+/, /-----BEGIN (?:RSA )?PRIVATE KEY-----/, /art_v2_[\w-]+/, /SHADOWPACT_TEST_SECRET_SENTINEL/, /FIREBASE_SERVICE_ACCOUNT/, /api\.search\.tinyfish\.ai/];
async function inspect(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await inspect(file);
    else if (/\.(?:html|js|css|json|map|txt)$/.test(file)) {
      const text = await fs.readFile(file, 'utf8');
      for (const pattern of forbidden) assert.ok(!pattern.test(text), 'Server code or credentials found in ' + file);
    }
  }
}
await inspect(root);
for (const excluded of ['src/api.js', '.env', '.openai/hosting.json', 'netlify/functions/policy-sort.mjs']) {
  await assert.rejects(fs.stat(path.join(root, excluded)), { code: 'ENOENT' });
}
console.log('Verified: browser assets and real GLB are present; server code, credentials and hosting metadata are excluded.');
