// ★★ THE BIRTH ENDS WARM, AND WHEN IT DOES NOT IT SAYS SO — BY NAME.
//
// ⚠️ THE EXIT CODES MOVED ON 05/09 (*"D1 - Pode ser só relatório"*), and this file is where that is proved.
// Warmth is a REPORT: `bin/box-up.sh` no longer fails a birth on it (that half is graded by
// `bin/reset-complete.guard.mjs`, which executes the exit block). This step still answers non-zero for a human
// who ran it by hand and asked a yes/no question — 1 for "not fully warm" — and it keeps ONE red of its own:
// exit 3, a store `seed/box.json` declares and the box does not hold, which is not warmth at all.
//
// This grades `bin/warm-box.mjs` against a FAKE BOX — a real http server on a real port, speaking the two
// faces the step uses (`read.internal.stores` and the vitrine's `/api/warm`). Nothing here talks to the
// bench, and nothing here stubs the step: it is spawned as the birth spawns it, and what is graded is its
// exit code and what it printed.
//
// ⚠️ THE FAKE IS A SERVER AND NOT A MOCK ON PURPOSE. The step's whole risk is in the wire — a 404 that
// means "these images predate the warmer", a 401 that means "the secret in .env is not the one in the
// container", a poll that never ends. A mock of `fetch` would agree with whatever the step believes; a
// socket answers what a box answers.
//
//   node --test bin/warm-box.test.mjs      (or: bash bin/test.sh)

import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STEP = join(ROOT, 'bin/warm-box.mjs');
const BOX = JSON.parse(readFileSync(join(ROOT, 'seed/box.json'), 'utf8'));

const SECRET = 'test-secret';
const TOKEN = 'fot_test';

/**
 * The stores the fake port reports for the coffee tenant — the counter among them, as the real one does.
 *
 * ★★ pk21 — `storefront_enabled` IS THE FIELD THAT DECIDES, and it is the PORT's. `read.internal.stores`
 * publishes it (packages/core/src/read/internal-capabilities.ts:796) derived from the store's `status`;
 * `seed/box.json` used to carry a hand-written `servable: false` beside it, which was a second truth about
 * one store with nothing to keep the two in agreement.
 *
 * ⚠️ THE COUNTER IS `false` HERE AND `true` ON THE REAL BOX — MEASURED 2026-09-07 on the live bench:
 * `read.internal.stores` answers `storefront_enabled: true` for `balcao`, because all four stores are
 * `active`. So this fixture is the box of the day the counter's status is flipped, which is what these tests
 * are for; `CAFE_ON_THE_STREET` below is the box of today, and it warms the counter on purpose.
 */
const CAFE_STORES = [
  { id: 'sto_CAFE', handle: 'cafe', name: 'Forge Café', storefront_enabled: true },
  { id: 'sto_BALCAO', handle: 'balcao', name: 'Forge Café · Balcão', storefront_enabled: false },
];

/** Today's real answer: every store of the tenant on the street. */
const CAFE_ON_THE_STREET = CAFE_STORES.map((s) => ({ ...s, storefront_enabled: true }));

/**
 * ★ THE PER-STORE BODY THE VITRINE REALLY SENDS, and this fixture is a copy of the product's own types
 * (`apps/storefront/src/lib/warm/warm.ts` → `StoreReport` / `PassReport`), not a shape invented here.
 *
 * ⚠️ IT EXISTS BECAUSE THE OLD FIXTURE SENT `stores: []`, which is exactly why nobody noticed that this step
 * threw the whole breakdown away: a fake that carries no detail cannot prove a report that omits detail.
 *
 * `failed` is a url that ANSWERED BADLY; `skipped` is a url the run's ceiling arrived before it was TRIED.
 * They are the two halves the birth of 04/09 folded into one number, and they are different repairs.
 */
const pass = ({ planned, done, failed = [], skipped = 0, p95 = 120 }) => ({
  planned,
  done,
  p95,
  failed,
  hits: done,
  skipped,
});

