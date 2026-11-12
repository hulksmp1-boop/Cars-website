/**
 * Phase 8B: generated hosting configuration is fresh, comes from tools/url-map.mjs, and says the same thing on every host.
 * Run: node tests/hosting-config.test.mjs
 *
 * What this DOES prove: the generated files are up to date, parse, contain exactly the redirects of url-map.mjs,
 * agree with each other and with tools/serve.mjs, cannot loop (checked on small simulators of the Cloudflare/Netlify,
 * Vercel, Apache and nginx rules), and carry identical cache and MIME policy.
 * What it does NOT prove: that a real Cloudflare, Vercel, Apache or nginx accepts and runs these files. No host software
 * is run here. See README "Hosting configuration" for what is verified and what is not.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const mod = (f) => import(pathToFileURL(join(ROOT, f)).href);
const { CARS, REDIRECTS } = await mod('tools/url-map.mjs');
const gen = await mod('tools/hosting-config.mjs');
const { route } = await mod('tools/serve.mjs');
const { CACHE, MIME } = gen;

let failures = 0;
const check = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { failures++; console.log('  FAIL', name, '\n       ', e.message); } };

const FILES = ['_headers', '_redirects', 'vercel.json', '.htaccess', 'deploy/nginx.conf'];
const QUERY = '3d=off&intro=on';
const REQUESTS = REDIRECTS.map((r) => r.from);

/* ---------- small simulators: each turns one generated file into a function path -> {status, location | file} ---------- */

// Cloudflare Pages / Netlify format: first exact match wins, no chaining. (Query pass-through is host behaviour, not simulated.)
function parseRedirectsFile(text) {
  return text.split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => {
    const [from, to, status] = l.trim().split(/\s+/);
    return { from, to, status: Number(status), raw: l };
  });
}
const cloudflare = (rules) => (path) => { const r = rules.find((x) => x.from === path); return r ? { status: r.status, location: r.to } : { status: 200, file: path }; };

// Vercel: explicit redirects, then rewrites; trailingSlash:false redirects '/x/' to '/x' on its own (status decided by Vercel).
function vercel(conf) {
  return (path) => {
    const red = conf.redirects.find((r) => r.source === path);
    if (red) return { status: red.statusCode, location: red.destination };
    if (conf.trailingSlash === false && path.length > 1 && path.endsWith('/')) return { status: 'platform', location: path.slice(0, -1) };
    const rw = conf.rewrites.find((r) => r.source === path);
    return { status: 200, file: rw ? rw.destination : path };
  };
}

