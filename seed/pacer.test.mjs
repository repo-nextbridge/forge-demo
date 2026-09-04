// The pacer's tests — `bash bin/test.sh`.
//
// ★★ THE ONE THIS FILE EXISTS FOR IS "the many cheap calls no longer pay the tight face's price": the seed
// used to pace EVERY call at the speed of its SLOWEST face, so a birth that needed 0,5/s on 52 calls ran
// ~1900 of them at 0,5/s and took 74 minutes instead of 11. Everything around it holds the three ways this
// can go wrong QUIETLY — an unknown path riding the fastest lane, the tight lane ceasing to pace at all,
// and the next operator reaching for the old knob out of memory.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FACES, createPacer, faceOf, pacingWarnings, ratesFromEnv } from './pacer.mjs';

/** Wall clock around a body, in milliseconds. The tests below are measurements, not assertions of intent. */
const elapsed = async (body) => {
  const t0 = Date.now();
  await body();
  return Date.now() - t0;
};

// ── the classification ──────────────────────────────────────────────────────────────────────────────────

test('every URL this seed builds lands on the face whose bucket actually counts it', () => {
  // ⚠️ EACH ROW IS A MEASUREMENT OF THE KERNEL, not a preference. The right-hand column is which limiter
  // the release this box runs mounts over that path: the per-credential cap covers `/v1/commands/*`,
  // `/v1/read/internal/*`, `/v1/internal/*` and `/v1/ext/*`; the face-wide anonymous ceiling covers
  // `/v1/read/:capability` (ONE segment) and the five public command faces; `ratelimit:ext-public-write`
  // covers the app data port's anonymous create.
  const table = [
    // the credential bucket — 6000/60 s by default
    ['http://api:3000/v1/commands/catalog.product.create', 'credential'],
    ['http://api:3000/v1/read/internal/products_admin?limit=100', 'credential'],
    ['http://api:3000/v1/internal/extension/action', 'credential'],
    ['http://api:3000/v1/ext/reviews/review', 'credential'],
    // measured NOT to be in the per-credential mount list, and it rides that lane anyway — see pacer.mjs
    ['http://api:3000/v1/media/commands/media.request_upload', 'credential'],
    // the kernel's anonymous boundary — 400/60 s per store+IP
    ['http://api:3000/v1/read/products?store=sto_1', 'anonymous'],
    ['http://api:3000/v1/read/product.by_handle?handle=x', 'anonymous'],
    ['http://api:3000/v1/cart/commands/cart.add_line', 'anonymous'],
    ['http://api:3000/v1/checkout/commands/checkout.place_order', 'anonymous'],
    ['http://api:3000/v1/payment/commands/payment.authorize', 'anonymous'],
    // an app's anonymous create face — 30/60 s per IP, the one that killed the 85/s birth
    ['http://api:3000/v1/ext-public/reviews/review', 'ext_public'],
    ['http://api:3000/v1/ext-customer/reviews/review', 'ext_public'],
  ];
  for (const [url, face] of table) assert.equal(faceOf(url), face, url);
});

test('★ the deeper read prefix wins — an internal read is NOT an anonymous one, and the order says so', () => {
  // The two live one segment apart and the kernel separates them by exactly this construction. Asked in
  // the wrong order, every credentialed read in the seed would be paced at the anonymous ceiling: 6/s
  // instead of 85/s, which is the same defect this slice removes, one notch smaller.
  assert.equal(faceOf('/v1/read/internal/stores'), 'credential');
  assert.equal(faceOf('/v1/read/stores'), 'anonymous');
});

test('⛔ a path this file has never heard of is NOT quietly given the fastest lane', () => {
  // `undefined` here means "this question does not exist", and the caller has to die on it. The generous
  // default is the failure mode: a tight face added later would ride 85/s and the box would break on a run
  // nobody changed.
  // Both of these are `/v1/read/…` and NEITHER is the anonymous public read: the bulk face has a bucket of
  // its own and the customer face is a shopper session. A `/v1/read/` prefix swallowed all three — measured,
  // in the first red of this slice.
  assert.equal(faceOf('/v1/read/bulk/products'), undefined);
  assert.equal(faceOf('/v1/read/customer/my_orders'), undefined);
  assert.equal(faceOf('/v1/some-face-nobody-declared/x'), undefined);
  assert.equal(faceOf('/health'), undefined);
});

// ── the knobs ───────────────────────────────────────────────────────────────────────────────────────────

test('each face has its OWN knob, and the defaults are the kernel ceilings the box was measured against', () => {
  const rates = ratesFromEnv({});
  assert.deepEqual(rates, { credential: 85, anonymous: 6, ext_public: 0.5 });
  // The knob names are part of the contract with the operator and with the README.
  assert.equal(FACES.credential.knob, 'FORGE_SEED_RATE_PER_SECOND');
  assert.equal(FACES.anonymous.knob, 'FORGE_SEED_RATE_PER_SECOND_ANONYMOUS');
  assert.equal(FACES.ext_public.knob, 'FORGE_SEED_RATE_PER_SECOND_EXT_PUBLIC');
});