/**
 * A box that answers.
 *
 * `warm` decides what the vitrine does with a POST:
 *   'ok'         a run that finishes green
 *   'incomplete' a run that finishes with reasons — the shape of "some pages did not warm"
 *   'cut'        a run the CEILING cut: urls that were never TRIED, which is this box's every real birth
 *   'failed'     a run with NO report at all (the origin could not even be planned)
 *   'absent'     the route is not there: an image built before the warmer existed
 *   'unauth'     the secret does not match
 *   'running'    a run that never finishes, for the deadline
 */
async function fakeBox({ warm = 'ok', stores = CAFE_STORES, storesStatus = 200, p95 = 120, directory = {} } = {}) {
  const asked = { posts: [], gets: 0 };
  let run = null;
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const json = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === '/v1/read/store.by_host') {
      // The real capability tries the exact host WITH its port first and falls back to the bare host
      // (`requestHostKeys`), which is what lets a fixture name `127.0.0.1` for a server on a random port.
      const asked = url.searchParams.get('host') ?? '';
      const id = directory[asked] ?? directory[asked.replace(/:\d+$/, '')];
      return id ? json(200, { store_id: id }) : json(404, { error: { kind: 'not_found', message: 'not found' } });
    }
    if (url.pathname === '/v1/read/internal/stores') {
      if (storesStatus !== 200) return json(storesStatus, { error: { kind: 'forbidden' } });
      return json(200, stores);
    }
    if (url.pathname === '/api/warm') {
      if (warm === 'absent') return json(404, { error: 'not found' });
      if (req.headers['x-revalidate-secret'] !== SECRET || warm === 'unauth') {
        return json(401, { ok: false, error: 'unauthorized' });
      }
      if (req.method === 'POST') {
        asked.posts.push(url.searchParams.getAll('store'));
        const planned = url.searchParams.getAll('store').length * 10;
        run = {
          id: 'warm_test',
          state: 'running',
          startedAt: new Date().toISOString(),
          finishedAt: null,
          asked: { origin: `http://127.0.0.1:${port}`, originFrom: 'caller', stores: url.searchParams.getAll('store') },
          progress: { stores: null, storesDone: 0, planned: 0, plannedFinal: false, warmed: 0, failed: 0, verified: 0 },
          report: null,
          error: null,
        };
        if (warm !== 'running') {
          // The next GET is what settles it — a run that answered "finished" to the POST would never
          // exercise the poll, which is the half that can hang.
          run = {
            ...run,
            settleTo:
              warm === 'ok'
                ? {
                    state: 'ok',
                    report: {
                      planned,
                      warmed: planned,
                      failed: 0,
                      p95,
                      p95Pass: 'warm',
                      thresholdMs: null,
                      stores: [
                        {
                          store: 'sto_CAFE',
                          url: `http://127.0.0.1:${port}/s/sto_CAFE/`,
                          planned,
                          sections: {},
                          short: [],
                          pages: pass({ planned, done: planned, p95 }),
                          images: { ...pass({ planned: 0, done: 0 }), foreignHosts: [], declared: 0, cut: false },
                          verify: undefined,
                        },
                      ],
                      reasons: [],
                      ok: true,
                    },
                  }
                : warm === 'incomplete'
                  ? {
                      state: 'incomplete',
                      report: {
                        planned,
                        warmed: planned - 2,
                        failed: 2,
                        p95,
                        p95Pass: 'warm',
                        thresholdMs: null,
                        stores: [
                          {
                            store: 'sto_CAFE',
                            url: `http://127.0.0.1:${port}/s/sto_CAFE/`,
                            planned,
                            sections: {},
                            short: [],
                            pages: pass({
                              planned,
                              done: planned - 2,
                              p95,
                              failed: [
                                { url: '/s/sto_CAFE/marcas/lavazza', error: 'HTTP 503' },
                                { url: '/s/sto_CAFE/colecoes/torra-escura', error: 'timeout after 20000ms' },
                              ],
                            }),
                            images: { ...pass({ planned: 0, done: 0 }), foreignHosts: [], declared: 0, cut: false },
                            verify: undefined,
                          },
                        ],
                        reasons: ['2 page(s) did not answer'],
                        ok: false,
                      },
                    }
                  : warm === 'cut'
                    ? {
                        state: 'incomplete',
                        report: {
                          planned,
                          warmed: 1,
                          failed: 0,
                          p95: 0,
                          p95Pass: 'verify',
                          thresholdMs: null,
                          stores: [
                            {
                              store: 'sto_CAFE',
                              url: `http://127.0.0.1:${port}/s/sto_CAFE/`,
                              planned,
                              sections: {},
                              short: [],
                              pages: pass({ planned, done: 1, skipped: planned - 1, p95: 0 }),
                              images: {
                                ...pass({ planned: 0, done: 0 }),
                                foreignHosts: [],
                                declared: 0,
                                cut: false,
                              },
                              verify: undefined,
                            },
                          ],
                          reasons: [`sto_CAFE: ${planned - 1} urls were never visited: the run hit its ceiling of 900000ms`],
                          ok: false,
                        },
                      }
                    : { state: 'failed', report: null, error: 'no store claims the host "127.0.0.1"' },
          };
        }
        return json(202, { ok: true, started: true, run: { ...run, settleTo: undefined } });
      }
      asked.gets += 1;
      if (!run) return json(200, { ok: true, run: null });
      if (run.settleTo) {
        run = { ...run, ...run.settleTo, finishedAt: new Date().toISOString(), settleTo: undefined };
      }
      return json(200, { ok: true, run });
    }
    json(404, { error: 'not found' });
  });
  // ⚠️ AWAITED, AND `unref`ed. `listen` is asynchronous, so `address()` read on the next line is null and
  // every request would go to `http://127.0.0.1:undefined`; and a listening handle keeps node's loop alive,
  // which made the first version of this file hang after the last assertion rather than fail.
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  server.unref();
  const port = server.address().port;
  return { origin: `http://127.0.0.1:${port}`, asked, close: () => server.close() };
}