// Apache per-directory mod_rewrite: rules run top to bottom on the path without its leading slash; a rewrite restarts the pass
// (that restart is exactly how the classic /x -> x.html loop happens). RewriteCond %{THE_REQUEST} sees the ORIGINAL request line.
function parseHtaccess(text) {
  const rules = []; let conds = [];
  for (const line of text.split('\n').map((l) => l.trim())) {
    const c = line.match(/^RewriteCond %\{THE_REQUEST\} (.+)$/);
    if (c) { conds.push(new RegExp(c[1])); continue; }
    const r = line.match(/^RewriteRule (\S+) (\S+) \[([^\]]*)\]$/);
    if (r) { rules.push({ conds, pattern: new RegExp(r[1]), target: r[2], flags: r[3].split(','), raw: line }); conds = []; }
  }
  return rules;
}
const apache = (rules, { ignoreConds = false } = {}) => (pathAndQuery) => {
  const [path, query] = pathAndQuery.split('?');
  const requestLine = `GET ${pathAndQuery} HTTP/1.1`;
  let current = path.replace(/^\//, '');
  for (let pass = 0; pass < 10; pass++) {
    const hit = rules.find((r) => r.pattern.test(current) && (ignoreConds || r.conds.every((c) => c.test(requestLine))));
    if (!hit) return { status: 200, file: '/' + current };
    if (hit.flags.some((f) => f.startsWith('R=301'))) return { status: 301, location: hit.target + (query !== undefined && !hit.target.includes('?') ? '?' + query : '') };
    current = hit.target; // internal rewrite, then the pass starts again
  }
  return { status: 508, loop: true };
};

// nginx: exact-match locations only for routes. `return 301 <uri>$is_args$args` keeps the query; `try_files <file> =404` serves that
// file in place (a first argument that is a file never triggers a new location lookup; only the last argument would).
function parseNginx(text) {
  const locs = [];
  for (const m of text.matchAll(/^\s*location = (\S+) \{ (.*?) \}$/gm)) {
    const body = m[2];
    const ret = body.match(/return 301 (\S+?)(\$is_args\$args);/);
    const tf = body.match(/try_files (\S+) =404;/);
    locs.push({ path: m[1], ret: ret ? { target: ret[1], keepsQuery: !!ret[2] } : null, tryFile: tf ? tf[1] : null, body });
  }
  return locs;
}
const nginx = (locs) => (pathAndQuery) => {
  const [path, query] = pathAndQuery.split('?');
  const loc = locs.find((l) => l.path === path);
  if (loc?.ret) return { status: 301, location: loc.ret.target + (loc.ret.keepsQuery && query !== undefined ? '?' + query : '') };
  if (loc?.tryFile) return { status: 200, file: loc.tryFile };
  return { status: 200, file: path };
};

const cfRules = parseRedirectsFile(read('_redirects'));
const vcConf = JSON.parse(read('vercel.json'));
const apRules = parseHtaccess(read('.htaccess'));
const ngLocs = parseNginx(read('deploy/nginx.conf'));
const cleanFile = (c) => '/' + c.file;

console.log('Hosting config: freshness and single source');

await check('all five generated files exist, are non-empty and match what the generator produces now', () => {
  const fresh = gen.generateAll();
  assert.deepEqual(Object.keys(fresh).sort(), [...FILES].sort());
  for (const f of FILES) { assert.ok(existsSync(join(ROOT, f)), `${f} missing`); assert.equal(read(f), fresh[f], `${f} is stale: run node tools/hosting-config.mjs`); }
});

await check('the generator is deterministic and its --check mode passes on the committed files', () => {
  assert.deepEqual(gen.generateAll(), gen.generateAll());
  const r = spawnSync(process.execPath, [join(ROOT, 'tools/hosting-config.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

await check('url-map.mjs is the single source: an extra redirect added there appears in every host format, and nothing is hard-coded', () => {
  const extra = [...REDIRECTS, { from: '/old-only', to: CARS[0].url, why: 'test' }];
  assert.ok(gen.renderRedirectsFile(extra).includes('/old-only'));
  assert.ok(JSON.parse(gen.renderVercelJson(extra)).redirects.some((r) => r.source === '/old-only'));
  assert.ok(gen.renderHtaccess(extra).includes('RewriteRule ^old-only$'));
  assert.ok(gen.renderNginx(extra).includes('location = /old-only {'));
  const src = read('tools/hosting-config.mjs');
  assert.ok(/from '\.\/url-map\.mjs'/.test(src));
  for (const c of CARS) assert.ok(!src.includes(c.slug), `generator hard-codes ${c.slug}`);
});

await check('every generated file carries the do-not-edit banner (JSON excepted: it has no comments)', () => {
  for (const f of FILES.filter((x) => x !== 'vercel.json')) assert.ok(/GENERATED by tools\/hosting-config\.mjs/.test(read(f)), f);
});

console.log('Hosting config: redirects are the same on every host');

await check('url-map.mjs still defines the 20 redirects of Phase 8A', () => assert.equal(REDIRECTS.length, 20));

await check('_redirects holds exactly the url-map rules, all explicit 301, static only (no splats, placeholders or query matching)', () => {
  assert.deepEqual(cfRules.map(({ from, to, status }) => ({ from, to, status })), REDIRECTS.map(({ from, to }) => ({ from, to, status: 301 })));
  for (const r of cfRules) assert.ok(!/[*:]/.test(r.from + r.to) && !r.to.includes('?'), r.raw);
});

await check('vercel.json: 16 explicit 301 rules; the 4 trailing-slash rules are left to trailingSlash:false; no cleanUrls', () => {
  const explicit = REDIRECTS.filter((r) => !r.from.endsWith('/'));
  assert.deepEqual(vcConf.redirects, explicit.map((r) => ({ source: r.from, destination: r.to, statusCode: 301 })));
  assert.equal(vcConf.trailingSlash, false);
  assert.ok(!('cleanUrls' in vcConf), 'cleanUrls would also redirect /collection.html');
  assert.equal(REDIRECTS.length - explicit.length, CARS.length);
  assert.deepEqual(vcConf.rewrites, CARS.map((c) => ({ source: c.url, destination: `/${c.file}` })));
});

await check('.htaccess and nginx.conf each hold exactly 20 redirect rules and 5 clean-URL rules, in url-map order', () => {
  const apRedirects = apRules.filter((r) => r.flags.includes('R=301'));
  assert.deepEqual(apRedirects.map((r) => r.target), REDIRECTS.map((r) => r.to));
  assert.deepEqual(apRules.filter((r) => !r.flags.includes('R=301')).map((r) => r.target), CARS.map((c) => c.file));
  assert.deepEqual(ngLocs.filter((l) => l.ret).map((l) => [l.path, l.ret.target]), REDIRECTS.map((r) => [r.from, r.to]));
  assert.deepEqual(ngLocs.filter((l) => l.tryFile && /^\/cars\/[\w-]+$/.test(l.path)).map((l) => [l.path, l.tryFile]), CARS.map((c) => [c.url, cleanFile(c)]));
});

await check('behaviour matrix: for all 20 old and variant URLs, Cloudflare, Apache, nginx and the local server answer 301 to the same clean URL', () => {
  const hosts = { cloudflare: cloudflare(cfRules), apache: apache(apRules), nginx: nginx(ngLocs) };
  for (const { from, to } of REDIRECTS) {
    const ref = route(from);
    assert.deepEqual([ref.status, ref.location], [301, to], `serve.mjs ${from}`);
    for (const [name, host] of Object.entries(hosts)) {
      const got = host(from);
      assert.deepEqual([got.status, got.location], [301, to], `${name} ${from}`);
    }
  }
});

await check('Vercel matrix: 16 URLs answer 301 to the clean URL; the 4 trailing-slash URLs are redirected by the platform to the same target path', () => {
  const v = vercel(vcConf);
  for (const { from, to } of REDIRECTS) {
    const got = v(from);
    if (from.endsWith('/')) assert.deepEqual([got.status, got.location], ['platform', to], from);
    else assert.deepEqual([got.status, got.location], [301, to], from);
  }
});

await check('clean URLs are served (not redirected) to the right file on every host, matching the local server', () => {
  const hosts = { cloudflare: null, vercel: vercel(vcConf), apache: apache(apRules), nginx: nginx(ngLocs) };
  for (const c of CARS) {
    assert.deepEqual(route(c.url), { status: 200, file: c.file });
    for (const [name, host] of Object.entries(hosts)) {
      if (!host) continue; // Cloudflare Pages serves extensionless URLs itself (documented, see README); no rule to test
      const got = host(c.url);
      assert.equal(got.status, 200, `${name} ${c.url}`);
      assert.equal(got.file.replace(/^\//, ''), c.file, `${name} ${c.url}`);
    }
    assert.ok(existsSync(join(ROOT, c.file)), c.file);
  }
});

console.log('Hosting config: query strings and redirect loops');

await check('query strings survive on Apache and nginx for all 20 redirects (simulated); no redirect target carries its own query', () => {
  for (const [name, host] of Object.entries({ apache: apache(apRules), nginx: nginx(ngLocs) })) {
    for (const { from, to } of REDIRECTS) assert.equal(host(`${from}?${QUERY}`).location, `${to}?${QUERY}`, `${name} ${from}`);
  }
  for (const r of ngLocs.filter((l) => l.ret)) assert.ok(r.ret.keepsQuery, `${r.path} drops the query`);
  for (const r of [...cfRules, ...vcConf.redirects]) assert.ok(!(r.to ?? r.destination).includes('?'), 'a destination query would replace the visitor\'s');
});

await check('no loops in the data: no self-redirect, no chain, unique sources, every target is a clean car URL; the generator refuses bad data', () => {
  gen.assertNoLoops();
  const from = new Set(REDIRECTS.map((r) => r.from));
  assert.equal(from.size, REDIRECTS.length);
  for (const r of REDIRECTS) { assert.notEqual(r.from, r.to); assert.ok(!from.has(r.to), `${r.to} is also a source`); }
  assert.throws(() => gen.assertNoLoops([{ from: '/a', to: '/cars/bmw-m5' }, { from: '/cars/bmw-m5', to: '/cars/bmw-m5' }]), /loop|chain/);
  assert.throws(() => gen.assertNoLoops([{ from: '/a', to: '/cars/bmw-m5' }, { from: '/cars/bmw-m5', to: '/cars/porsche-911' }]), /chain/);
  assert.throws(() => gen.assertNoLoops([{ from: '/a', to: '/cars/bmw-m5' }, { from: '/a', to: '/cars/bmw-m5' }]), /duplicate/);
  assert.throws(() => gen.assertNoLoops([{ from: '/a', to: '/nowhere' }]), /clean car URL/);
});

await check('following redirects ends after one hop everywhere (cloudflare, apache, nginx); a clean URL is never redirected again', () => {
  for (const [name, host] of Object.entries({ cloudflare: cloudflare(cfRules), apache: apache(apRules), nginx: nginx(ngLocs) })) {
    for (const { from, to } of REDIRECTS) { assert.equal(host(from).status, 301); const next = host(to); assert.ok(next.status === 200 && !next.loop, `${name}: ${to} answers ${next.status}`); }
  }
  const v = vercel(vcConf);
  for (const c of CARS) assert.equal(v(c.url).status, 200);
});

await check('Apache guard is load-bearing: without the THE_REQUEST condition the internal rewrite to cars/<slug>.html would redirect again (loop); with it, it does not', () => {
  const unguarded = apache(apRules, { ignoreConds: true });
  const guarded = apache(apRules);
  for (const c of CARS) {
    assert.equal(guarded(c.url).status, 200, c.url);
    assert.notEqual(unguarded(c.url).status, 200, `${c.url}: the loop this guard prevents did not appear, so the guard proves nothing`);
  }
  for (const r of apRules.filter((x) => x.flags.includes('R=301'))) assert.equal(r.conds.length, 1, r.raw);
});

await check('nginx: clean-URL locations serve the .html file as the first try_files argument (served in place, so no second lookup hits its redirect); other slash-ending paths 404', () => {
  const text = read('deploy/nginx.conf');
  for (const c of CARS) assert.ok(new RegExp(`location = ${c.url} \\{[^}]*try_files /${c.file.replace('.', '\\.')} =404;`).test(text), c.url);
  assert.ok(/location ~ \^\/\.\+\/\$ \{ return 404; \}/.test(text));
  assert.ok(/absolute_redirect off;/.test(text) && /error_page 404 \/404\.html;/.test(text));
  for (const l of ngLocs) assert.ok(!(l.ret && l.tryFile), `${l.path} both redirects and serves`);
});

console.log('Hosting config: cache and MIME policy');

const walk = (dir) => readdirSync(join(ROOT, dir)).flatMap((n) => {
  const rel = dir ? `${dir}/${n}` : n;
  return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
});
const SITE_FILES = ['index.html', 'collection.html', '404.html', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'site.webmanifest',
  ...['cars', 'css', 'js', 'assets'].flatMap(walk)].filter((f) => extname(f) !== '.md');
const matchesPattern = (url, p) => (p.endsWith('/*') ? url.startsWith(p.slice(0, -1)) : url === p);
const groupByPath = (file) => { const url = file === 'index.html' ? '/' : '/' + file; return Object.entries(CACHE).find(([, g]) => g.paths.some((p) => matchesPattern(url, p)))?.[0] ?? null; };
const groupByExt = (file) => Object.entries(CACHE).find(([, g]) => g.exts.includes(extname(file).slice(1)))?.[0] ?? null;

await check('the cache table is internally consistent: the URL-pattern groups and the extension groups pick the same group for every deployable file', () => {
  assert.ok(SITE_FILES.length > 60);
  for (const f of SITE_FILES) {
    const byPath = groupByPath(f), byExt = groupByExt(f);
    if (['robots.txt', 'sitemap.xml', 'site.webmanifest'].includes(f)) { assert.equal(byPath, null, f); assert.equal(byExt, null, f); continue; }
    assert.equal(byPath, byExt, `${f}: by path ${byPath}, by extension ${byExt}`);
    assert.ok(byPath, `${f} has no cache group`);
  }
  const all = Object.values(CACHE).flatMap((g) => g.paths);
  assert.equal(new Set(all).size, all.length, 'a path is in two groups');
});

await check('_headers: one Cache-Control per rule, values and paths equal the table, disjoint rules, within Cloudflare limits (100 rules, 2,000 chars)', () => {
  const lines = read('_headers').split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  const rules = []; for (const l of lines) { if (!l.startsWith(' ')) rules.push({ path: l.trim(), headers: [] }); else rules.at(-1).headers.push(l.trim()); }
  assert.deepEqual(rules.map((r) => [r.path, r.headers]), Object.values(CACHE).flatMap((g) => g.paths.map((p) => [p, [`Cache-Control: ${g.value}`]])));
  assert.ok(rules.length <= 100 && lines.every((l) => l.length <= 2000));
  const files = SITE_FILES.map((f) => (f === 'index.html' ? '/' : '/' + f));
  for (const u of [...files, ...CARS.map((c) => c.url)]) assert.ok(Object.values(CACHE).flatMap((g) => g.paths).filter((p) => matchesPattern(u, p)).length <= 1, `${u} matches two rules, so Cloudflare would merge two Cache-Control values`);
});

await check('vercel.json, .htaccess and nginx.conf carry the same cache values for the same files as _headers', () => {
  const want = (u) => { const g = Object.values(CACHE).find((x) => x.paths.some((p) => matchesPattern(u, p))); return g?.value; };
  // Vercel: source patterns '/cars/(.*)' are the '/cars/*' paths
  const toPath = (s) => s.replace(/\/\(\.\*\)$/, '/*');
  assert.deepEqual(vcConf.headers.map((h) => [toPath(h.source), h.headers]), Object.values(CACHE).flatMap((g) => g.paths.map((p) => [p, [{ key: 'Cache-Control', value: g.value }]])));
  // Apache: by extension
  const ap = [...read('.htaccess').matchAll(/<FilesMatch "\\\.\(([^)]*)\)\$">\s*Header set Cache-Control "([^"]*)"/g)].map((m) => [m[1].split('|'), m[2]]);
  assert.deepEqual(ap, Object.values(CACHE).map((g) => [g.exts, g.value]));
  // nginx: location by location
  const ng = read('deploy/nginx.conf');
  for (const [u, loc] of [['/', 'location = /'], ['/collection.html', 'location = /collection.html'], ['/404.html', 'location = /404.html'], ['/favicon.ico', 'location = /favicon.ico'], ['/css/x', 'location /css/'], ['/js/x', 'location /js/'], ['/assets/x', 'location /assets/'], ...CARS.map((c) => [c.url, `location = ${c.url}`])]) {
    assert.ok(ng.includes(`${loc} { add_header Cache-Control "${want(u)}";`), `${loc} must send "${want(u)}"`);
  }
  assert.equal([...ng.matchAll(/add_header /g)].length, 5 + 7, 'unexpected extra add_header');
});

await check('MIME: nginx types{} and Apache AddType agree with the MIME table, and every file extension the site ships has a type', () => {
  const ngTypes = Object.fromEntries([...read('deploy/nginx.conf').matchAll(/^\s{4}(\S+)\s+(\w+);$/gm)].map((m) => [m[2], m[1]]));
  assert.deepEqual(ngTypes, MIME);
  for (const [, type, ext] of read('.htaccess').matchAll(/AddType (\S+) \.(\w+)/g)) assert.equal(MIME[ext], type, `.${ext}`);
  for (const ext of new Set(SITE_FILES.map((f) => extname(f).slice(1)))) assert.ok(MIME[ext], `no MIME type for .${ext}`);
  assert.equal(MIME.glb, 'model/gltf-binary'); assert.equal(MIME.webmanifest, 'application/manifest+json');
});

console.log('Hosting config: scope and packaging');

await check('scope guard: no security headers, CSP, HSTS or SEO tags in any generated file (later phases)', () => {
  const banned = /content-security-policy|strict-transport|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|cross-origin|x-robots-tag|canonical|sitemap/i;
  for (const f of FILES) assert.ok(!banned.test(read(f)), `${f} mentions out-of-scope headers`);
});

await check('Cloudflare Pages limits: <= 2,000 static redirects (1,000 characters per line); redirect rules are static, so none counts against the 100 dynamic limit', () => {
  assert.ok(cfRules.length <= 2000);
  for (const r of cfRules) assert.ok(r.raw.length <= 1000 && !/[*:]/.test(r.from));
});

await check('prepare-launch --dist ships _headers, _redirects, vercel.json and .htaccess, and leaves deploy/ and tools/ out', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'aether-8b-'));
  try {
    const copy = join(tmp, 'site');
    cpSync(ROOT, copy, { recursive: true, filter: (src) => !/[\\/](screenshots|models)([\\/]|$)/.test(src) || /README/.test(src) });
    const run = spawnSync(process.execPath, [join(copy, 'tools/prepare-launch.mjs'), 'https://example.test', '--dist', join(tmp, 'dist')], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    for (const f of ['_headers', '_redirects', 'vercel.json', '.htaccess']) assert.equal(readFileSync(join(tmp, 'dist', f), 'utf8'), read(f), `dist/${f}`);
    assert.ok(!existsSync(join(tmp, 'dist', 'deploy')) && !existsSync(join(tmp, 'dist', 'tools')) && !existsSync(join(tmp, 'dist', 'tests')));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
