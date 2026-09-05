#!/usr/bin/env node
// ★★ EVERY DOOR OF EVERY STORE, OPENED — because a 404 behind a link nobody clicked is invisible.
//
//   FORGE_SEED_TOKEN=… node bin/prove-doors.mjs --tenant forgeco --api http://localhost:8200
//
// ⛔ WHY IT EXISTS, MEASURED 2026-09-04 ON A BOX THAT HAD JUST COME UP GREEN. Three of this box's four
// stores answered **404 at `/s/<id>/account/login`** — the shopper's sign-in page — while every other step
// of the birth was settled: the vitrine was warm, the data verified, the configuration graded. Nothing in
// the birth ever opened that door, so nothing said it was shut, and the box was handed over with sign-in
// dead on three shops.
//
// THE CAUSE WAS ONE CHARACTER CLASS IN THE EDGE, and it is worth stating because it is the shape of defect
// this file is for. `caddy/Caddyfile.local` claimed the store-scoped doors with `handle /s/*/account*`.
// Caddy has TWO path-matching regimes: a pattern whose ONLY wildcard is a trailing `*` is a PREFIX match
// (it crosses `/`), and any other pattern falls back to Go's `path.Match`, where `*` matches a run of
// NON-SEPARATOR characters. So `/s/*/account*` claimed `/s/<id>/account` and stopped dead at the slash
// before `login`. The generic rule looked right, read right, and covered exactly the one path that the two
// people who wrote it had typed into a browser.
//
// ★ WHAT IT GRADES IS **WHICH CONTAINER ANSWERED**, not just the status code, and that is the whole point.
// A store's vitrine will happily answer 200 for a path it does not own; the split between the forkable
// vitrine and the checkout we host is invisible from a status code alone. `X-Forge-Served-By` is set BY THE
// ROUTE in `caddy/Caddyfile.local`, so it answers the question a code cannot: whose front is this?
//
// ⚠️ IT PROBES ANONYMOUSLY, ON PURPOSE. Every door below is one an unauthenticated shopper must be able to
// reach — a probe carrying a session would grade a different set of pages and would go green on a box where
// a first-time visitor cannot sign in, which is the exact failure this file was written for.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(dirname(fileURLToPath(import.meta.url)));
const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const api = (argOf('--api') ?? process.env.FORGE_PUBLIC_ORIGIN ?? '').replace(/\/+$/, '');
const tenant = argOf('--tenant') ?? process.env.FORGE_SEED_TENANT ?? '';
const token = process.env.FORGE_SEED_TOKEN ?? '';

const out = [];
let failures = 0;
const say = (s = '') => out.push(s);
const ok = (what, why) => say(`  ✓ ${what} — ${why}`);
const bad = (what, why) => { failures++; say(`  ✗ ${what} — ${why}`); };
const skipped = (what, why) => say(`  ↷ ${what} — SKIPPED: ${why}`);
const finish = (verdict) => {
  say();
  say(verdict);
  process.stdout.write(`${out.join('\n')}\n`);
  process.exit(failures === 0 ? 0 : 1);
};
/** A question this run cannot ask is never a green and never a red — it is a run that did not happen. */
const wrongQuestion = (why) => {
  say(`  ⚑ ${why}`);
  say();
  say(`VERDICT: this step could not ask. Nothing above is a claim about ${tenant || 'this box'}.`);
  process.stdout.write(`${out.join('\n')}\n`);
  process.exit(2);
};

if (!api) wrongQuestion('no --api and no FORGE_PUBLIC_ORIGIN: this step has no box to open.');
if (!tenant) wrongQuestion('no --tenant: the store list is per tenant and this run does not know which.');
if (!token) wrongQuestion('no FORGE_SEED_TOKEN: `read.internal.stores` is the operator face and needs this tenant\'s own token.');

let BOX = {};
try {
  BOX = JSON.parse(readFileSync(join(HERE, 'seed/box.json'), 'utf8'));
} catch (error) {
  wrongQuestion(`seed/box.json could not be read (${error.message}) — there is no declaration of which stores are servable.`);
}

let rows;
try {
  const res = await fetch(`${api}/v1/read/internal/stores`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) wrongQuestion(`read.internal.stores answered ${res.status} for ${tenant} — this step cannot know which doors to open.`);
  rows = await res.json();
} catch (error) {
  wrongQuestion(`read.internal.stores could not be reached at ${api}: ${error.message}`);
}
if (!Array.isArray(rows)) wrongQuestion('read.internal.stores answered something that is not an array of stores.');

const declared = new Map(((BOX.tenants ?? []).find((t) => t.id === tenant)?.stores ?? []).map((s) => [s.handle, s]));

/**
 * ⚠️ THE STORE-SCOPED ADDRESS SPACE, AND IT IS THE BENCH'S, not production's. Online each store claims a
 * hostname and its doors sit at the ROOT (`/checkout`, `/account/login`); here one origin serves four
 * stores, so the store can only come from the path. Those are two different sets of routes and the edge
 * needs a rule for each — which is exactly the rule that was wrong.
 */
const DOORS = [
  { path: '', expect: [200], by: null, what: 'vitrine' },
  { path: '/checkout', expect: [200], by: 'checkout', what: 'checkout' },
  { path: '/account', expect: [307, 302], by: 'checkout', what: 'conta (redirects an anonymous shopper to the login)' },
  { path: '/account/login', expect: [200], by: 'checkout', what: '★ LOGIN — the door that was shut' },
];

say(`THE DOORS OF ${tenant}, opened anonymously at ${api}`);
say();

for (const row of rows) {
  const decl = declared.get(row.handle);
  if (decl?.servable === false) {
    skipped(row.handle, decl._servable_why ?? 'seed/box.json marks it `servable: false` and gives no reason');
    continue;
  }
  const base = `${api}/s/${row.id}`;
  for (const door of DOORS) {
    let code = 0;
    let servedBy = '';
    try {
      const res = await fetch(`${base}${door.path}`, { redirect: 'manual' });
      code = res.status;
      servedBy = res.headers.get('x-forge-served-by') ?? '';
    } catch (error) {
      bad(`${row.handle}${door.path || '/'}`, `could not be reached: ${error.message}`);
      continue;
    }
    const label = `${row.handle}${door.path || '/'}`;
    if (!door.expect.includes(code)) {
      bad(label, `${door.what} answered ${code}, and this door has to answer ${door.expect.join(' or ')}${servedBy ? ` (served by ${servedBy})` : ''}`);
      continue;
    }
    // ★ THE CONTAINER, NOT ONLY THE CODE. The vitrine answers 200 for paths it does not own; only the
    // header proves the edge chose the front that holds the money and the session.
    if (door.by && servedBy && servedBy !== door.by) {
      bad(label, `${door.what} answered ${code} but was served by "${servedBy}", not "${door.by}" — the edge sent it to the wrong front`);
      continue;
    }
    ok(label, `${door.what} → ${code}${servedBy ? ` · ${servedBy}` : ''}`);
  }
  say();
}

finish(
  failures === 0
    ? `VERDICT: every door of ${tenant} opens, and each one was opened by the front that owns it.`
    : `VERDICT: ${failures} door(s) of ${tenant} do NOT open. Read the ✗ lines above.`,
);