// ⚠️ ASYNCHRONOUS, AND THAT IS NOT A STYLE CHOICE. The fake box is served by THIS process's event loop, and
// `execFileSync` blocks it for the whole life of the child — so the step's very first request finds nobody
// accepting and the suite hangs instead of failing. Measured: the first version of this file timed out at
// 60 s on a test whose step exits in three.
const run_ = promisify(execFile);
async function runStep({ box, tenant = 'forgecafe', secret = SECRET, token = TOKEN, extra = [], env = {} }) {
  const options = {
    encoding: 'utf8',
    env: {
      ...process.env,
      FORGE_SEED_TOKEN: token,
      FORGE_REVALIDATE_SECRET: secret,
      ...env,
    },
  };
  try {
    const { stdout, stderr } = await run_('node', [STEP, '--tenant', tenant, '--api', box.origin, ...poll(extra)], options);
    return { stdout: `${stdout}${stderr}`, status: 0 };
  } catch (error) {
    return { stdout: `${error.stdout ?? ''}${error.stderr ?? ''}`, status: error.code ?? -1 };
  }
}

/** The poll interval, forced down unless a test chose its own: at the step's real 3 s this file spent 26 s
 *  waiting for fakes that answer in a millisecond, and a slow suite is a suite people stop running. */
const poll = (extra) => (extra.includes('--poll-ms') ? extra : [...extra, '--poll-ms', '50']);

// ── the happy half ────────────────────────────────────────────────────────────────────────────────────────

