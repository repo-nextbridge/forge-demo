#!/usr/bin/env node
// ★★★ DOES THE SHOP EXIST? — the question an HTTP code cannot answer, asked of every vitrine of a box.
//
//   node bin/prove-shop.mjs stag                 the six faces of deploy/stag.env
//   node bin/prove-shop.mjs prod --min-photos 8  a stricter floor than the default
//   node bin/prove-shop.mjs --url https://…      one address, no environment file
//
// ── WHY THIS FILE EXISTS, AND IT IS A DAY THIS INSTANCE PAID FOR ───────────────────────────────────────────
//
// On 2026-09-16 the staging box answered 200 on every door and served a home page of 72 KB where the bench
// serves 280 KB: no photograph, no banner, no shelf. Every probe this repository had was GREEN, because every
// probe this repository had asked whether a door OPENS. The cause was two empty variables — no storage driver
// and no public media base — and neither is an error: the kernel logs one line and serves media "as refs
// only". ⇒ A SHOP WITH NO PHOTOGRAPH IS STILL A 200. The proof of a shop is its PHOTOGRAPHS, and nothing was
// counting them.
//
// ── WHAT IT COUNTS, AND THE FALSE NEGATIVE THAT TAUGHT IT ──────────────────────────────────────────────────
//
// ⛔⛔ THE FIRST VERSION OF THIS FILE COUNTED ONLY `/api/img/` AND `/api/media/`, AND IT CALLED A PRODUCTION
// BOX FULL OF PHOTOGRAPHS EMPTY. Measured 2026-09-17: three vitrines answered "NO PHOTOGRAPHS" while their
// pages carried 57, 24 and 6 distinct images, every sampled one a 200 with real bytes. The pages address the
// bucket at its PUBLIC BASE; the proxy door is one shape a page can use, not the only one. A probe that
// measures the wrong shape is worse than no probe, and this one was built to stop exactly that mistake.
//
// ⇒ SO IT COUNTS BOTH, and prints the split. The two are not interchangeable — a master served through
// `/api/img/<spec>` gets a derivative and a 1-year immutable cache on this box, and one served straight from
// the base does not — so the split is data an operator should see, never something to normalise away.
//
// ⚠️ AND IT DOES NOT COUNT `<img`. A vitrine answers RSC, not rendered HTML: `curl` receives the flight
// payload, where there is no such tag at all and the addresses live inside escaped JSON. Counting `<img`
// would have reported zero on every box, forever — and `<img` would also count the theme's logo, which
// renders perfectly on a box with an empty catalogue. That is how the defective page looked healthy.
//
// ⚠️ AND IT FETCHES EACH DOOR IT FOUND. A URL in the markup proves the page believes in an image; only a 200
// with bytes proves the bytes are where the page says they are. The staging incident would have passed a
// markup-only check the moment the refs were repaired, and still served a broken picture to everybody.
//
// ⛔ IT IS NOT A SUBSTITUTE FOR `bin/prove-doors.mjs`. That one proves every door of every store answers;
// this one proves ONE thing about the pages behind them, and the two say different words when they fail.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const TAG = '[prove-shop]';

// Flags first, then whatever is left over is the environment name. Written this way rather than "the first
// argument that does not start with --" because that reading swallows a flag's VALUE as the environment.
const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) flags[argv[i]] = argv[++i];
  else positional.push(argv[i]);
}
const MIN_PHOTOS = Number(flags['--min-photos'] ?? 6);
const SAMPLE = Number(flags['--sample'] ?? 3);
const oneUrl = flags['--url'] ?? null;
const envName = positional[0];

/** The storefront faces of an environment: the vitrines, never the admins — an admin behind a login has no
 * catalogue to show, and asking it for photographs would make this probe lie in the kind direction. */
function facesOf(env) {
  const file = join(HERE, 'deploy', `${env}.env`);
  const text = readFileSync(file, 'utf8');
  const read = (key) => text.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1]?.trim();
  return [
    ['store', read('FORGE_DOMAIN')],
    ['outlet', read('FORGE_OUTLET_DOMAIN')],
    ['cafe', read('FORGE_CAFE_DOMAIN')],
  ]
    .filter(([, host]) => host)
    .map(([name, host]) => [name, `https://${host}/`]);
}

