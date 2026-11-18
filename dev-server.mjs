// Zero-dependency static dev server with live reload.
// Usage: npm run dev   (PORT=4000 npm run dev to change the port)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const LIVE_RELOAD = !process.argv.includes('--no-reload');
const START_PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
};

const RELOAD_SNIPPET = `<script>(()=>{const es=new EventSource('/__reload');es.onmessage=()=>location.reload();})();</script>`;
const clients = new Set();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (LIVE_RELOAD && url.pathname === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = normalize(join(ROOT, pathname));

  // Block path traversal outside the project folder.
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) {
      res.writeHead(301, { Location: pathname + '/' }).end();
      return;
    }
    let body = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    if (LIVE_RELOAD && type.startsWith('text/html')) {
      body = body.toString().replace('</body>', `${RELOAD_SNIPPET}</body>`);
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`404 — ${pathname} not found`);
  }
});

if (LIVE_RELOAD) {
  let timer;
  watch(ROOT, { recursive: true }, (_event, file) => {
    if (!file || file.includes('node_modules') || file.startsWith('.')) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`  ↻ ${file} changed — reloading`);
      clients.forEach((c) => c.write('data: reload\n\n'));
    }, 80);
  });
}

function listen(port) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`  Port ${port} is busy, trying ${port + 1}…`);
      listen(port + 1);
    } else {
      throw err;
    }
  });
  server.listen(port, () => {
    console.log(`\n  Ironcrest dev server running`);
    console.log(`  ➜ Local:  http://localhost:${port}/`);
    console.log(`  ${LIVE_RELOAD ? 'Live reload on — edit any file and the page refreshes.' : 'Live reload off.'}`);
    console.log(`  Press Ctrl+C to stop.\n`);
  });
}
listen(START_PORT);
