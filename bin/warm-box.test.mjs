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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
 * ★★★ pk22 — AND THIS FIXTURE IS NOW THE REAL BOX. It used to be the box of a hypothetical day: measured on
 * 2026-09-07 the live port answered `storefront_enabled: true` for `balcao`, because all four stores were
 * `active`. `seed/box.json` now declares `status: "private"` on the counter — its front is the totem — and
 * `bin/seed-box.mjs` writes it through `tenant.store.update`, so `false` here is what the port answers after
 * a birth. `CAFE_ON_THE_STREET` below stopped being «today» and became the counter PUT BACK on the street.
 */
const CAFE_STORES = [
  { id: 'sto_CAFE', handle: 'cafe', name: 'Forge Café', storefront_enabled: true },
  { id: 'sto_BALCAO', handle: 'balcao', name: 'Forge Café · Balcão', storefront_enabled: false },
];

/** The counter put back on the street (`status: "active"`) — no longer this box's state; see above. */
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
 * ★★★ A BOX WHOSE PLAN IS BIGGER THAN THE CEILING IT IS GIVEN — which is this box's every real birth.
 *
 * `warm: 'plan'` models the ONE arithmetic that produced `15865 urls were never visited` on every run: a warm
 * run fetches `ceiling ÷ msPerUrl` urls, in plan order, and never TRIES the rest. The ceiling is whatever the
 * caller sent as `max_duration_ms`, or the vitrine's own default when the caller sent none — so this fixture
 * answers a step that derives a ceiling differently from one that does not, which is exactly the difference
 * being graded. Nothing else here models the vitrine; the passes are the product's own shapes.
 *
 * ⚠️ IT REPORTS A DURATION, and that is not decoration: the step derives the ms-per-url from `finishedAt −
 * startedAt` over the urls the run WARMED. A fixture that answered instantly would hand the step a cost of
 * zero and the derivation would look right while deriving nothing.
 */
const VITRINE_DEFAULT_MAX_DURATION_MS = 15 * 60_000; // apps/storefront/src/lib/warm/warm.ts:51 (the product's)

function planReport({ pages, images, msPerUrl, ceilingMs, p95 }) {
  let budget = Math.floor(ceilingMs / msPerUrl);
  const take = (n) => {
    const done = Math.max(0, Math.min(n, budget));
    budget -= done;
    return { done, skipped: n - done };
  };
  // The order the product runs them in: every page, then the images those pages declared, then the verify
  // pass. Images are only DECLARED by pages that actually served, so a run cut in the pages pass plans none.
  const p = take(pages);
  const declaredImages = p.skipped === 0 ? images : 0;
  const i = take(declaredImages);
  const v = take(pages);
  const store = {
    store: 'sto_CAFE',
    url: 'http://127.0.0.1/s/sto_CAFE/',
    planned: pages,
    sections: {},
    short: [],
    pages: pass({ planned: pages, done: p.done, skipped: p.skipped, p95 }),
    images: {
      ...pass({ planned: declaredImages, done: i.done, skipped: i.skipped, p95 }),
      foreignHosts: [],
      declared: declaredImages,
      cut: false,
    },
    verify: pass({ planned: pages, done: v.done, skipped: v.skipped, p95 }),
  };
  const skipped = p.skipped + i.skipped + v.skipped;
  const reasons = skipped
    ? [`sto_CAFE: ${skipped} urls were never visited: the run hit its ceiling of ${ceilingMs}ms`]
    : [];
  return {
    elapsedMs: (p.done + i.done + v.done) * msPerUrl,
    report: {
      planned: pages + declaredImages,
      warmed: p.done + i.done,
      failed: 0,
      p95,
      p95Pass: 'verify',
      thresholdMs: null,
      stores: [store],
      reasons,
      ok: reasons.length === 0,
    },
  };
}

/**
 * A box that answers.
 *
 * `warm` decides what the vitrine does with a POST:
 *   'ok'         a run that finishes green
 *   'incomplete' a run that finishes with reasons — the shape of "some pages did not warm"
 *   'cut'        a run the CEILING cut: urls that were never TRIED — a FIXED shape, blind to the ceiling
 *   'plan'       a box that OBEYS the ceiling it is given: it fetches `ceiling ÷ msPerUrl` urls and no more
 *   'empty'      a run that finished `ok` having planned NOTHING (the vacuum)
 *   'failed'     a run with NO report at all (the origin could not even be planned)
 *   'absent'     the route is not there: an image built before the warmer existed
 *   'unauth'     the secret does not match
 *   'running'    a run that never finishes, for the deadline
 */