test('★★ a birth that warms every servable store finishes green, with numbers rather than an adjective', async () => {
  const box = await fakeBox({ warm: 'ok' });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 0, stdout);
    assert.match(stdout, /VERDICT: warm/, `no verdict line:\n${stdout}`);
    // The measurement, not the mood: what was planned, what warmed, and the p95 of the pass it belongs to.
    assert.match(stdout, /planned=10/, `the report's numbers are not printed:\n${stdout}`);
    assert.match(stdout, /p95=120 ?ms/, `the p95 is not printed:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★★ the store the PORT says has no public page is skipped — and the skip is ANNOUNCED with its reason', async () => {
  const box = await fakeBox({ warm: 'ok' });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 0, stdout);
    // 1 · it really was left out of the run.
    assert.deepEqual(box.asked.posts, [['sto_CAFE']], `the counter was warmed, or the shop was not:\n${stdout}`);
    // 2 · …and the run SAID so. Absence is not a value: a store missing from the report reads exactly like
    //     a store that failed.
    assert.match(stdout, /balcao/, `the skipped store is not named at all:\n${stdout}`);
    const line = stdout.split('\n').find((l) => l.includes('balcao'));
    assert.match(line, /skip/i, `the counter's line does not say it was skipped: ${line}`);
    // 3 · with a reason that names the PORT and the field, so a reader can go and ask the box the same
    //     question — never a paragraph in a file that can disagree with the box it describes.
    assert.match(line, /storefront_enabled/, `the skip line does not name the field that decided it: ${line}`);
    assert.match(line, /read\.internal\.stores/, `the skip line does not name the read that answered: ${line}`);
    // 4 · ⛔ AND NOTHING IN `seed/box.json` MAY SAY IT. That file's copy of this fact is the duplication the
    //     slice removed; `bin/servable.test.mjs` is the guard, and this line is why it matters HERE.
    const declared = BOX.tenants.flatMap((t) => t.stores).find((s) => s.handle === 'balcao');
    assert.ok(
      !('servable' in declared),
      'seed/box.json declares `servable` again — two truths about one store, and this step reads the port.',
    );
  } finally {
    box.close();
  }
});

