#!/usr/bin/env node
// ★★ THE EDGE'S TTFB RULER — the same measurement BEFORE the HTML goes to the edge and AFTER, from wherever
// it is run.
//
//   node bin/edge-ttfb.mjs                                   # the four public fronts, 10 samples per route
//   node bin/edge-ttfb.mjs --host cafe.forgecommerce.pro --samples 20 --json out.json
//   node bin/edge-ttfb.mjs --label vpn-frankfurt --json fra.json
//   node bin/edge-ttfb.mjs --check-flight                    # the RSC-poisoning check, no timings
//
// ── WHY IT EXISTS, AND WHY NOW (sprint 01 of Forge v0.4, card EDGE-CDN-HTML, 2026-10-23) ──────────────────
//
// The product is moving the storefront's HTML onto the CDN. This box only turns that on when it adopts the
// next release, so "before × after" — and the measurement from far away over a VPN — needs a ruler that
// exists TODAY, is run today (the BEFORE) and is run again, unchanged, after the cut (the AFTER). A ruler
// written after the change measures nothing it can compare against.
//
// Measured 2026-10-23 from São Paulo against production: `store.` and `cafe.forgecommerce.pro` sit behind
// Cloudflare, `outlet.store.` and `totem.cafe.` do not (no `cf-ray`, no `cf-cache-status`). The HTML answers
// `cf-cache-status: DYNAMIC` with `cache-control: s-maxage=60, stale-while-revalidate=…` — cacheable by its
// header, never stored by the edge. That is the baseline this file records.
//
// ── ★ WHY `node:https` AND NOT `curl -w` ─────────────────────────────────────────────────────────────────
//
// `curl -w` gives the same five numbers, but it is a second binary whose version and HTTP default (h2 vs
// h1.1) vary per machine — the far-away run will be on SOMEONE ELSE'S laptop — and its output still has to be
// parsed here, headers included. `node:https` is already the floor this repository requires, the phases are
// the socket's own events (`lookup`, `connect`, `secureConnect`, first `data`), and the pure half is testable
// without a network. ⚠️ The cost, stated: it speaks HTTP/1.1, a browser speaks h2/h3. Every sample opens a
// FRESH connection (no keep-alive) on purpose, so DNS/TCP/TLS are paid each time and the two runs compare.
//
// ── ⚠️ WHAT IT DOES NOT DO ───────────────────────────────────────────────────────────────────────────────
//
// Only public GETs, no cookie, no login, sequential — never in parallel, never in a loop. It does not follow
// redirects (a 3xx is reported as the answer it is). Category and PDP routes are DISCOVERED from each store's
// home (`discoverRoutes`), so a different store gets its own routes and none is typed here. A store whose home
// links no category (the coffee shop links products directly) gets a row saying so, not an invented route.

import { request } from 'node:https';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DEFAULT_HOSTS = [
  'store.forgecommerce.pro', // behind the edge
  'cafe.forgecommerce.pro', // behind the edge
  'outlet.store.forgecommerce.pro', // no edge
  'totem.cafe.forgecommerce.pro', // no edge
];

/** The headers that say WHO answered: the edge, the Next cache, or the origin. */
export const WHO_HEADERS = ['cf-cache-status', 'age', 'cache-control', 'cdn-cache-control', 'x-nextjs-cache'];

/** Statuses with which Cloudflare says it SERVED or KEPT the object — anything else (DYNAMIC, BYPASS, absent) means the edge did not store it. */
const EDGE_STORED = new Set(['HIT', 'MISS', 'EXPIRED', 'STALE', 'UPDATING', 'REVALIDATED']);

const USER_AGENT = 'forge-demo-edge-ttfb/1 (+bin/edge-ttfb.mjs)';

/**
 * Nearest-rank percentile: the smallest sample such that at least q% of the samples are ≤ it. With 10 samples
 * p50 is the 5th and p95 the 10th — no interpolation, so every number printed was actually measured.
 */
export function percentile(values, q) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const rank = Math.ceil((q / 100) * xs.length);
  return xs[Math.min(xs.length, Math.max(1, rank)) - 1];
}

/** `cf-ray: a4eff10ff8cc311f-GRU` → `GRU` (the airport code of the Cloudflare colo). No ray → null: no edge. */
export function coloFromRay(ray) {
  if (typeof ray !== 'string') return null;
  const m = /-([A-Z]{3})$/.exec(ray.trim());
  return m ? m[1] : null;
}

/**
 * The first path segments the PRODUCT owns on every store — never a category or a product. These are the
 * platform's routes, not this store's, so naming them is not naming a store's catalogue.
 */
