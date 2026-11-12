/**
 * AETHER GT — Local reference server (Phase 8A: clean URLs only).
 *
 *   node tools/serve.mjs [--port 8080] [--root .]
 *
 * Does exactly what a production host must do for the clean URLs, and nothing else:
 *   /cars/<slug>                 -> serves cars/<slug>.html (200, no redirect)
 *   old and variant URLs         -> 301 to the clean URL, query string preserved (see tools/url-map.mjs)
 *   anything unknown             -> 404.html with status 404
 * No security headers or CSP yet (a later Phase 8 step). Static files only; paths cannot leave --root.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARS, REDIRECTS } from './url-map.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
};
const redirects = new Map(REDIRECTS.map((r) => [r.from, r.to]));
const cleanFiles = new Map(CARS.map((c) => [c.url, c.file]));

/** @returns {{status:number, location?:string, file?:string}} what a host should do for this request path */
export function route(pathname) {
  if (redirects.has(pathname)) return { status: 301, location: redirects.get(pathname) };
  if (cleanFiles.has(pathname)) return { status: 200, file: cleanFiles.get(pathname) };
  if (pathname === '/') return { status: 200, file: 'index.html' };
  return { status: 200, file: pathname.slice(1) }; // static file; missing -> 404 below
}

export function createSite(root) {
  const base = resolve(root);
  return createServer(async (req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end('Bad request'); return; }
    const search = new URL(req.url, 'http://x').search;
    const r = route(pathname);
    if (r.status === 301) { res.writeHead(301, { Location: r.location + search }).end(); return; }

    const target = resolve(join(base, normalize(r.file)));
    let file = target;
    let status = 200;
    const inside = target === base || target.startsWith(base + sep);
    let ok = false;
    if (inside) { try { ok = (await stat(target)).isFile(); } catch { ok = false; } }
    if (!ok) { file = join(base, '404.html'); status = 404; }
    try {
      const body = await readFile(file);
      res.writeHead(status, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404).end('Not found'); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : fallback; };
  const root = resolve(arg('--root', join(dirname(fileURLToPath(import.meta.url)), '..')));
  const port = Number(arg('--port', 8080));
  createSite(root).listen(port, () => console.log(`AETHER GT: http://localhost:${port}/  (root: ${root})`));
}