test('★★★ …and TODAY the counter is on the street, so it IS warmed — the derivation says what is, not what we want', async () => {
  // ⛔ MEASURED ON THE LIVE BENCH 2026-09-07: `read.internal.stores` answers `storefront_enabled: true` for
  //    `balcao` — the four stores are all `active`. Under the hand-written flag this box skipped it anyway,
  //    which is precisely the second truth: the file said one thing and the port said another. The day
  //    `tenant.store.update {"status":"private"}` runs against the counter, the test above is the box and
  //    this one stops being; nothing here changes.
  const box = await fakeBox({ warm: 'ok', stores: CAFE_ON_THE_STREET });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 0, stdout);
    assert.deepEqual(box.asked.posts, [['sto_CAFE', 'sto_BALCAO']], `the counter was not warmed:\n${stdout}`);
    assert.doesNotMatch(stdout, /balcao.*SKIPPED/, `a store on the street was skipped:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★★ a kernel that does not publish the field at all ⇒ every store is ON THE STREET, never a silent nothing', async () => {
  // ⛔ THE SABOTAGE THIS IS AGAINST: `!row.storefront_enabled` instead of `=== false`. This box pins its
  //    images BY DIGEST (`forge.lock`), so a kernel older than the capability is a real configuration, and
  //    against one every row arrives WITHOUT the field. A truthiness test would skip EVERY store, warm
  //    nothing, and print a verdict over an empty report. The product's own consumer takes the same care:
  //    `apps/storefront/src/app/sitemap.ts:35` reads `?.storefront_enabled === false`.
  const legacy = CAFE_STORES.map(({ storefront_enabled: _drop, ...rest }) => rest);
  const box = await fakeBox({ warm: 'ok', stores: legacy });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 0, stdout);
    assert.deepEqual(box.asked.posts, [['sto_CAFE', 'sto_BALCAO']], `an older kernel emptied the box:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★★ THE VACUUM: a port that reports NO STORE is accused, never "nothing to warm, all fine"', async () => {
  // Every way this step can go blind ends in an empty report under a verdict that reads like a measurement.
  // `bin/prove-doors.mjs` asserts its own count for the same reason; neither runs the other, so both do it.
  const box = await fakeBox({ warm: 'ok', stores: [] });
  try {
    const { stdout, status } = await runStep({ box });
    assert.notEqual(status, 0, `an empty store list was reported as a warm box:\n${stdout}`);
    assert.match(stdout, /NO STORE OF forgecafe WAS READ/, stdout);
    assert.doesNotMatch(stdout, /VERDICT: warm/, `a run that read nothing signed a warm box:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★ a store the port holds and this file does not declare is warmed AND named — silence about it is the defect', async () => {
  const box = await fakeBox({
    warm: 'ok',
    stores: [...CAFE_STORES, { id: 'sto_SCRATCH', handle: 'scratch', name: 'Scratch' }],
  });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 0, stdout);
    assert.deepEqual(box.asked.posts, [['sto_CAFE', 'sto_SCRATCH']], stdout);
    assert.match(stdout, /scratch[\s\S]{0,120}not declared/i, `the undeclared store is warmed in silence:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★★ a store this file declares and the box does not hold is RED — and it is the ONE red left here', async () => {
  // ⛔ THE HALF THAT DID NOT BECOME A REPORT. "The birth did not build a store this repository declares" is
  //    not a statement about warmth, and no other step of the birth can see it: `bin/verify-seed.mjs` grades
  //    the stores the PORT reports and `bin/prove-doors.mjs` opens the doors of the stores the PORT reports,
  //    so a store that was never created is a store neither of them asks about. Its own exit code (3) is what
  //    lets `bin/box-up.sh` keep failing on it while it stops failing on cold.
  const box = await fakeBox({ warm: 'ok', stores: [{ id: 'sto_CAFE', handle: 'cafe', name: 'Forge Café' }] });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 3, `a missing declared store did not answer 3:\n${stdout}`);
    assert.match(stdout, /balcao[\s\S]{0,160}(not|missing)/i, stdout);
    // And the verdict must say WHICH sentence this is — "cold" and "never built" are different repairs.
    assert.match(stdout, /DECLARES/, `the verdict does not say what kind of red this is:\n${stdout}`);
  } finally {
    box.close();
  }
});

// ── how it REPORTS a box that is not warm, which is the half the box is bought for ────────────────────────
//
// Every case below used to fail the birth. They now answer 1 — a report — and the assertions are about what
// the report SAYS, because a number nobody can act on was the whole defect of the old step.

