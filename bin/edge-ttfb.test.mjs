// ★ THE EDGE RULER'S PURE HALF — the numbers it prints and the routes it picks, graded without a network.
//
//   node --test bin/edge-ttfb.test.mjs      (or: bash bin/test.sh)
//
// `bin/edge-ttfb.mjs` is run twice on purpose — BEFORE the HTML goes to the edge (2026-10-23) and AFTER the
// cut — and the two runs are only comparable if the arithmetic and the route choice are the same both times.
// So what is graded here is what would silently shift a comparison: the percentile (an off-by-one turns p95
// of 10 samples into the 9th value, and the "after" looks better than it is), the route discovery (a store
// that changes its links must still yield a category and a PDP, and a store with no category must say so
// instead of measuring an informational page as one), the colo read from `cf-ray`, and the cacheability
// verdict the `--check-flight` mode prints.
//
// The HTML fixtures are EXCERPTS of the two homes as served on 2026-10-23 (`store.` and `cafe.forgecommerce.pro`),
// trimmed to the link shapes that matter — not invented shapes.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogPaths,
  coloFromRay,
  discoverRoutes,
  edgeCacheableByHeader,
  edgeStored,
  percentile,
  sameHostPath,
  summarizeHeader,
} from './edge-ttfb.mjs';

const SHOE_HOME = `
<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/_next/static/css/a.css">
<nav><a href="/">Início</a><a href="/tenis">Tênis</a><a href="/tenis/corrida">Corrida</a><a href="/tenis/trilha">Trilha</a>
<a href="/tenis?cf.genero=Feminino">Feminino</a><a href="/botas">Botas</a><a href="/botas/chuva">Chuva</a>
<a href="/botas">Botas</a><a href="/botas">Botas</a><a href="/search">Busca</a><a href="/account/login">Entrar</a>
<a href="/checkout">Sacola</a><a href="/b/nike">Nike</a></nav>
<section><a class="card" href="/tenis/trilha/keen-kids-jasper-ii-toddler-little-kid">Keen</a>
<a class="card" href="/tenis/corrida/mens-asics-gel-nimbus-28-atc">Asics</a></section>
<footer><a href="/faq">FAQ</a><a href="/sobre">Sobre</a><a href="/icon.png?51eb">i</a><a href="https://media.example.test/x.png">m</a></footer>`;

const COFFEE_HOME = `
<a href="/">Início</a><a href="/#produtos">Produtos</a><a href="/checkout">Sacola</a><a href="/account">Conta</a>
<a href="/p/forge-alvorada">Alvorada</a><a href="/p/forge-noturno">Noturno</a>
<link href="/_coffee/_next/static/css/f5.css"><a href="/api/media/tenant_x/alvorada.png">img</a>`;

test('percentile is nearest-rank: p50 of 10 samples is the 5th, p95 the 10th — every printed number was measured', () => {
  const ten = [10, 1, 9, 2, 8, 3, 7, 4, 6, 5];
  assert.equal(percentile(ten, 50), 5);
  assert.equal(percentile(ten, 95), 10);
  const twenty = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.equal(percentile(twenty, 95), 19, 'p95 of 20 samples is the 19th — the slowest one is the outlier p95 excludes');
  assert.equal(percentile(twenty, 50), 10);
  assert.equal(percentile([42], 95), 42);
});

test('percentile ignores failed samples and answers null, not 0, when nothing was measured', () => {
  assert.equal(percentile([null, 30, undefined, 10, Number.NaN, 20], 50), 20);
  assert.equal(percentile([null, undefined], 50), null);
  assert.equal(percentile([], 95), null);
});

test('coloFromRay reads the airport suffix of cf-ray; no ray means no edge', () => {
  assert.equal(coloFromRay('a4eff10ff8cc311f-GRU'), 'GRU');
  assert.equal(coloFromRay('8a1b2c3d4e5f6a7b-FRA '), 'FRA');
  assert.equal(coloFromRay(undefined), null);
  assert.equal(coloFromRay('not-a-ray'), null);
});