const NOT_CATALOG = new Set(['api', 'account', 'checkout', 'cart', 'search', 'cdn-cgi', 'apps', 'feeds', 'ui-checkout']);

/** Same-origin paths linked from an HTML page, query and fragment dropped, assets and platform routes out. In document order, unique. */
export function catalogPaths(html) {
  const seen = new Set();
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*"([^"]*)"/gi)) {
    const href = m[1];
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const path = href.split(/[?#]/)[0].replace(/\/+$/, '');
    if (path === '') continue;
    const segments = path.split('/').slice(1);
    if (segments.some((s) => s === '' || s.startsWith('_'))) continue;
    if (/\.[a-z0-9]{2,5}$/i.test(path)) continue;
    if (NOT_CATALOG.has(segments[0])) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    out.push(path);
  }
  return out;
}

/**
 * Category and PDP, read from the shape of the home's links — not from any route typed here.
 *
 *   PDP       the first link, in document order, among the DEEPEST leaves (a leaf is a path no other linked
 *             path descends from). A product page is the end of a branch; on the shoe store that is
 *             `/<category>/<sub>/<slug>`, on the coffee shop `/p/<slug>`.
 *   category  the PDP's parent when the home links it (the listing the product sits in); otherwise the
 *             most-linked path that has linked descendants; otherwise null — a home that links products
 *             straight away has no category to measure, and the row says so.
 *
 * Informational pages (`/faq`, `/sobre`, …) are single-segment leaves and never win "deepest" over a product
 * that has a parent; a home that linked nothing deeper than one segment has no PDP either.
 */
export function discoverRoutes(html) {
  const paths = catalogPaths(html);
  const depth = (p) => p.split('/').length - 1;
  const hasDescendant = (p) => paths.some((q) => q !== p && q.startsWith(`${p}/`));
  const leaves = paths.filter((p) => !hasDescendant(p) && depth(p) >= 2);
  const maxDepth = Math.max(0, ...leaves.map(depth));
  const pdp = leaves.find((p) => depth(p) === maxDepth) ?? null;

  let category = null;
  if (pdp) {
    const parent = pdp.slice(0, pdp.lastIndexOf('/'));
    if (paths.includes(parent)) category = parent;
  }
  if (!category) {
    const counts = new Map();
    for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*"(\/[^"?#]*)/gi)) {
      const p = m[1].replace(/\/+$/, '');
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    const branches = paths.filter(hasDescendant);
    branches.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
    category = branches[0] ?? null;
  }
  return { category, pdp };
}

/** Distinct values of a header across samples: `DYNAMIC` when unanimous, `STALE×6 HIT×4` when not, `—` when absent. */
export function summarizeHeader(values) {
  const counts = new Map();
  for (const v of values) counts.set(v ?? '—', (counts.get(v ?? '—') ?? 0) + 1);
  if (counts.size === 1) return [...counts.keys()][0];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([v, n]) => `${v}×${n}`)
    .join(' ');
}

/**
 * Whether a response is cacheable BY THE EDGE according to its own headers. `CDN-Cache-Control` (RFC 9213)
 * wins when present; otherwise `Cache-Control` — `private`/`no-store` say no, `s-maxage` or a public
 * `max-age>0` say yes.
 */
export function edgeCacheableByHeader(headers) {
  const directives = (v) => String(v ?? '').toLowerCase();
  const cdn = headers['cdn-cache-control'];
  if (cdn != null) {
    const d = directives(cdn);
    if (/\b(no-store|private)\b/.test(d)) return false;
    return /\b(s-)?max-age=[1-9]/.test(d);
  }
  const cc = directives(headers['cache-control']);
  if (/\b(no-store|private|no-cache)\b/.test(cc)) return false;
  return /\bs-maxage=[1-9]/.test(cc) || (/\bpublic\b/.test(cc) && /\bmax-age=[1-9]/.test(cc));
}

/** Did the edge store it? Only Cloudflare's own status says; no status means no edge in front. */
export function edgeStored(headers) {
  const s = headers['cf-cache-status'];
  if (!s) return null;
  return EDGE_STORED.has(String(s).toUpperCase());
}

const ms = (a, b) => (a == null || b == null ? null : Number(b - a) / 1e6);

