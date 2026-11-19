// Serves the `expo export --platform web` build for the speed tests (a dev server is not representative).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATIC_PORT = 8082;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

export function serve(dir, port) {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    let path;
    try {
      path = resolve(join(root, decodeURIComponent(req.url.split('?')[0])));
    } catch {
      path = null;
    }
    if (!path || (path !== root && !path.startsWith(root + sep))) {
      res.writeHead(404).end();
      return;
    }
    const isFile = await stat(path).then((s) => s.isFile(), () => false);
    const file = isFile ? path : join(root, 'index.html'); // client-side routes fall back to the app shell
    try {
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await serve(join(import.meta.dirname, '../dist'), STATIC_PORT);
  console.log(`serving apps/mobile/dist on http://localhost:${STATIC_PORT}`);
}
