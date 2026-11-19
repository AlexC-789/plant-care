import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { serve } from './serve-static.mjs';

let server, base;
before(async () => {
  const parent = mkdtempSync(join(tmpdir(), 'static-'));
  writeFileSync(join(parent, 'package.json'), '{"secret":true}');
  const root = join(parent, 'dist');
  mkdirSync(join(root, '_expo/static/js'), { recursive: true });
  writeFileSync(join(root, 'index.html'), '<html>INDEX</html>');
  writeFileSync(join(root, '_expo/static/js/x.js'), 'console.log(1)');
  server = await serve(root, 0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('/ and unknown routes return index.html', async () => {
  for (const p of ['/', '/plant/abc']) {
    const r = await fetch(base + p);
    assert.equal(r.status, 200);
    assert.equal(await r.text(), '<html>INDEX</html>');
  }
});

test('a file is served with its content type', async () => {
  const r = await fetch(`${base}/_expo/static/js/x.js`);
  assert.match(r.headers.get('content-type'), /javascript/);
  assert.equal(await r.text(), 'console.log(1)');
});

test('path traversal is 404, plain and encoded', async () => {
  for (const p of ['/../package.json', '/%2e%2e/package.json', '/..%2fpackage.json']) {
    // fetch normalises plain dots, so send the raw path over a socket
    const { request } = await import('node:http');
    const status = await new Promise((res) => {
      const req = request({ host: '127.0.0.1', port: server.address().port, path: p, method: 'GET' }, (r) => (r.resume(), res(r.statusCode)));
      req.end();
    });
    assert.equal(status, 404, p);
  }
});