/** One GET on a fresh connection, timed by the socket's own events. Never throws: a failure is a sample with `error`. */
export function timedGet(host, path, { headers = {}, timeoutMs = 20000, keepBody = false } = {}) {
  return new Promise((resolve) => {
    const t = { start: process.hrtime.bigint() };
    let body = keepBody ? [] : null;
    let settled = false;
    const done = (extra) => {
      if (settled) return;
      settled = true;
      t.end = process.hrtime.bigint();
      resolve({
        dns: ms(t.start, t.lookup),
        connect: ms(t.lookup ?? t.start, t.connect),
        tls: ms(t.connect, t.secure),
        ttfb: ms(t.start, t.firstByte),
        total: ms(t.start, t.end),
        ...extra,
      });
    };
    const req = request(
      {
        host,
        path,
        method: 'GET',
        agent: false,
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml',
          'accept-encoding': 'gzip, br',
          ...headers,
        },
      },
      (res) => {
        res.on('data', (chunk) => body && body.push(chunk));
        res.on('end', () =>
          done({ status: res.statusCode, headers: res.headers, body: body ? Buffer.concat(body) : undefined }),
        );
        res.on('error', (error) => done({ status: res.statusCode, headers: res.headers, error: error.message }));
      },
    );
    req.on('socket', (socket) => {
      socket.once('lookup', () => (t.lookup = process.hrtime.bigint()));
      socket.once('connect', () => (t.connect = process.hrtime.bigint()));
      socket.once('secureConnect', () => (t.secure = process.hrtime.bigint()));
      socket.once('data', () => (t.firstByte = process.hrtime.bigint()));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout after ${timeoutMs} ms`)));
    req.on('error', (error) => done({ error: error.message }));
    req.end();
  });
}

/** The home's HTML, decompressed — discovery needs the text, so this one GET asks for identity encoding. */
async function fetchHome(host) {
  const r = await timedGet(host, '/', { headers: { 'accept-encoding': 'identity' }, keepBody: true });
  return { status: r.status, html: r.body ? r.body.toString('utf8') : '', error: r.error };
}

/**
 * Where this run is FROM, asked of the measured edge itself (`/cdn-cgi/trace` on the first host behind
 * Cloudflare) — no third-party service. It gives the public IP, the country and the colo; it does not give an
 * ASN, so ASN is never printed. A run with no edged host in it has only its `--label`.
 */
async function whereFrom(hosts) {
  for (const host of hosts) {
    const r = await timedGet(host, '/cdn-cgi/trace', { headers: { accept: 'text/plain', 'accept-encoding': 'identity' }, keepBody: true });
    if (r.status !== 200 || !r.body) continue;
    const kv = Object.fromEntries(
      r.body
        .toString('utf8')
        .split('\n')
        .map((l) => l.split('='))
        .filter((p) => p.length === 2),
    );
    if (kv.ip) return { ip: kv.ip, country: kv.loc ?? null, colo: kv.colo ?? null, via: `https://${host}/cdn-cgi/trace` };
  }
  return null;
}

/**
 * A redirect's `location`, as a path on THIS host — or null when it leaves the host (or is not a redirect
 * target at all). Relative and absolute same-host forms are both what a store answers.
 */
export function sameHostPath(host, location) {
  if (typeof location !== 'string' || location === '') return null;
  let url;
  try {
    url = new URL(location, `https://${host}/`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.host !== host) return null;
  return `${url.pathname}${url.search}`;
}

/**
 * A discovered link may not be the page itself: measured 2026-10-23, the coffee shop's home links
 * `/p/<slug>` and that answers `308 → /pra_levar/<slug>`. Timing the 308 would measure a redirect, not a PDP,
 * so discovery follows same-host redirects (at most 3) ONCE and the samples go to the page that renders. The
 * linked form is kept in the output (`linkedAs`) — the redirect is real cost a shopper pays, and it is named.
 */
async function resolveRoute(host, route) {
  let path = route;
  for (let hop = 0; hop < 3 && path; hop++) {
    const r = await timedGet(host, path);
    if (!(r.status >= 300 && r.status < 400)) break;
    const next = sameHostPath(host, r.headers?.location);
    if (!next) break;
    path = next;
  }
  return path;
}

/** The routes to measure on one host: the fixed TYPES the brief names, plus the two discovered ones. */
async function routesFor(host) {
  const home = await fetchHome(host);
  const found = home.status === 200 ? discoverRoutes(home.html) : { category: null, pdp: null };
  const resolved = async (type, linked) => {
    if (!linked) return { type, route: null };
    const route = await resolveRoute(host, linked);
    return route === linked ? { type, route } : { type, route, linkedAs: linked };
  };
  return [
    { type: 'home', route: '/' },
    await resolved('category', found.category),
    await resolved('pdp', found.pdp),
    { type: 'faq', route: '/faq' },
    { type: 'checkout', route: '/checkout' },
  ];
}

async function measureRoute(host, { type, route, linkedAs }, samples) {
  if (!route) return { host, type, route: null, note: 'not discovered from the home' };
  const runs = [];
  for (let i = 0; i < samples; i++) runs.push(await timedGet(host, route));
  const col = (k) => runs.map((r) => r[k]);
  const h = (name) => runs.map((r) => (r.headers ? r.headers[name] : undefined));
  return {
    host,
    type,
    route,
    ...(linkedAs ? { linkedAs } : {}),
    samples: runs.length,
    errors: runs.filter((r) => r.error).map((r) => r.error),
    status: summarizeHeader(col('status')),
    ttfb: { p50: percentile(col('ttfb'), 50), p95: percentile(col('ttfb'), 95) },
    total: { p50: percentile(col('total'), 50), p95: percentile(col('total'), 95) },
    dns: { p50: percentile(col('dns'), 50) },
    connect: { p50: percentile(col('connect'), 50) },
    tls: { p50: percentile(col('tls'), 50) },
    headers: Object.fromEntries(WHO_HEADERS.map((n) => [n, summarizeHeader(h(n))])),
    colo: summarizeHeader(h('cf-ray').map((r) => coloFromRay(r) ?? undefined)),
    raw: runs.map(({ dns, connect, tls, ttfb, total, status, error, headers }) => ({
      dns, connect, tls, ttfb, total, status, error,
      'cf-cache-status': headers?.['cf-cache-status'], age: headers?.age, 'x-nextjs-cache': headers?.['x-nextjs-cache'],
    })),
  };
}

/**
 * `RSC: 1` WITHOUT `?_rsc=` on a catalogue route — the request that can put a Flight payload under the HTML's
 * cache key. Two GETs: the second shows whether the edge KEPT the first. Expected on 2026-10-23: cacheable by
 * the header, DYNAMIC at the edge (not stored). Expected after the cut: `no-store` for the edge.
 */
async function checkFlight(host, { type, route, linkedAs }) {
  if (!route) return { host, type, route: null, note: 'not discovered from the home' };
  const tries = [];
  for (let i = 0; i < 2; i++) tries.push(await timedGet(host, route, { headers: { rsc: '1', accept: '*/*' } }));
  const last = tries[tries.length - 1];
  const hd = last.headers ?? {};
  const flight = /text\/x-component/.test(String(hd['content-type'] ?? ''));
  const cacheable = edgeCacheableByHeader(hd);
  const stored = edgeStored(hd);
  return {
    host,
    type,
    route,
    ...(linkedAs ? { linkedAs } : {}),
    status: last.status ?? last.error,
    'content-type': hd['content-type'] ?? null,
    'cache-control': hd['cache-control'] ?? null,
    'cdn-cache-control': hd['cdn-cache-control'] ?? null,
    'cf-cache-status': tries.map((t) => t.headers?.['cf-cache-status'] ?? '—').join(' → '),
    vary: hd.vary ?? null,
    flight,
    edgeCacheableByHeader: cacheable,
    edgeStored: stored,
    verdict: !flight
      ? 'not a Flight payload'
      : !cacheable
        ? 'SAFE: not cacheable by the edge'
        : stored === true
          ? 'POISONABLE: Flight payload cacheable AND stored by the edge'
          : stored === false
            ? 'cacheable by header, edge does not store (DYNAMIC)'
            : 'cacheable by header, no edge in front',
  };
}

const fmt = (v) => (v == null ? '—' : v.toFixed(0));
/** `↪` marks a route reached through a redirect from the linked form (the JSON carries `linkedAs`). */
const shortRoute = (r) => {
  const s = `${r.linkedAs ? '↪' : ''}${r.route}`;
  return s.length > 40 ? `${s.slice(0, 39)}…` : s;
};

function stampLines(stamp) {
  return [
    `# edge-ttfb · ${stamp.at} · mode ${stamp.mode}${stamp.samples ? ` · ${stamp.samples} samples/route` : ''}`,
    `# from: ${stamp.from ? `${stamp.from.ip} (${stamp.from.country ?? '?'}, edge colo ${stamp.from.colo ?? '?'})` : 'unknown'}${stamp.label ? ` · label "${stamp.label}"` : ''} · node ${stamp.node}`,
    `# demo version: ${stamp.demoVersion ?? 'not exposed by any public face (omitted)'}`,
  ];
}

export function renderTable(rows) {
  const cols = ['host', 'type', 'route', 'status', 'ttfb p50', 'ttfb p95', 'dns', 'conn', 'tls', 'total p50', 'cf-cache-status', 'age', 'x-nextjs-cache', 'colo', 'cache-control'];
  const lines = rows.map((r) =>
    r.route == null
      ? [r.host, r.type, `— (${r.note})`, '—', '', '', '', '', '', '', '', '', '', '', '']
      : [
          r.host, r.type, shortRoute(r), String(r.status),
          fmt(r.ttfb.p50), fmt(r.ttfb.p95), fmt(r.dns.p50), fmt(r.connect.p50), fmt(r.tls.p50), fmt(r.total.p50),
          r.headers['cf-cache-status'], r.headers.age, r.headers['x-nextjs-cache'], r.colo, r.headers['cache-control'],
        ],
  );
  return table(cols, lines);
}

export function renderFlight(rows) {
  const cols = ['host', 'type', 'route', 'status', 'content-type', 'cache-control', 'cdn-cache-control', 'cf-cache-status', 'verdict'];
  const lines = rows.map((r) =>
    r.route == null
      ? [r.host, r.type, `— (${r.note})`, '—', '', '', '', '', '']
      : [r.host, r.type, shortRoute(r), String(r.status), r['content-type'] ?? '—', r['cache-control'] ?? '—', r['cdn-cache-control'] ?? '—', r['cf-cache-status'], r.verdict],
  );
  return table(cols, lines);
}

function table(cols, lines) {
  const widths = cols.map((c, i) => Math.max(c.length, ...lines.map((l) => String(l[i] ?? '').length)));
  const row = (cells) => cells.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ').trimEnd();
  return [row(cols), row(widths.map((w) => '-'.repeat(w))), ...lines.map(row)].join('\n');
}

function parseArgs(argv) {
  const opts = { hosts: [], samples: 10, json: null, label: null, checkFlight: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v == null) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--host') opts.hosts.push(next());
    else if (a === '--samples') opts.samples = Number(next());
    else if (a === '--json') opts.json = next();
    else if (a === '--label') opts.label = next();
    else if (a === '--check-flight') opts.checkFlight = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else throw new Error(`unknown argument ${a}`);
  }
  if (!Number.isInteger(opts.samples) || opts.samples < 1 || opts.samples > 50) throw new Error('--samples must be an integer from 1 to 50');
  if (opts.hosts.length === 0) opts.hosts = DEFAULT_HOSTS;
  return opts;
}

const HELP = `usage: node bin/edge-ttfb.mjs [--host <h>]... [--samples N] [--json <file>] [--label <where>] [--check-flight]

  --host          a host to measure (repeatable); default: ${DEFAULT_HOSTS.join(', ')}
  --samples       sequential GETs per route (default 10, max 50)
  --json          also write the full result (every sample) to this file
  --label         where this run is from, e.g. "vpn-frankfurt" — stamped on the output
  --check-flight  instead of timing: GET each catalogue route with "RSC: 1" and no ?_rsc=, and report
                  whether that Flight answer is cacheable/stored by the edge

Columns: ttfb p50/p95, dns, conn, tls, total in ms (nearest-rank percentiles; dns/conn/tls/total are p50).
cf-cache-status/age/x-nextjs-cache/cache-control say WHO answered; colo is the cf-ray airport suffix (— = no edge).
A header that varied across samples prints as VALUE×count. ↪ = the home links a form that redirects here.`;

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`edge-ttfb: ${error.message}\n\n${HELP}`);
    process.exit(2);
  }
  if (opts.help) {
    console.log(HELP);
    return;
  }
  const stamp = {
    at: new Date().toISOString(),
    mode: opts.checkFlight ? 'check-flight' : 'ttfb',
    samples: opts.checkFlight ? null : opts.samples,
    label: opts.label,
    from: await whereFrom(opts.hosts),
    node: process.version,
    // Measured 2026-10-23: neither the fronts' headers nor the kernel's `/health` carry a version, so there
    // is nothing to read. Kept as a field so the AFTER run can fill it the day a face exposes one.
    demoVersion: null,
  };
  const rows = [];
  for (const host of opts.hosts) {
    const routes = await routesFor(host);
    for (const r of routes) {
      if (opts.checkFlight) {
        if (['home', 'category', 'pdp'].includes(r.type)) rows.push(await checkFlight(host, r));
      } else {
        rows.push(await measureRoute(host, r, opts.samples));
      }
      process.stderr.write('.');
    }
  }
  process.stderr.write('\n');
  console.log(stampLines(stamp).join('\n'));
  console.log(opts.checkFlight ? renderFlight(rows) : renderTable(rows));
  if (opts.json) {
    writeFileSync(opts.json, `${JSON.stringify({ stamp, rows }, null, 2)}\n`);
    console.error(`edge-ttfb: wrote ${opts.json}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