/** The box's OWN derivative and media doors. */
const PROXY_DOOR = /(?:\/api\/img\/|\/api\/media\/)[^\s"'\\)]+/g;

/** The public base this environment declares, as a matcher for absolute addresses under it. `deploy/<env>.env`
 * is the one place that says where a browser reads this box's bytes from, so it is where this comes from —
 * never a host typed here, which would make the probe about one instance. */
function baseMatcher(env) {
  const text = readFileSync(join(HERE, 'deploy', `${env}.env`), 'utf8');
  const base = text.match(/^FORGE_MEDIA_BASE_URL=(.+)$/m)?.[1]?.trim().replace(/\/+$/, '');
  if (!base) return null;
  return new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^\\s"'\\\\)]+`, 'g');
}

async function probe(name, url, base) {
  let res;
  try {
    res = await fetch(url, { redirect: 'follow' });
  } catch (err) {
    return { name, url, verdict: 'UNREACHABLE', detail: String(err.cause?.code ?? err.message) };
  }
  const body = await res.text();
  // RSC payload escapes the addresses, so a trailing backslash rides along; it is not part of the URL.
  const clean = (u) => u.replace(/\\+$/, '');
  const proxied = [...new Set((body.match(PROXY_DOOR) ?? []).map(clean))];
  const direct = base ? [...new Set((body.match(base) ?? []).map(clean))] : [];
  const doors = [...proxied, ...direct];
  const origin = new URL(res.url).origin;

  // Fetch a sample of the doors the page believes in. A URL in markup is a belief; bytes are the fact.
  const picked = doors.slice(0, SAMPLE);
  const fetched = await Promise.all(
    picked.map(async (d) => {
      try {
        const r = await fetch(new URL(d, origin), { method: 'GET' });
        const buf = await r.arrayBuffer();
        return { d, status: r.status, bytes: buf.byteLength, type: r.headers.get('content-type') ?? '' };
      } catch (err) {
        return { d, status: 0, bytes: 0, type: String(err.cause?.code ?? err.message) };
      }
    }),
  );
  const broken = fetched.filter((f) => f.status !== 200 || f.bytes === 0 || !f.type.startsWith('image/'));

  let verdict = 'OK';
  if (!res.ok) verdict = `HTTP ${res.status}`;
  else if (doors.length < MIN_PHOTOS) verdict = 'NO PHOTOGRAPHS';
  else if (broken.length) verdict = 'PHOTOGRAPHS DO NOT LOAD';

  return {
    name,
    url,
    verdict,
    status: res.status,
    kb: Math.round(body.length / 1024),
    doors: doors.length,
    proxied: proxied.length,
    direct: direct.length,
    sampled: fetched.length,
    broken,
  };
}

const targets = oneUrl ? [['url', oneUrl]] : envName ? facesOf(envName) : [];
const BASE = envName ? baseMatcher(envName) : null;
if (!targets.length) {
  console.error(`${TAG} usage: node bin/prove-shop.mjs <env> | --url <address>`);
  process.exit(2);
}

const results = [];
for (const [name, url] of targets) results.push(await probe(name, url, BASE));

console.log(`${TAG} floor: ${MIN_PHOTOS} media door(s) per home, ${SAMPLE} of them fetched for real\n`);
for (const r of results) {
  const line = r.verdict === 'UNREACHABLE'
    ? `${r.detail}`
    : `HTTP ${r.status} · ${r.kb} KB · ${r.doors} image(s) (${r.proxied} through this box's door, ` +
      `${r.direct} straight from the public base) · ${r.sampled} fetched`;
  console.log(`  ${r.verdict === 'OK' ? '✓' : '⛔'} ${r.name.padEnd(8)} ${line}`);
  console.log(`    ${r.url}`);
  for (const b of r.broken ?? []) console.log(`    ⛔ ${b.status} ${b.bytes}B ${b.type} ${b.d.slice(0, 90)}`);
}

const bad = results.filter((r) => r.verdict !== 'OK');
if (bad.length) {
  console.error(`\n${TAG} ⛔ ${bad.length} of ${results.length} face(s) answer, and do not sell anything:`);
  for (const r of bad) console.error(`     ${r.name}: ${r.verdict}`);
  console.error(`${TAG}    A 200 with no photograph is what a box with no storage driver, or no
${TAG}    FORGE_MEDIA_BASE_URL, looks like from the outside. Check both on the box.`);
  process.exit(1);
}
console.log(`\n${TAG} ✓ every vitrine of this box shows photographs, and they load.`);