test('catalogPaths keeps same-origin pages only: no assets, no platform routes, no query, no other origin', () => {
  const paths = catalogPaths(SHOE_HOME);
  for (const p of paths) {
    assert.ok(!/^\/(_next|account|checkout|search)/.test(p), `${p} is a platform route or asset, not catalogue`);
    assert.ok(!/[?#]|\.png|\.ico/.test(p), `${p} kept a query or an asset`);
  }
  assert.ok(paths.includes('/tenis'), 'the query-carrying /tenis?cf.genero=… collapses into /tenis');
  assert.equal(paths.filter((p) => p === '/botas').length, 1, 'unique');
});

test('discoverRoutes on the shoe store: the PDP is the first deepest leaf, the category the listing it sits in', () => {
  assert.deepEqual(discoverRoutes(SHOE_HOME), {
    category: '/tenis/trilha',
    pdp: '/tenis/trilha/keen-kids-jasper-ii-toddler-little-kid',
  });
});

test('discoverRoutes on the coffee shop: products linked straight from the home, so NO category — never /faq or a brand', () => {
  assert.deepEqual(discoverRoutes(COFFEE_HOME), { category: null, pdp: '/p/forge-alvorada' });
});

test('discoverRoutes falls back to the most-linked branch when the PDP\'s parent is not linked', () => {
  const html = '<a href="/a">a</a><a href="/a/x">x</a><a href="/b">b</a><a href="/b">b</a><a href="/b/y">y</a><a href="/c/d/e">e</a>';
  assert.deepEqual(discoverRoutes(html), { category: '/b', pdp: '/c/d/e' });
});

test('discoverRoutes on a home with nothing deeper than one segment finds neither — no route is invented', () => {
  assert.deepEqual(discoverRoutes('<a href="/faq">f</a><a href="/sobre">s</a><a href="/checkout">c</a>'), { category: null, pdp: null });
});

test('sameHostPath follows a redirect only while it stays on the measured host', () => {
  const host = 'cafe.forgecommerce.pro';
  assert.equal(sameHostPath(host, '/pra_levar/forge-alvorada'), '/pra_levar/forge-alvorada');
  assert.equal(sameHostPath(host, 'https://cafe.forgecommerce.pro/x?y=1'), '/x?y=1');
  assert.equal(sameHostPath(host, 'https://evil.example.test/x'), null);
  assert.equal(sameHostPath(host, 'http://cafe.forgecommerce.pro/x'), null);
  assert.equal(sameHostPath(host, undefined), null);
});

test('summarizeHeader prints a unanimous value plainly and a varying one with its counts', () => {
  assert.equal(summarizeHeader(['DYNAMIC', 'DYNAMIC']), 'DYNAMIC');
  assert.equal(summarizeHeader(['STALE', 'HIT', 'STALE']), 'STALE×2 HIT×1');
  assert.equal(summarizeHeader([undefined, undefined]), '—');
});

test('edgeCacheableByHeader: today\'s s-maxage HTML is cacheable; no-store/private is not; CDN-Cache-Control wins', () => {
  assert.equal(edgeCacheableByHeader({ 'cache-control': 's-maxage=60, stale-while-revalidate=31535940' }), true);
  assert.equal(edgeCacheableByHeader({ 'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate' }), false);
  assert.equal(edgeCacheableByHeader({ 'cache-control': 'public, max-age=300' }), true);
  assert.equal(edgeCacheableByHeader({ 'cache-control': 'max-age=300' }), false, 'max-age without public/s-maxage is the browser\'s, not the edge\'s');
  assert.equal(edgeCacheableByHeader({ 'cache-control': 's-maxage=60', 'cdn-cache-control': 'no-store' }), false, 'RFC 9213: the CDN header overrides');
  assert.equal(edgeCacheableByHeader({ 'cache-control': 'no-store', 'cdn-cache-control': 'max-age=60' }), true);
  assert.equal(edgeCacheableByHeader({}), false);
});

test('edgeStored: DYNAMIC/BYPASS = not stored, HIT/MISS = stored, no status = no edge in front', () => {
  assert.equal(edgeStored({ 'cf-cache-status': 'DYNAMIC' }), false);
  assert.equal(edgeStored({ 'cf-cache-status': 'BYPASS' }), false);
  assert.equal(edgeStored({ 'cf-cache-status': 'HIT' }), true);
  assert.equal(edgeStored({ 'cf-cache-status': 'MISS' }), true);
  assert.equal(edgeStored({}), null);
});
