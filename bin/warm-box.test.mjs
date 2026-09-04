// ★★ THE BIRTH ENDS WARM, AND IT ENDS RED WHEN IT DOES NOT.
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

/** The stores the fake port reports for the coffee tenant — the counter among them, as the real one does. */
const CAFE_STORES = [
  { id: 'sto_CAFE', handle: 'cafe', name: 'Forge Café' },
  { id: 'sto_BALCAO', handle: 'balcao', name: 'Forge Café · Balcão' },
];

/**
 * A box that answers.
 *
 * `warm` decides what the vitrine does with a POST:
 *   'ok'         a run that finishes green
 *   'incomplete' a run that finishes with reasons — the shape of "some pages did not warm"
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
                ? { state: 'ok', report: { planned, warmed: planned, failed: 0, p95, p95Pass: 'warm', thresholdMs: null, stores: [], reasons: [], ok: true } }
                : warm === 'incomplete'
                  ? { state: 'incomplete', report: { planned, warmed: planned - 2, failed: 2, p95, p95Pass: 'warm', thresholdMs: null, stores: [], reasons: ['2 page(s) did not answer'], ok: false } }
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

test('★★★ the store this box declares NOT servable is skipped — and the skip is ANNOUNCED with its reason', async () => {
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
    // 3 · with the reason the DECLARATION gives, never one this file invented.
    const declared = BOX.tenants
      .flatMap((t) => t.stores)
      .find((s) => s.handle === 'balcao');
    assert.equal(declared.servable, false, 'seed/box.json no longer marks the counter unservable');
    const words = declared._servable_why.split(/[\s,.]+/).filter((w) => w.length > 6).slice(0, 3);
    assert.ok(
      words.some((w) => stdout.includes(w)),
      `the skip line carries none of the declared reason (${words.join(', ')}):\n${stdout}`,
    );
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

test('★★ a store this file declares and the box does not hold is RED — the birth did not build it', async () => {
  const box = await fakeBox({ warm: 'ok', stores: [{ id: 'sto_CAFE', handle: 'cafe', name: 'Forge Café' }] });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 1, `a missing declared store passed:\n${stdout}`);
    assert.match(stdout, /balcao[\s\S]{0,160}(not|missing)/i, stdout);
  } finally {
    box.close();
  }
});

// ── how it FAILS, which is the half the box is bought for ─────────────────────────────────────────────────

test('★★★ a vitrine that publishes no /api/warm fails BY NAME, and names the pin that explains it', async () => {
  const box = await fakeBox({ warm: 'absent' });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 1, `a 404 from the warmer passed:\n${stdout}`);
    assert.match(stdout, /404/, stdout);
    // The operator must not have to guess WHY the route is missing: this box pins its images by digest, and
    // an image older than the warmer is the one cause. `forge.lock` is where that is written down.
    assert.match(stdout, /forge\.lock|build-local/, `the failure does not point at the pin:\n${stdout}`);
  } finally {
    box.close();
  }
});

test('★★ a secret the container does not share fails BY NAME, never as "warming did not work"', async () => {
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

test('★★★ a run that came back INCOMPLETE is red, and it prints the run\'s own reasons', async () => {
  const box = await fakeBox({ warm: 'incomplete' });
  try {
    const { stdout, status } = await runStep({ box });
    assert.equal(status, 1, `an incomplete run passed:\n${stdout}`);
    assert.match(stdout, /2 page\(s\) did not answer/, `the run's reasons are not relayed:\n${stdout}`);
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
    assert.equal(status, 1, `a run that never settled passed:\n${stdout}`);
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

test('★★★ …and when a ceiling IS declared, a p95 over it turns the birth red', async () => {
  const box = await fakeBox({ warm: 'ok', p95: 4000 });
  try {
    // `--threshold-ms` is how the declaration reaches the step, so overriding it here exercises exactly the
    // path a declared number takes. The endpoint is told too (`threshold_ms=`), which is what makes the run
    // itself say so in `reasons` on a real box.
    const { stdout, status } = await runStep({ box, extra: ['--threshold-ms', '800'] });
    assert.equal(status, 1, `a p95 of 4000 ms passed a ceiling of 800 ms:\n${stdout}`);
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
