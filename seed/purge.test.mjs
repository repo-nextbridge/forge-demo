// THE CACHE BUST'S OWN TESTS — the half of `APOSENTA-VITRINE-MJS` that has a home in this repository.
//
// WHAT IS WORTH TESTING HERE. The bust is one `fetch` and a log line, so "it posts" proves nothing anybody
// was ever going to get wrong. What was ACTUALLY wrong for eight days, and what these break:
//
//   · IT COVERED ONE STORE. The whole point of moving it out of `seed/vitrine.mjs` is that the box has four
//     shops and one of them was busted. So the test hands the port THREE stores and demands three calls,
//     with the ids the PORT answered — never a handle typed in the seed.
//   · IT SPELT THE TAGS. `store:` and `extensions:` are the admin's own words; a typo here is a purge that
//     returns 200 `ok` and drops nothing, which is indistinguishable from working.
//   · IT DIED ON A HOOK THAT WAS NOT ANSWERING. The old one did not catch, so a storefront that was down
//     ended a birth in which every write had already landed.
//   · AND THE VACUUM: a port that lists NO store must say so, not report a successful purge of nothing.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { purgeStorefrontCache, purgeTagsFor } from './purge.mjs';

/** `read.internal.stores` as the seed's `rows()` hands it on. */
const rows = (payload) => payload.items;

const port = (stores, log = []) => ({
  api: 'http://edge:8200',
  read: async (name) => {
    assert.equal(name, 'stores', 'the bust asks the port which shops exist — nothing else');
    return { items: stores };
  },
  rows,
  log: (message) => log.push(message),
});

const THREE = [
  { id: 'sto_A', handle: 'forge' },
  { id: 'sto_B', handle: 'outlet' },
  { id: 'sto_C', handle: 'cafe' },
];

/** A `fetch` that records and answers 200. */
function recorder(answer = { ok: true, status: 200 }) {
  const calls = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return answer;
    },
  };
}

test('the tags are the admin\'s pair, in the admin\'s spelling', () => {
  assert.deepEqual(purgeTagsFor('sto_X'), ['extensions:sto_X', 'store:sto_X']);
});

test('EVERY store the port lists is busted, not the one shop a seeder happened to compose', async (t) => {
  t.after(() => {
    process.env.FORGE_REVALIDATE_SECRET = '';
  });
  process.env.FORGE_REVALIDATE_SECRET = 's3cret';
  const log = [];
  const rec = recorder();
  const ids = await purgeStorefrontCache(port(THREE, log), rec.fetch);

  assert.deepEqual(ids, ['sto_A', 'sto_B', 'sto_C']);
  assert.equal(rec.calls.length, 3, 'one request per store — the route caps repeated tags at 50 and slices silently');
  for (const [i, store] of THREE.entries()) {
    const { url, init } = rec.calls[i];
    assert.equal(
      url,
      `http://edge:8200/api/revalidate?tag=extensions%3A${store.id}&tag=store%3A${store.id}`,
      `store ${store.handle} was asked for by the id the PORT answered`,
    );
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['x-revalidate-secret'], 's3cret');
    // The line names the shop. A total ("3 stores busted") is the sentence that hid the one-store bust.
    assert.ok(
      log.some((l) => l.includes(store.handle) && l.includes(store.id)),
      `nothing in the log names ${store.handle}`,
    );
  }
});

test('no secret is a LINE naming every stale shop, never a failure and never a silent success', async (t) => {
  t.after(() => {
    process.env.FORGE_REVALIDATE_SECRET = '';
  });
  process.env.FORGE_REVALIDATE_SECRET = '   ';
  const log = [];
  const rec = recorder();
  const ids = await purgeStorefrontCache(port(THREE, log), rec.fetch);

  assert.equal(rec.calls.length, 0, 'no secret must not produce an unauthenticated request');
  assert.deepEqual(ids, ['sto_A', 'sto_B', 'sto_C'], 'the stores are still reported — the writes landed');
  const said = log.join('\n');
  assert.match(said, /FORGE_REVALIDATE_SECRET/);
  for (const store of THREE) {
    assert.ok(said.includes(store.handle), `the stale-shop line does not name ${store.handle}`);
  }
});

test('a hook that does not answer is SAID, and the run goes on — the writes had already landed', async (t) => {
  t.after(() => {
    process.env.FORGE_REVALIDATE_SECRET = '';
  });
  process.env.FORGE_REVALIDATE_SECRET = 's3cret';
  const log = [];
  let asked = 0;
  const failing = async () => {
    asked += 1;
    throw new Error('ECONNREFUSED');
  };
  await purgeStorefrontCache(port(THREE, log), failing);

  assert.equal(asked, 3, 'one store refusing must not stop the ones after it');
  const said = log.join('\n');
  assert.match(said, /ECONNREFUSED/);
  for (const store of THREE) assert.ok(said.includes(store.handle));
});

test('a non-2xx answer is reported with its status, never read as a bust', async (t) => {
  t.after(() => {
    process.env.FORGE_REVALIDATE_SECRET = '';
  });
  process.env.FORGE_REVALIDATE_SECRET = 's3cret';
  const log = [];
  const rec = recorder({ ok: false, status: 401 });
  await purgeStorefrontCache(port([THREE[0]], log), rec.fetch);
  assert.match(log.join('\n'), /HTTP 401/);
  assert.doesNotMatch(log.join('\n'), /busted/);
});

test('THE VACUUM: a port that lists no store says so instead of reporting a purge of nothing', async (t) => {
  t.after(() => {
    process.env.FORGE_REVALIDATE_SECRET = '';
  });
  process.env.FORGE_REVALIDATE_SECRET = 's3cret';
  const log = [];
  const rec = recorder();
  const ids = await purgeStorefrontCache(port([], log), rec.fetch);
  assert.deepEqual(ids, []);
  assert.equal(rec.calls.length, 0);
  assert.match(log.join('\n'), /no store/);
});