async function fakeBox({
  warm = 'ok',
  stores = CAFE_STORES,
  storesStatus = 200,
  p95 = 120,
  directory = {},
  credentialTenant = 'forgecafe',
  whoamiStatus = 200,
  plan = { pages: 400, images: 20_000, msPerUrl: 100 },
  /** ★ pk33 — store handle → the extension filling `storefront:gate`. `{}` is a box with no gate anywhere. */
  gates = {},
  /**
   * ★ pk34/d2 — the hosts the VITRINE'S image pass left unwarmed (`StoreReport.images.foreignHosts`,
   * apps/storefront/src/lib/warm/warm.ts:117). It is the product's own field and it carries HOSTS, never a
   * verdict: the vitrine knows which addresses it did not fetch, and nothing at all about which hosts this
   * box serves. `[]` is a run whose images were all at the vitrine's own doors.
   */
  foreignHosts = [],
} = {}) {
  const asked = { posts: [], calls: [], gets: 0, tenantHeaders: [] };
  let run = null;
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    // Recorded rather than honoured: this face ignores the header, and the point is that nothing sends it.
    if (req.headers['x-forge-tenant']) asked.tenantHeaders.push(`${req.method} ${url.pathname}`);
    const json = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    // ★ WHOSE TOKEN IS THIS. The internal read face resolves the tenant from the CREDENTIAL and ignores
    // `x-forge-tenant`, so a token can only ever be answered with its OWN tenant — `credentialTenant` and
    // `stores` move together for that reason, as they do in `bin/prove-doors.test.mjs`.
    if (url.pathname === '/v1/read/internal/whoami') {
      if (whoamiStatus !== 200) return json(whoamiStatus, { error: { kind: 'forbidden' } });
      return json(200, { actor_id: 'act_test', tenant_id: credentialTenant, scopes: [] });
    }
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
    // ★ pk33 — the ANONYMOUS read the store layout makes, which is where a gate is visible at all.
    if (url.pathname === '/v1/read/extensions') {
      const store = stores.find((row) => row.id === url.searchParams.get('store'));
      const app = store ? gates[store.handle] : undefined;
      return json(
        200,
        app ? [{ extension_id: app, hooks: [{ component: 'gate', target: 'storefront:gate', position: 0 }] }] : [],
      );
    }
    if (url.pathname === '/api/warm') {
      if (warm === 'absent') return json(404, { error: 'not found' });
      if (req.headers['x-revalidate-secret'] !== SECRET || warm === 'unauth') {
        return json(401, { ok: false, error: 'unauthorized' });
      }
      if (req.method === 'POST') {
        asked.posts.push(url.searchParams.getAll('store'));
        asked.calls.push(url.searchParams);
        const planned = url.searchParams.getAll('store').length * 10;
        // The ceiling this call is being run under: what the caller asked for, else the product's default.
        const ceilingMs = Number(url.searchParams.get('max_duration_ms') ?? VITRINE_DEFAULT_MAX_DURATION_MS);
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
                          images: { ...pass({ planned: 0, done: 0 }), foreignHosts, declared: 0, cut: false },
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
                    : warm === 'plan'
                      ? (() => {
                          const { report, elapsedMs } = planReport({ ...plan, ceilingMs, p95 });
                          return {
                            state: report.ok ? 'ok' : 'incomplete',
                            report,
                            // Backdated so the step can measure a COST — see planReport's header.
                            startedAt: new Date(Date.now() - elapsedMs).toISOString(),
                          };
                        })()
                      : warm === 'empty'
                        ? {
                            // ⚠️ THE VACUUM: a run that finished, said `ok`, and planned NOTHING. The
                            // vitrine reports this when no store claims the origin and none was named — and
                            // reading it as "warm" is how a box that warmed zero pages ships green.
                            state: 'ok',
                            report: {
                              planned: 0,
                              warmed: 0,
                              failed: 0,
                              p95: 0,
                              p95Pass: 'warm',
                              thresholdMs: null,
                              stores: [],
                              reasons: [],
                              ok: true,
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

/**
 * ★ EVERY RUN IS GIVEN A DECLARATION, because a real one always has one: `bin/box-up.sh` calls this step
 * from the repository whose `.env` it just wrote. The default is the honest empty case — this origin is
 * declared, and NO store is claimed at its root — which is what makes every test below about warmth rather
 * than about a box whose host map nobody can read. `storeHosts` sets that map; `noDeclaration: true` is the
 * blind box, and it is a test of its own.
 */
function declarationFor(box, storeHosts) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-warm-env-'));
  const file = join(dir, '.env');
  writeFileSync(
    file,
    `FORGE_PUBLIC_ORIGIN=${box.origin}\nFORGE_STORE_HOSTS='${JSON.stringify(storeHosts)}'\n`,
  );
  return { file, clean: () => rmSync(dir, { recursive: true, force: true }) };
}

async function runStep({
  box,
  tenant = 'forgecafe',
  secret = SECRET,
  token = TOKEN,
  extra = [],
  env = {},
  storeHosts = {},
  noDeclaration = false,
}) {
  const options = {
    encoding: 'utf8',
    env: {
      ...process.env,
      FORGE_SEED_TOKEN: token,
      FORGE_REVALIDATE_SECRET: secret,
      ...env,
    },
  };
  const declaration = noDeclaration || extra.includes('--env') ? null : declarationFor(box, storeHosts);
  const args = [STEP, '--tenant', tenant, '--api', box.origin, ...poll(extra)];
  if (declaration) args.push('--env', declaration.file);
  try {
    const { stdout, stderr } = await run_('node', args, options);
    return { stdout: `${stdout}${stderr}`, status: 0 };
  } catch (error) {
    return { stdout: `${error.stdout ?? ''}${error.stderr ?? ''}`, status: error.code ?? -1 };
  } finally {
    declaration?.clean();
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

test('★★★ …and a counter PUT BACK on the street is warmed again, with no edit here — the derivation says what IS', async () => {
  // ⛔ THE WHOLE VALUE OF DERIVING, IN ONE TEST. Measured on the live bench 2026-09-07 the port answered
  //    `storefront_enabled: true` for `balcao` and this step warmed it; pk22 declared the counter `private`
  //    and it stopped, with no edit in this file, in `bin/warm-box.mjs` or in `bin/servable.mjs`. Send
  //    `tenant.store.update {"status":"active"}` and it starts again, the same way. Under the hand-written
  //    `servable: false` this box skipped the counter whatever the port said — the file said one thing and
  //    the port said another, and nothing reconciled them. THIS is the test that would go red if a list ever
  //    came back.
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

// ── ★★★ pk25/d1 — AND THE OVERRIDE IS THE OTHER SOURCE, SO THE REPORT STOPS SAYING «warm» ────────────────
//
// ⛔ THE DEFECT: on this box the two facts above are BOTH true at once — `read.store.by_host` claims nobody,
// and `FORGE_STORE_HOSTS` serves one store at the root of the very origin being warmed. The step used to
// print the `⚠` line and then `VERDICT: warm`, exit 0. So every birth reported a warm shop while the pages
// it warmed (`/s/<id>/botas/chelsea`) were not the pages a visitor opens (`/botas/chelsea`): two route-cache
// trees, and the summary named the wrong one. The declaration is read now, and a run that warmed the tree
// nobody browses is a SHORTFALL — still not a gate, but no longer called warm.

test('★★★ a store this box SERVES at the root, warmed path-scoped, costs the verdict its «warm»', async () => {
  const box = await fakeBox({ warm: 'ok', directory: {} });
  try {
    // The bench, exactly: the directory is empty and the host map claims the origin for the shop.
    const { stdout, status } = await runStep({ box, storeHosts: { '127.0.0.1': 'sto_CAFE' } });
    assert.equal(status, 1, `a box warmed on the wrong address space came out warm:\n${stdout}`);
    assert.ok(!/VERDICT: warm\b/.test(stdout), `the verdict still calls this box warm:\n${stdout}`);
    assert.match(stdout, /did NOT come out fully warm/, stdout);
    // Named: the store, both trees, and the read that was blind to the override.
    assert.match(stdout, /sto_CAFE/, `the store at the root is not named:\n${stdout}`);
    assert.match(stdout, /path-scoped/i, `the tree that WAS warmed is not named:\n${stdout}`);
    assert.match(stdout, /ROOT/, `the tree that was NOT warmed is not named:\n${stdout}`);
    assert.match(stdout, /store\.by_host/, `the read that decided it is not named:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★ …and a root store that is NOT this tenant\'s is not this run\'s gap — green, and still said', async () => {
  // The bench again, seen from the OTHER tenant: the origin's root belongs to the shop, and every store this
  // run warms really is path-scoped. Reporting a shortfall here would be a red nobody can act on.
  const box = await fakeBox({ warm: 'ok', directory: {} });
  try {
    const { stdout, status } = await runStep({ box, storeHosts: { '127.0.0.1': 'sto_SOMEBODY_ELSE' } });
    assert.equal(status, 0, `another tenant's root store was charged to this run:\n${stdout}`);
    assert.match(stdout, /VERDICT: warm/, stdout);
    assert.match(stdout, /sto_SOMEBODY_ELSE/, `the store that owns the root is not named:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★★ the directory and the override naming DIFFERENT stores is worse than cold, and it is named', async () => {
  const box = await fakeBox({ warm: 'ok', directory: { '127.0.0.1': 'sto_CAFE' }, stores: CAFE_ON_THE_STREET });
  try {
    const { stdout, status } = await runStep({ box, storeHosts: { '127.0.0.1': 'sto_BALCAO' } });
    assert.equal(status, 1, `the two sources disagreeing about the root came out warm:\n${stdout}`);
    assert.match(stdout, /sto_CAFE/, stdout);
    assert.match(stdout, /sto_BALCAO/, stdout);
    assert.match(stdout, /resolve-store|override/i, `the report does not say which of the two the FRONT obeys:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★★ THE VACUUM: a run with no declaration to read says it DOES NOT KNOW, never «warm»', async () => {
  const box = await fakeBox({ warm: 'ok', directory: {} });
  try {
    const { stdout, status } = await runStep({ box, noDeclaration: true, extra: ['--env', '/nonexistent/.env'] });
    assert.equal(status, 1, `a run that could not learn the box's own routing reported warmth:\n${stdout}`);
    assert.match(stdout, /does not know/i, `the run does not say it could not tell:\n${stdout}`);
    assert.match(stdout, /--root-store|--env/, `the run does not say what would let it know:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★ --root-store is that same answer named by hand — the URL inventory\'s flag, same name', async () => {
  const box = await fakeBox({ warm: 'ok', directory: {} });
  try {
    const { stdout, status } = await runStep({
      box,
      noDeclaration: true,
      extra: ['--env', '/nonexistent/.env', '--root-store', 'sto_CAFE'],
    });
    // It knows now — and what it knows is the gap, not a green.
    assert.equal(status, 1, stdout);
    assert.ok(!/does not know/i.test(stdout), `the flag was ignored:\n${stdout}`);
    assert.match(stdout, /--root-store/, `the report does not say where the answer came from:\n${stdout}`);
    assert.match(stdout, /sto_CAFE/, stdout);
  } finally {
    box.close();
  }
});

test('★★★ a declaration that describes ANOTHER box is refused, not read — no fact is invented about it', async () => {
  const box = await fakeBox({ warm: 'ok', directory: {} });
  const dir = mkdtempSync(join(tmpdir(), 'forge-warm-other-'));
  const file = join(dir, '.env');
  // A laptop's own `.env`, while the operator warms the STAGING origin by hand. Its host map is a fact about
  // the laptop; reading this origin out of it would be a claim about a box this file has never seen.
  writeFileSync(
    file,
    `FORGE_PUBLIC_ORIGIN=https://some-other-box.example.test\nFORGE_STORE_HOSTS='${JSON.stringify({ '127.0.0.1': 'sto_CAFE' })}'\n`,
  );
  try {
    const { stdout, status } = await runStep({ box, noDeclaration: true, extra: ['--env', file] });
    assert.equal(status, 1, stdout);
    assert.match(stdout, /does not know/i, `the mismatched declaration was read anyway:\n${stdout}`);
    assert.match(stdout, /some-other-box\.example\.test/, `the report does not say which box the file describes:\n${stdout}`);
    assert.ok(
      !/sto_CAFE .{0,80}ROOT|ROOT.{0,80}sto_CAFE/.test(stdout),
      `a store was declared to be at the root of a box whose declaration this was not:\n${stdout}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
    box.close();
  }
});

// ── ★★★ THE DEADLINE DERIVES FROM THE PLAN (pk21/d2, Renan 07/09: *"deriva do plano"*) ────────────────────
//
// ⛔ THE DEFECT, MEASURED ON THREE BIRTHS AND AGAIN ON 07/09. The plan of this box is ~420 pages plus the
// ~20 400 IMAGE derivatives those pages declare in their `srcset`, against a ceiling of 900 000 ms that is
// not the box's — it is `DEFAULT_MAX_DURATION_MS` in the product (`apps/storefront/src/lib/warm/warm.ts:51`).
// `planned=20822 warmed=4964`, `15865 never visited`, EVERY run, by construction.
//
// ★ AND THE PRODUCT ALREADY EXPOSES THE FIX: `/api/warm?max_duration_ms=` overrides that default
// (`apps/storefront/src/app/api/warm/route.ts:183`). It was never true that this box "cannot raise" the
// ceiling — the file said so, and the file was wrong. What was missing is a NUMBER TO RAISE IT TO, and the
// only honest one is derived: how many urls the plan holds × what a url cost on this box, both MEASURED by
// the run that was cut. A bigger fixed number would be the same trap one house further along, which is why
// nothing below asserts a constant.

/** The `max_duration_ms` of each POST, in order. `null` for a call that sent none. */
const ceilings = (box) => box.asked.calls.map((p) => (p.has('max_duration_ms') ? Number(p.get('max_duration_ms')) : null));

test('★★★ a plan that does not fit the ceiling is RE-RUN under one DERIVED from it, and the box comes out WARM', async () => {
  // 400 pages + 20 000 images at 100 ms/url = 2 080 000 ms of work against the product's 900 000 default:
  // the first run is cut at 9 000 urls, exactly the shape of every birth of this box.
  const box = await fakeBox({ warm: 'plan', plan: { pages: 400, images: 20_000, msPerUrl: 100 } });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(ceilings(box).length, 2, `the step did not re-run under a derived ceiling:\n${stdout}`);
    const [first, second] = ceilings(box);
    assert.equal(first, null, 'the OBSERVATION run must use the product\'s own default, not a number this box chose');
    // The plan is 20 400 fetched urls plus the 400 the verify pass revisits, at the ~100 ms/url the cut run
    // measured. Asserted as a floor, never as an equality: the observed cost is a measurement.
    assert.ok(second >= 20_800 * 100, `the derived ceiling ${second}ms does not fit the plan it measured:\n${stdout}`);
    // ★ AND THE POINT OF THE WHOLE SLICE: the step is no longer red by construction.
    assert.equal(status, 0, `a box whose plan needs a derived ceiling did not come out warm:\n${stdout}`);
    assert.match(stdout, /VERDICT: warm/, stdout);
    assert.doesNotMatch(stdout, /never visited: \d/, `urls were still left unvisited:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★★ THE DEADLINE MOVES WITH THE PLAN — two plans, two ceilings, and the bigger plan gets the bigger one', async () => {
  // ⛔ THIS IS THE ASSERTION A FIXED NUMBER CANNOT PASS, whatever number is chosen. Same box, same cost per
  //    url, two catalogues: if the ceiling does not move, it is not derived from the plan.
  const small = await fakeBox({ warm: 'plan', plan: { pages: 200, images: 9_000, msPerUrl: 100 } });
  const big = await fakeBox({ warm: 'plan', plan: { pages: 400, images: 20_000, msPerUrl: 100 } });
  try {
    const a = await runStep({ box: small });
    const b = await runStep({ box: big });
    const [, ceilingSmall] = ceilings(small);
    const [, ceilingBig] = ceilings(big);
    assert.ok(ceilingSmall, `the small plan never derived a ceiling:\n${a.stdout}`);
    assert.ok(ceilingBig, `the big plan never derived a ceiling:\n${b.stdout}`);
    assert.ok(
      ceilingBig > ceilingSmall,
      `a plan 2.2× bigger got a ceiling of ${ceilingBig}ms against ${ceilingSmall}ms — the number is not derived from the plan`,
    );
    // Each fits ITS OWN plan: (pages + images + verify pages) × the cost that run measured.
    assert.ok(ceilingSmall >= 9_400 * 100, `${ceilingSmall}ms does not fit a 9 400-url plan:\n${a.stdout}`);
    assert.ok(ceilingBig >= 20_800 * 100, `${ceilingBig}ms does not fit a 20 800-url plan:\n${b.stdout}`);
  } finally {
    small.close();
    big.close();
  }
});

test('★★★ a run that was CUT names the PLAN that did not fit the ceiling — a number alone is not actionable', async () => {
  // The re-run is what repairs it; this is what the OPERATOR reads. `--no-derive` is the sabotage switch made
  // permanent: it is how this file proves the derivation is what moves the ceiling and not something else.
  const box = await fakeBox({ warm: 'plan', plan: { pages: 400, images: 20_000, msPerUrl: 100 } });
  try {
    const { stdout, status } = await runStep({ box, extra: ['--no-derive'] });
    assert.equal(ceilings(box).length, 1, 'the sabotage switch did not stop the re-run — it grades nothing');
    assert.equal(status, 1, `a cut run was not reported:\n${stdout}`);
    // The three facts an operator needs, and none of them is "it did not work": how big the plan is, what a
    // url cost, and how many urls the ceiling it ran under could ever have bought.
    assert.match(stdout, /20[\s.,]?800 url/, `the plan is not named:\n${stdout}`);
    assert.match(stdout, /ms\/url|ms per url/, `the measured cost per url is not printed:\n${stdout}`);
    assert.match(stdout, /derive/i, `nothing says the ceiling could have been derived:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★★ THE VACUUM: a run that finished having planned ZERO urls ACCUSES, never "warm"', async () => {
  // ⛔ MEASURED AGAINST THE PRE-pk21 FILE: `state: ok` with `planned=0` printed `✓ the stores — planned=0
  //    warmed=0` and `VERDICT: warm`, exit 0. A box that warmed nothing read exactly like a box that warmed
  //    everything, and a derivation over that plan would divide by it.
  const box = await fakeBox({ warm: 'empty' });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 1, `a run that planned nothing was called warm:\n${stdout}`);
    assert.doesNotMatch(stdout, /VERDICT: warm/, stdout);
    assert.match(stdout, /planned (NO|no|0 )/, `the verdict does not say the plan was empty:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★ a cut run that warmed NOTHING has no cost to derive from, and says that rather than inventing one', async () => {
  // A ceiling below the price of a single url. There is no ms-per-url to measure, so there is no derivation
  // to make — and a step that divided by zero here would send a birth off with `Infinity` in a query string.
  const box = await fakeBox({ warm: 'plan', plan: { pages: 400, images: 20_000, msPerUrl: 10_000_000 } });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(ceilings(box).length, 1, `a run that measured no cost was re-run anyway:\n${stdout}`);
    assert.equal(status, 1, stdout);
    assert.doesNotMatch(stdout, /Infinity|NaN/, `an unmeasurable cost reached the report as a number:\n${stdout}`);
    assert.match(stdout, /warmed no url|no observed cost/i, `the step does not say why it did not derive:\n${stdout}`);
  } finally {
    box.close();
  }
});

// ── ★★★ WHOSE CREDENTIAL IS THIS (§B5 of the pk18 notebook) ──────────────────────────────────────────────
//
// ⛔ THE DEFECT, found by `pk19/portas` on 2026-09-07 and left unrepaired here: this step sent a
// `x-forge-tenant` header that the internal read face IGNORES (it resolves the tenant from the CREDENTIAL —
// `docs/reference/read.internal.stores.md`), and never asked `whoami`. So with the wrong token in the shell
// it read ANOTHER tenant's stores, found none of the ones `seed/box.json` declares, and exited 3 —
// «the birth did not build it» — sending the operator to re-provision a perfectly healthy tenant. That is
// literally the damage written up at `bin/seed-box.mjs:346`. Three copies of this assertion now exist:
// `seed-box.mjs`, `prove-doors.mjs` (pk19) and this one.

test('★★★ a credential from ANOTHER tenant ⇒ "this step could not ask" (2), never "the birth did not build it" (3)', async () => {
  // The box is the CAFÉ's — its token, its identity, its stores — and the run asks for `forgeco`, whose two
  // stores it will not find. Before pk21 that was exit 3 with `forge` and `outlet` named as never built.
  const box = await fakeBox({ warm: 'ok', credentialTenant: 'forgecafe', stores: CAFE_STORES });
  try {
    const { stdout, status } = await runStep({ box, tenant: 'forgeco' });
    assert.equal(status, 2, `a swapped token accused the box instead of the question:\n${stdout}`);
    assert.match(stdout, /THIS CREDENTIAL BELONGS TO "forgecafe", NOT "forgeco"/, stdout);
    assert.doesNotMatch(stdout, /the birth did not create it/, `the innocent tenant is still accused:\n${stdout}`);
    assert.match(stdout, /Nothing above is a claim about forgeco/, stdout);
    // And nothing was warmed under the wrong name.
    assert.equal(box.asked.posts.length, 0, 'the step warmed a tenant it could not identify');
  } finally {
    box.close();
  }
});

test('★★ the no-op `x-forge-tenant` header is gone — a header that decides nothing reads like one that does', async () => {
  // ⚠️ ASSERTED ON THE WIRE, not on the source: the point is what the FACE receives. The tenant travels in
  //    the token, and `whoami` is what proves which one — a header suggesting otherwise is how the next
  //    reader concludes the list was filtered.
  const box = await fakeBox({ warm: 'ok' });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 0, stdout);
    assert.deepEqual(
      box.asked.tenantHeaders,
      [],
      'the step still sends `x-forge-tenant`, which this face ignores',
    );
  } finally {
    box.close();
  }
});

test('★★ a whoami the face refuses is THIS STEP\'s question failing — exit 2, and it names the read', async () => {
  const box = await fakeBox({ warm: 'ok', whoamiStatus: 401 });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 2, stdout);
    assert.match(stdout, /read\.internal\.whoami answered 401/, `the refusal does not name the read:\n${stdout}`);
  } finally {
    box.close();
  }
});

// ── ★★★ pk33 · A GATED STORE IS WARMED INTO THE GATE, AND THE REPORT SAYS SO ─────────────────────────────
//
// ⛔ MEASURED IN THE PRODUCT: the warmer runs inside the vitrine and its fetcher sets one header —
// `user-agent` (`apps/storefront/src/lib/warm/run.ts`, `withWarmerUserAgent` + `runPass`). No cookie. So on a
// store with a gate every visit answers the interstitial: 200, from the same container, with no `next/image`
// in it — the shop's caches stay cold and the image pass finds nothing. ⚠️ AND THE RUN STILL SAYS «warm»,
// because nothing in it can tell the two bodies apart. That is the disease this house chases: a signal that
// does not know it does not know.
//
// ⇒ the repair is one header, in the OTHER repository, and a slice names one repo. What is repaired here is
// the SILENCE, and these two tests are what keep it repaired.

test('★★★ a store with a GATE in front of it is named, and the report says the warming warmed the gate', async () => {
  const box = await fakeBox({ warm: 'ok', gates: { cafe: 'demo-gate' } });
  try {
    const { stdout, status } = await runStep({ box });
    // ⚠️ A REPORT AND NOT A RED, deliberately: warming has never graded this birth (see this file's header),
    // and turning a product defect into a failed birth would teach people to skip the step.
    assert.equal(status, 0, stdout);
    const line = stdout.split('\n').find((l) => l.includes('cafe') && l.includes('A GATE'));
    assert.ok(line, `the gated store is not named:\n${stdout}`);
    assert.match(line, /demo-gate/, `the notice does not name the gate the port declared: ${line}`);
    // ⚠️ THE CITATION, NOT THE OLD WORDS. This assertion read `/no dismissal cookie/` and went RED at
    //    `8215a38`, the commit that rewrote exactly this sentence and touched only `bin/warm-box.mjs` — the
    //    step stopped claiming the fetcher carries no cookie (it has since pk33) and started saying what it
    //    can see. What is graded is the ALLEGATION: the notice has to name the dismissal and say which of
    //    the two things gets warmed without it.
    assert.match(line, /dismissal/, `the notice does not say WHY it warms the wrong thing: ${line}`);
    assert.match(line, /warms the GATE and not the shop/, `the notice does not say WHAT gets warmed instead: ${line}`);
    // ⚠️ AND THE SAME COMMIT DELETED WHAT THIS ONE GRADED. It read `/COLD/` — the old notice told the
    //    operator to read the store as cold, which is a claim about a container this script cannot see into.
    //    `8215a38` replaced the verdict with the MEASUREMENT that settles it, so that is what is graded now:
    //    a gated store that warmed the gate finds zero images, because the interstitial carries no
    //    `next/image`. Grading the deleted word would only keep a red that names the wrong thing.
    assert.match(line, /images: 0 visited/, `the notice does not name the number that settles it: ${line}`);
    assert.match(line, /warm\/run\.ts/, `the notice does not name where the repair lives: ${line}`);
  } finally {
    box.close();
  }
});

test('★★ ANTI-VACUUM — a box with NO gate says nothing about gates, so the notice means something', async () => {
  // The other half, and it is the half that makes the first one a measurement: this notice must come from the
  // port's answer, never from the step having learned to print a warning.
  const box = await fakeBox({ warm: 'ok' });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 0, stdout);
    assert.doesNotMatch(stdout, /A GATE \(/, `a box with no gate anywhere still warns about one:\n${stdout}`);
  } finally {
    box.close();
  }
});

// ── ★★★ pk34/d2 · THE WARMER CALLED THIS BOX'S OWN HOST A STRANGER ───────────────────────────────────────
//
// ⛔ MEASURED ON THE BENCH `forge-preseed`, 2026-09-12, in EVERY store and EVERY pass:
//
//     images on hosts this box does not serve: $FORGE_TAILNET_HOST
//
// and that host is the box's own: two keys of `FORGE_STORE_HOSTS` in its `.env`, `VERDICT: settled` about it
// from `bin/verify-config.mjs`, and 200 from `read.store.by_host` for it (measured, from inside the kernel
// container). ⇒ THE SENTENCE WAS FALSE, and it was printed on every run — prose that ACCUSES teaches the
// reader to skip the whole report.
//
// ★ THE SHAPE OF THE DEFECT is this house's fio: the step asserted about the WORLD ("this box does not serve
// X") what the field only knows about the VITRINE ("I did not fetch images addressed at X"). `foreignHosts`
// is the vitrine's own list, and the vitrine has never been told which hosts this box answers on.
//
// ⚠️ AND THE BRIEF'S SUSPICION WAS WRONG, which is why this file measures rather than repeats it: it was NOT
// `host:port` against bare `host`. Measured over the bytes the bench served (`/`, `/tenis`, `/b/taft`, past
// the gate): the addresses are `https://$FORGE_TAILNET_HOST/v1/media/…` — the KERNEL's master url on the
// box's OWN origin, which the vitrine's classifier drops into `foreign` because the PATH is not one of its
// three image doors (apps/storefront/src/lib/warm/images.ts:17, :78, :86). Same host, different door. The
// product half is `pk34/p5`; what is repaired HERE is the sentence this repository prints about it.

test('★★★ a host this box SERVES is never reported as one it does not serve', async () => {
  const box = await fakeBox({ warm: 'ok', foreignHosts: ['127.0.0.1'], directory: { '127.0.0.1': 'sto_CAFE' } });
  try {
    const { stdout, status } = await runStep({ box, storeHosts: { '127.0.0.1': 'sto_CAFE' } });
    assert.equal(status, 0, stdout);
    // 1 · THE FALSE SENTENCE IS GONE for this host. Anchored on the host, so a line that merely mentions it
    //     somewhere else cannot pass this.
    const accusation = stdout
      .split('\n')
      .find((l) => l.includes('does not serve') && l.includes('127.0.0.1'));
    assert.equal(accusation, undefined, `the box's OWN host is still called foreign:\n${stdout}`);
    // 2 · …and the host is NOT dropped in silence: images that went unwarmed are still worth a line.
    const line = stdout.split('\n').find((l) => l.includes('UNWARMED'));
    assert.ok(line, `the unwarmed images were dropped instead of reported:\n${stdout}`);
    assert.match(line, /127\.0\.0\.1/, `the line does not name the host: ${line}`);
    // 3 · with the SOURCE that decided it, so a reader can ask the box the same question.
    assert.match(line, /FORGE_STORE_HOSTS/, `the line does not name what it graded the claim against: ${line}`);
    // 4 · and it points at the repository that classifies, because this one only relays the field.
    assert.match(line, /warm\/images\.ts/, `the line does not name where the classification lives: ${line}`);
  } finally {
    box.close();
  }
});

test('★★ THE WARNING SURVIVES — a host this box really does not serve is still accused, by name', async () => {
  // The half that keeps the repair honest: the defect was the FALSE positive, never the warning. A step that
  // answered the first test by deleting the sentence would pass it and lose the only thing it was for.
  const box = await fakeBox({
    warm: 'ok',
    foreignHosts: ['cdn.somebody-else.test'],
    directory: { '127.0.0.1': 'sto_CAFE' },
  });
  try {
    const { stdout, status } = await runStep({ box, storeHosts: { '127.0.0.1': 'sto_CAFE' } });
    assert.equal(status, 0, stdout);
    const line = stdout.split('\n').find((l) => l.includes('does not serve'));
    assert.ok(line, `a genuinely foreign host is no longer reported at all:\n${stdout}`);
    assert.match(line, /cdn\.somebody-else\.test/, `the foreign host is not named: ${line}`);
  } finally {
    box.close();
  }
});

test('★★★ ANTI-SUBSTRING — the two verdicts are decided host by host, in one run', async () => {
  // ⚠️ THIS HOUSE HAS PAID THREE TIMES THIS MONTH for an unanchored match (`/jq/` inside `/tmp/…zSYjqw`,
  // `die` inside `mens-calvin-klein-brodie-2`, `/demo/` inside `demorou`). The two hosts below share a
  // suffix on purpose: `127.0.0.1` is a SUBSTRING of `127.0.0.10`, and a classifier written with
  // `includes()` would call the second one served and print nothing about it.
  const box = await fakeBox({
    warm: 'ok',
    foreignHosts: ['127.0.0.1', '127.0.0.10'],
    directory: { '127.0.0.1': 'sto_CAFE' },
  });
  try {
    const { stdout, status } = await runStep({ box, storeHosts: { '127.0.0.1': 'sto_CAFE' } });
    assert.equal(status, 0, stdout);
    const accused = stdout.split('\n').find((l) => l.includes('does not serve'));
    assert.ok(accused, `the host outside the map is not accused at all:\n${stdout}`);
    assert.match(accused, /127\.0\.0\.10/, `the unserved host is missing from the accusation: ${accused}`);
    // …and the served one is NOT in that list. `\b` will not do here — `127.0.0.1` matches inside
    // `127.0.0.10` — so the assertion is on the list the line carries, split the way the step joins it.
    const named = accused.slice(accused.indexOf(':') + 1).split('·').map((s) => s.trim());
    assert.ok(
      !named.includes('127.0.0.1'),
      `the served host was swept into the accusation by a substring: ${accused}`,
    );
    const relayed = stdout.split('\n').find((l) => l.includes('UNWARMED'));
    assert.ok(relayed?.includes('127.0.0.1'), `the served host lost its own line: ${relayed}`);
  } finally {
    box.close();
  }
});

test('★★ ANTI-VACUUM — a run whose images were all at the vitrine\'s own doors says nothing about hosts', async () => {
  // The test above is only a measurement if this one is true: the lines must come from the field, never from
  // a step that learned to print them. A green earned by an empty list is a green about nothing.
  const box = await fakeBox({ warm: 'ok', directory: { '127.0.0.1': 'sto_CAFE' } });
  try {
    const { stdout, status } = await runStep({ box, storeHosts: { '127.0.0.1': 'sto_CAFE' } });
    assert.equal(status, 0, stdout);
    assert.doesNotMatch(stdout, /does not serve/, `a run with no foreign host still accuses one:\n${stdout}`);
    assert.doesNotMatch(stdout, /UNWARMED/, `a run with no foreign host still relays one:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★★ a run with NO declaration to grade against says it CANNOT TELL — it does not guess either way', async () => {
  // The third answer, and it is the one this house keeps losing: not knowing which hosts the box serves is a
  // different sentence from knowing it does not serve them. Both accusations are refused here.
  const box = await fakeBox({
    warm: 'ok',
    foreignHosts: ['cdn.somebody-else.test'],
    directory: { '127.0.0.1': 'sto_CAFE' },
  });
  try {
    const { stdout, status } = await runStep({
      box,
      noDeclaration: true,
      extra: ['--env', '/nonexistent/.env'],
    });
    assert.equal(status, 0, stdout);
    assert.doesNotMatch(stdout, /does not serve/, `a blind run still asserts what this box serves:\n${stdout}`);
    const line = stdout.split('\n').find((l) => l.includes('cdn.somebody-else.test'));
    assert.ok(line, `the blind run dropped the host entirely:\n${stdout}`);
    assert.match(line, /cannot say/i, `the blind run does not say it cannot tell: ${line}`);
  } finally {
    box.close();
  }
});

test('★★ THE PORT IS THE OTHER SOURCE — a host the DIRECTORY claims is not called foreign either', async () => {
  // ⛔ MEASURED, AND THE TWO SOURCES DISAGREE ON THE REAL BOX (`forge-preseed`, 12/09, asked from inside the
  // kernel container): `FORGE_STORE_HOSTS` carries EIGHT keys and `read.store.by_host` answers 200 for only
  // two of them — `$FORGE_TAILNET_HOST`, bare and `:8200`. `localhost`, `localhost:8200`,
  // `127.0.0.1`, `127.0.0.1:8200` and the short tailnet name are all 404 in the directory and all served by
  // the box, because
  // step 6b claims ONE host (the origin) and the OVERRIDE is what the fronts obey
  // (packages/storefront-kit/src/resolve-store.ts, checked before the port). ⇒ neither source alone answers
  // the question, and a step that trusted only the directory would call `localhost` foreign on this bench.
  const box = await fakeBox({ warm: 'ok', foreignHosts: ['127.0.0.1'], directory: { '127.0.0.1': 'sto_CAFE' } });
  try {
    const { stdout, status } = await runStep({
      box,
      noDeclaration: true,
      extra: ['--env', '/nonexistent/.env'],
    });
    assert.equal(status, 0, stdout);
    assert.doesNotMatch(stdout, /does not serve/, `the host the DIRECTORY claims is called foreign:\n${stdout}`);
    const line = stdout.split('\n').find((l) => l.includes('UNWARMED'));
    assert.ok(line, `the host the directory claims got no line at all:\n${stdout}`);
    assert.match(line, /read\.store\.by_host/, `the line does not name the source that answered: ${line}`);
  } finally {
    box.close();
  }
});