test('★ the tight lane can be told the ceiling was raised — the pacer never derives it', () => {
  // A sibling slice is giving `ratelimit:ext-public-write` an env in the kernel. The two are independent:
  // this seed has to be right with the ceiling raised and with it left alone, so it READS a number.
  const rates = ratesFromEnv({ FORGE_SEED_RATE_PER_SECOND_EXT_PUBLIC: '50' });
  assert.equal(rates.ext_public, 50);
  assert.equal(rates.credential, 85, 'raising one face must not move another');
});

test('a knob that is not a positive number is refused by name, never silently defaulted', () => {
  assert.throws(
    () => ratesFromEnv({ FORGE_SEED_RATE_PER_SECOND: 'fast' }),
    /FORGE_SEED_RATE_PER_SECOND="fast"/,
  );
  assert.throws(() => ratesFromEnv({ FORGE_SEED_RATE_PER_SECOND_EXT_PUBLIC: '0' }), /positive/);
});

// ── ★★ the defect, measured ─────────────────────────────────────────────────────────────────────────────

test('★★ the many cheap calls no longer pay the tight face\'s price — measured, both ways', async () => {
  // The shape of the birth, in miniature and scaled so a test can finish: 48 calls that belong to a fast
  // face and 12 that belong to a slow one. The real run is ~1840 and 52.
  const CALLS = [...Array(48).fill('credential'), ...Array(12).fill('ext_public')];

  // ── the CONTROL: one bucket for every face, which is what this seed did until this slice. The rate is
  // the SLOWEST face's, because that is the only global rate that fits the tightest bucket.
  const global = createPacer({ credential: 20, anonymous: 20, ext_public: 20 });
  const globalMs = await elapsed(async () => {
    for (const face of CALLS) await global.take(face);
  });

  // ── the CHANGE: each face on its own bucket.
  const laned = createPacer({ credential: 2000, anonymous: 2000, ext_public: 20 });
  const lanedMs = await elapsed(async () => {
    for (const face of CALLS) await laned.take(face);
  });

  // The control really did wait — without this line a broken pacer that never paces anything would make
  // the assertion below pass for the wrong reason.
  assert.ok(
    globalMs > 1_000,
    `the control did not pace at all (${globalMs}ms); it cannot demonstrate the defect it stands for`,
  );
  assert.ok(
    lanedMs < globalMs / 4,
    `per-face pacing cost ${lanedMs}ms against the single bucket's ${globalMs}ms — the 48 cheap calls are ` +
      'still paying the slow face\'s price',
  );
  // And the tally says WHERE the time went, which is the thing the 74-minute birth could not answer.
  const tally = laned.tally();
  assert.equal(tally.credential.calls, 48);
  assert.equal(tally.ext_public.calls, 12);
  assert.ok(
    tally.credential.waitedMs < 200,
    `the credential lane waited ${tally.credential.waitedMs}ms for a bucket that has 100/s available`,
  );
});

test('★ and the tight lane still paces — the fix is not "stop pacing"', async () => {
  // The opposite failure, and the cheaper one to ship by accident: a pacer that classifies perfectly and
  // then lets everything through would make the 429 net the only defence, which is how the 19:42 birth
  // died. Thirty calls at 20/s with a bucket that starts full: twenty are free, ten cost 50ms each.
  const pacer = createPacer({ credential: 2000, anonymous: 2000, ext_public: 20 });
  const ms = await elapsed(async () => {
    for (let i = 0; i < 30; i += 1) await pacer.take('ext_public');
  });
  assert.ok(ms >= 400, `the tight lane let 30 calls through in ${ms}ms — it is not pacing`);
  assert.ok(pacer.tally().ext_public.waitedMs >= 400);
});

test('a lane the pacer was not built with is a loud error, not a free pass', () => {
  const pacer = createPacer({ credential: 85 });
  assert.throws(() => pacer.take('ext_public'), /no lane for face "ext_public"/);
});

test('★ the summary reports what was DONE, per face — the line the README promises', async () => {
  const pacer = createPacer({ credential: 2000, anonymous: 2000, ext_public: 2000 });
  await pacer.take('credential');
  await pacer.take('ext_public');
  await pacer.take('ext_public');
  const summary = pacer.summary();
  assert.match(summary, /3 call\(s\) through 3 face\(s\)/);
  assert.match(summary, /credential\s+1 call\(s\)/);
  assert.match(summary, /ext_public\s+2 call\(s\)/);
});

// ── the habit ───────────────────────────────────────────────────────────────────────────────────────────

test('★ setting the OLD knob to the old workaround value is said out loud, by name', () => {
  // The way past the 429 of 2026-09-03 was `FORGE_SEED_RATE_PER_SECOND=0.5`, and that is now the one value
  // that restores the 74-minute birth while curing nothing: it paces the credential face, which was never
  // the face that refused. Muscle memory is the failure mode, so the run says so.
  const env = { FORGE_SEED_RATE_PER_SECOND: '0.5' };
  const warnings = pacingWarnings(ratesFromEnv(env), env);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /FORGE_SEED_RATE_PER_SECOND=0\.5\/s/);
  assert.match(warnings[0], /FORGE_SEED_RATE_PER_SECOND_EXT_PUBLIC/);
});

test('and an unset knob, or an ordinary one, says nothing at all', () => {
  assert.deepEqual(pacingWarnings(ratesFromEnv({}), {}), []);
  const env = { FORGE_SEED_RATE_PER_SECOND: '40' };
  assert.deepEqual(pacingWarnings(ratesFromEnv(env), env), []);
});