test('★★★ a vitrine that publishes no /api/warm is reported BY NAME, and names the pin that explains it', async () => {
  const box = await fakeBox({ warm: 'absent' });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 1, `a 404 from the warmer was not reported:\n${stdout}`);
    assert.match(stdout, /404/, stdout);
    // The operator must not have to guess WHY the route is missing: this box pins its images by digest, and
    // an image older than the warmer is the one cause. `forge.lock` is where that is written down.
    assert.match(stdout, /forge\.lock|build-local/, `the failure does not point at the pin:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★ a secret the container does not share is named BY NAME, never as "warming did not work"', async () => {
  const box = await fakeBox({ warm: 'ok' });
  try {
    const { stdout, status } = await runStep({ box, secret: 'the-wrong-one' });
    assert.equal(status, 1, stdout);
    assert.match(stdout, /401/, stdout);
    assert.match(stdout, /FORGE_REVALIDATE_SECRET/, `the failure does not name the variable:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★★ a run that came back INCOMPLETE reports, and it prints the run\'s own reasons', async () => {
  const box = await fakeBox({ warm: 'incomplete' });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 1, `an incomplete run did not report:\n${stdout}`);
    assert.match(stdout, /2 page\(s\) did not answer/, `the run's reasons are not relayed:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★★ …and it NAMES the pages that did not answer — the number alone was the defect', async () => {
  // ⛔ MEASURED, 05/09. The birth printed `failed=198` and `forgeco: 198 of 419 pages did not answer` and not
  //    one of the 198 urls. Sondas on the idle box answered 200 for the same brands and collections minutes
  //    later, so the number was not even about the pages — but nobody reading the birth could have known,
  //    because there was nothing to check. A report that replaces a gate has to be checkable.
  const box = await fakeBox({ warm: 'incomplete' });
  try {
    const { stdout } = await runStep({ box });
    assert.match(stdout, /marcas\/lavazza/, `the failing url is not named:\n${stdout}`);
    assert.match(stdout, /colecoes\/torra-escura/, `the second failing url is not named:\n${stdout}`);
    // The reason each one gave, too: a 503 and a timeout are different repairs.
    assert.match(stdout, /HTTP 503/, `the error the url answered with is not printed:\n${stdout}`);
    assert.match(stdout, /timeout/, `a timeout is not distinguished from a bad status:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★★ "never visited" is its own word, and never folded into "did not answer"', async () => {
  // ⛔ THIS IS EVERY REAL BIRTH OF THIS BOX. The plan is ~420 pages plus ~20 400 image derivatives against the
  //    VITRINE's 15-minute ceiling, so the run always ends with urls it never TRIED. Nothing answered badly;
  //    the ceiling arrived. Reporting those as failures is how a fast box reads as a broken one.
  const box = await fakeBox({ warm: 'cut' });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 1, stdout);
    // ⚠️ THE ASSERTION IS ON THIS FILE'S OWN PASS LINE, NOT ON `stdout`. Measured by sabotage, 05/09: a bare
    //    `/never visited/` over the whole output stayed GREEN with the pass line folding the two counts into
    //    one, because the VITRINE's own `reasons` sentence carries the words too and this step relays it. An
    //    expectation that another source can satisfy is an expectation about nothing.
    const pages = stdout.split('\n').find((l) => /^\s+pages\s/.test(l));
    assert.ok(pages, `the per-pass breakdown is not printed at all:\n${stdout}`);
    assert.match(pages, /0 did NOT answer/, `the pass line calls a never-visited url a failure: ${pages}`);
    assert.match(pages, /\b9 never visited\b/, `the pass line does not count "never visited" apart: ${pages}`);
    assert.match(
      stdout,
      /never TRIED/,
      `nothing says WHY they were never visited — "the run's own ceiling arrived first" is the repair:\n${stdout}`,
    );
  } finally {
    box.close();
  }
});

test('★★ the breakdown is printed on a GREEN run too — a shape only ever seen in anger cannot be read', async () => {
  const box = await fakeBox({ warm: 'ok' });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 0, stdout);
    assert.match(stdout, /sto_CAFE/, `the per-store breakdown is missing on a green run:\n${stdout}`);
    assert.match(stdout, /pages\s+10 of 10 answered/, `the pass line is not printed on a green run:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★ a run with NO report is a different answer from a run that warmed nothing, and says so', async () => {
  const box = await fakeBox({ warm: 'failed' });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 1, stdout);
    assert.match(stdout, /no store claims the host/, `the run's own error is not relayed:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★ a run that never finishes is CUT and named — a birth may not hang on a poll', async () => {
  const box = await fakeBox({ warm: 'running' });
  try {
    const { stdout, status } = await runStep({ box, extra: ['--deadline-ms', '1500', '--poll-ms', '200'] });
    assert.equal(status, 1, `a run that never settled was not reported:\n${stdout}`);
    assert.match(stdout, /still running|deadline/i, stdout);
    assert.ok(box.asked.gets > 1, 'the step never polled — it cannot have waited');
  } finally {
    box.close();
  }
});

test('★★ a read face that refuses is THIS STEP\'s question failing, not the box\'s answer — exit 2', async () => {
  const box = await fakeBox({ warm: 'ok', storesStatus: 403 });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 2, `a question that could not be asked was reported as a box defect:\n${stdout}`);
    assert.match(stdout, /403/, stdout);
  } finally {
    box.close();
  }
});

// ── the threshold, which is DECLARED and never invented ───────────────────────────────────────────────────

test('★★★ the latency ceiling comes from seed/box.json, and a box that declares none says it asserts nothing', async () => {
  assert.ok(
    Object.hasOwn(BOX.warm ?? {}, 'threshold_ms'),
    'seed/box.json declares no `warm.threshold_ms` — the step would have to invent one',
  );
  const box = await fakeBox({ warm: 'ok', p95: 4000 });
  try {
    const { stdout, status } = await runStep({ box });
    if (BOX.warm.threshold_ms === null) {
      assert.equal(status, 0, stdout);
      // Silence about an assertion nobody made is how an unmeasured box reads as a fast one.
      assert.match(stdout, /no (latency )?(ceiling|threshold)/i, `the run does not say it asserts nothing about latency:\n${stdout}`);
    } else {
      assert.equal(status, BOX.warm.threshold_ms < 4000 ? 1 : 0, stdout);
    }
  } finally {
    box.close();
  }
});

test('★★★ …and when a ceiling IS declared, a p95 over it is REPORTED against it', async () => {
  const box = await fakeBox({ warm: 'ok', p95: 4000 });
  try {
    // `--threshold-ms` is how the declaration reaches the step, so overriding it here exercises exactly the
    // path a declared number takes. The endpoint is told too (`threshold_ms=`), which is what makes the run
    // itself say so in `reasons` on a real box.
    const { stdout, status } = await runStep({ box, extra: ['--threshold-ms', '800'] });
    assert.equal(status, 1, `a p95 of 4000 ms was not reported against a ceiling of 800 ms:\n${stdout}`);
    assert.match(stdout, /800/, stdout);
    assert.match(stdout, /4000/, stdout);
  } finally {
    box.close();
  }
});


// ── ★★ WHICH ADDRESS SPACE WAS WARMED, WHICH IS NOT THE SAME QUESTION AS WHETHER IT WARMED ───────────────
//
// The warmer decides a store's URLs by asking the PORT — `read.store.by_host` — whether the origin's own
// host resolves to it: yes → clean URLs (`/tenis`), no → path-scoped (`/s/<id>/tenis`). Those are two
// different sets of route-cache entries, so a run that warms the second while shoppers arrive on the first
// warms pages nobody opens and reports them as this shop's.
//
// ⛔ MEASURED ON THE LIVE BENCH, 04/09: `read.store.by_host` answers 404 for EVERY hostname this box uses —
// `localhost`, `localhost:8200`, `127.0.0.1:8200` and the tailnet name. The kernel's `store_directory` is
// empty here because this box resolves hosts through the FORGE_STORE_HOSTS override
// (`packages/storefront-kit/src/resolve-store.ts` checks it first, by design, and the warmer's
// `storeForOrigin` cannot see it). So the step SAYS which space it warmed rather than implying the other.

test('★★★ when no store claims the origin in the kernel directory, the run says which URLs it warmed', async () => {
  const box = await fakeBox({ warm: 'ok', directory: {} });
  try {
    const { stdout, status } = await runStep({ box });
    // Not red: the run really did warm what it was able to warm, and the operator cannot close this gap.
    assert.equal(status, 0, stdout);
    assert.match(stdout, /\/s\/<id>|path-scoped/i, `the run does not say which address space it warmed:\n${stdout}`);
    assert.match(stdout, /store\.by_host/, `the run does not name the read that decided it:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★ …and when a store DOES claim the origin, that is said too — the note closes itself', async () => {
  const box = await fakeBox({ warm: 'ok', directory: { '127.0.0.1': 'sto_CAFE' } });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 0, stdout);
    assert.match(stdout, /sto_CAFE[\s\S]{0,200}(root|clean)/i, `the run does not say the origin resolves to a store:\n${stdout}`);
    assert.ok(
      !/path-scoped/i.test(stdout),
      `the run still warns about path-scoped URLs on a box whose directory answers:\n${stdout}`,
    );
  } finally {
    box.close();
  }
});
