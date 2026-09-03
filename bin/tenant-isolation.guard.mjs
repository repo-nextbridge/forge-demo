// ★★★ ONE TENANT, ONE BRAND — the guard for the crossing that every other check on this box was blind to.
//
//   node --test bin/tenant-isolation.guard.mjs        (or: bash bin/test.sh)
//
// ── WHAT WENT WRONG, MEASURED ON THE BENCH OF 02/09 ─────────────────────────────────────────────────────────
//
// The COFFEE tenant held the FOOTWEAR catalogue: 2 811 products where 21 belonged, 44 490 SKUs, 351 brands
// nobody sells, a category tree of botas/sandalias/sapatos/tenis, and eleven footwear custom fields
// (AMORTECIMENTO, CANO, DROP MM, PISADA, SOLADO, …) in the form of every café. The mirror was true as well:
// the footwear tenant's product form offered TORRA, FAZENDA, PRODUTOR and PONTUAÇÃO SCA. Every shoe offered
// a roast.
//
// ★ TWO CAUSES, ONE OWNER — AND ESTABLISHING THE OWNER WAS THE MOST VALUABLE PART OF THE MEASUREMENT.
//
//   · `bin/box-up.sh` step 9 ran `for t in $TENANTS`, and step 9 is `dist/seed-demo.js`: it fills the tenant
//     it is POINTED AT from whatever dataset the box mounts, and this box mounts ONE — the footwear one.
//   · `bin/seed.mjs` declared the coffee vocabulary on whatever tenant it was pointed at, and box-up points
//     it at both.
//
//   NEITHER is the kernel's. Proven, not assumed: the same handles carry DIFFERENT product ids in the two
//   schemas (`adidas-golf-braided-stretch-belt` is prod_01M1FRFC9D… in forgeco at 00:32:03 and
//   prod_01M1FS95MQ… in forgecafe at 00:46:08), so those were two independent, correctly-scoped writes and
//   not one leaking sideways. And the registry names the author of each vocabulary in its `source` column:
//   `merchant` for the nine coffee words (this repository's signature) and `app:demo-data` for the eleven
//   footwear ones (the dataset's, materialised at install). Both repairs therefore belong in THIS repository.
//
// ── ⚠️ WHY THIS FILE DRIVES THE SCRIPTS INSTEAD OF READING THEM ─────────────────────────────────────────────
//
// The rodada before this one shipped a guard that stayed green while the defect it named was live, because it
// checked the INPUT — the list a script was handed — instead of what came out. `seed/box.json` saying
// `dataset: false` is an input. So every assertion below is about an EFFECT: the commands that leave
// `bin/seed-box.mjs` through the door, the tenants the real shell derivation in `bin/box-up.sh` selects, and
// the lines `bin/verify-seed.mjs` prints when it is shown a tenant that holds another brand's catalogue.
//
// Both scripts talk HTTP to `--api`, so the door is a stub server here and the recording is the measurement.

import { execFile, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const BOX = readJson('seed/box.json');
const CATALOG = readJson('seed/catalog.json');
const TOTEM = readJson('seed/totem.json');

const datasetTenants = BOX.tenants.filter((t) => t.dataset === true).map((t) => t.id);
const plainTenants = BOX.tenants.filter((t) => t.dataset !== true).map((t) => t.id);

/**
 * A STUB KERNEL. It answers the reads these scripts ask and RECORDS every command they send — the recording
 * is the result under test. `state` is what the box is pretending to hold; anything unnamed answers empty,
 * which is the honest default for a virgin tenant.
 */
async function withDoor(state, run) {
  const sent = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const path = url.pathname;
    const answer = (body) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        sent.push({ name: path.replace('/v1/commands/', ''), input: raw ? JSON.parse(raw) : {} });
        // Every create answers an id: a script that reads one back must get something, and a script that
        // reads back `undefined` would skip its next step in silence — the exact class of bug being guarded.
        answer({ store_id: 'str_stub', zone_id: 'zon_stub', method_id: 'mtd_stub', id: 'stub' });
      });
      return;
    }
    const name = path.replace('/v1/read/internal/', '').replace('/v1/read/', '');
    if (name === 'whoami') return answer({ tenant_id: state.tenant });
    if (name === 'admin.by_host') return answer({ tenant_id: state.tenant });
    return answer(state.reads?.[name] ?? []);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const api = `http://127.0.0.1:${server.address().port}`;
  try {
    return await run({ api, sent });
  } finally {
    server.close();
  }
}

/**
 * Run one of the repo's scripts against the stub door. Never throws on a non-zero exit — the exit code and the
 * output are both part of what is being measured.
 *
 * ⚠️⚠️ ASYNCHRONOUS, AND THE SYNCHRONOUS VERSION DEADLOCKED — worth the line, because it hangs rather than
 * failing. The stub server lives in THIS process, so `execFileSync` blocks the event loop the server accepts
 * on: the child's very first request is never answered and both sides wait forever. A test that hangs reads
 * as a slow suite, not as a broken one.
 */
const run = promisify(execFile);
async function drive(script, args, api, extraEnv = {}, cwd = ROOT) {
  try {
    const { stdout, stderr } = await run(
      process.execPath,
      [join(cwd, 'bin', script), '--api', api, ...args],
      { env: { ...process.env, FORGE_SEED_TOKEN: 'stub-token', ...extraEnv }, encoding: 'utf8' },
    );
    return { code: 0, out: `${stdout}${stderr}` };
  } catch (err) {
    return { code: err.code ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

// ── 1. THE BOX SCRIPT'S OWN SELECTION, RUN RATHER THAN READ ─────────────────────────────────────────────────

test('★★★ box-up derives the step-9 tenants from box.json, and it is NOT the tenant list', () => {
  // ★ THE REAL LINE, EXECUTED. Lifting the `jq` out of bin/box-up.sh and running it against this repository's
  //   own topology is the difference between "the file contains a filter" and "the filter selects this". A
  //   regexp over the source would pass on a filter that selects everything.
  const derived = execFileSync(
    'bash',
    [
      '-c',
      `jq -r '.tenants[]|select(.dataset == true)|.id' "${join(ROOT, 'seed/box.json')}"`,
    ],
    { encoding: 'utf8' },
  )
    .split('\n')
    .filter(Boolean);
  assert.deepEqual(derived, datasetTenants);
  assert.ok(
    derived.length < BOX.tenants.length,
    'every tenant of this box carries the dataset, which is the state the 02/09 defect produced: one brand\'s ' +
      'catalogue in every tenant. If a second brand really did arrive with its own dataset, this box mounts ' +
      'only one directory and step 9 can still only fill from that one.',
  );
});

test('★★★ …and step 9 SKIPS the tenant the dataset is not about — the loop body run for real', () => {
  // The `case` from step 9, executed over this repository's real topology. It is the effect that matters:
  // which tenants reach `dist/seed-demo.js`.
  const script = `
    TENANTS="$(jq -r '.tenants[].id' "${join(ROOT, 'seed/box.json')}")"
    DATASET_TENANTS="$(jq -r '.tenants[]|select(.dataset == true)|.id' "${join(ROOT, 'seed/box.json')}")"
    for t in $TENANTS; do
      case " $DATASET_TENANTS " in
        *" $t "*) ;;
        *) continue ;;
      esac
      echo "$t"
    done`;
  const filled = execFileSync('bash', ['-c', script], { encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.deepEqual(filled, datasetTenants);
  for (const t of plainTenants) {
    assert.ok(!filled.includes(t), `"${t}" would be filled from a dataset that is not its brand's`);
  }
});

test('★★ the guard is CAPABLE of red — the same loop over a box.json that marks every tenant', () => {
  // ⚠️ A CONTROL, and this file is worth nothing without it. A selection that returns "only forgeco" proves
  //    nothing unless the same code returns both when both are marked.
  const dir = mkdtempSync(join(tmpdir(), 'forge-box-'));
  try {
    const crossed = { ...BOX, tenants: BOX.tenants.map((t) => ({ ...t, dataset: true })) };
    const path = join(dir, 'box.json');
    writeFileSync(path, JSON.stringify(crossed));
    const filled = execFileSync(
      'bash',
      ['-c', `jq -r '.tenants[]|select(.dataset == true)|.id' "${path}"`],
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean);
    assert.equal(filled.length, BOX.tenants.length, 'the filter must select what it is told to select');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 2. THE HALF OF THE ONE-SHOT THAT WAS NEVER THE DATASET'S ────────────────────────────────────────────────

test('★★★ a non-dataset tenant is provisioned by the BOX — apps, freight and the checkout flag leave the door', async () => {
  const tenant = plainTenants[0];
  const spec = BOX.tenants.find((t) => t.id === tenant);
  const { sent } = await withDoor(
    {
      tenant,
      // Its stores already exist (step 3 + an earlier run), so this measures the provisioning and not the
      // store creation. `masked_checkout_enabled: false` is the column's real default — the flag has to be
      // WRITTEN, and a stub that pretended it was already on would hide exactly what is being asserted.
      reads: {
        stores: spec.stores.map((s) => ({
          id: `str_${s.handle}`,
          handle: s.handle,
          theme_key: s.theme_key ?? 'vanilla',
          masked_checkout_enabled: false,
        })),
      },
    },
    async ({ api, sent }) => {
      const r = await drive('seed-box.mjs', ['--tenant', tenant], api);
      assert.equal(r.code, 0, `seed-box refused this tenant:\n${r.out}`);
      return { sent };
    },
  );

  const installs = sent.filter((c) => c.name === 'extension.install').map((c) => c.input.extension_id);
  assert.deepEqual(
    installs,
    spec.apps,
    'the apps step 9 used to install here as a side effect of filling a catalogue that is not this ' +
      "tenant's. Missing them, a coffee cart reaches the payment step with no method — a dead end that " +
      'reads as a broken checkout rather than as a missing install.',
  );

  const zones = sent.filter((c) => c.name === 'shipping.zone.create');
  const methods = sent.filter((c) => c.name === 'shipping.method.create');
  const rates = sent.filter((c) => c.name === 'shipping.rate.set');
  assert.equal(zones.length, 1, 'one zone, from the declaration');
  assert.deepEqual(
    methods.map((c) => c.input.name),
    spec.delivery.methods.map((m) => m.name),
  );
  assert.ok(
    methods.every((c) => c.input.kind === 'delivery'),
    'kind must be `delivery`: a `pickup` method here would make the counter\'s option the shop\'s freight',
  );
  assert.equal(rates.length, spec.delivery.methods.reduce((n, m) => n + m.rates.length, 0));
  // ⛔ THE PRECONDITION OF STEP 10, ASSERTED BY NAME. `seed-history` silences every active delivery method
  //    except the one $FORGE_HISTORY_KEEP_METHOD names and refuses a tenant that has none — so a birth whose
  //    box forgot this method fails two steps later, in a message about history.
  assert.ok(
    methods.some((c) => c.input.name === 'Entrega Padrão'),
    'step 10 keeps the method named by $FORGE_HISTORY_KEEP_METHOD (default "Entrega Padrão") and dies if the ' +
      'tenant has none. Renaming it here moves that failure to a step that will not explain it.',
  );

  const flag = sent.find(
    (c) => c.name === 'tenant.store.update' && c.input.masked_checkout_enabled !== undefined,
  );
  assert.ok(flag, 'the checkout flag was set inside the dataset one-shot; the box has to state it now');
  assert.equal(flag.input.id, 'str_cafe');
});

test('★★★ a DATASET tenant is left alone — its apps and freight have exactly one owner', async () => {
  const tenant = datasetTenants[0];
  const spec = BOX.tenants.find((t) => t.id === tenant);
  const { sent } = await withDoor(
    {
      tenant,
      reads: {
        stores: spec.stores.map((s) => ({
          id: `str_${s.handle}`,
          handle: s.handle,
          theme_key: s.theme_key ?? 'vanilla',
        })),
      },
    },
    async ({ api, sent }) => {
      const r = await drive('seed-box.mjs', ['--tenant', tenant], api);
      assert.equal(r.code, 0, r.out);
      return { sent };
    },
  );
  const trespass = sent.filter(
    (c) => c.name === 'extension.install' || c.name.startsWith('shipping.'),
  );
  assert.deepEqual(
    trespass,
    [],
    'this tenant is provisioned by `dist/seed-demo.js` at step 9. A second author here would create a SECOND ' +
      '"Entrega Padrão" — `populate` is idempotent by its own app ledger and cannot see a method this script ' +
      'wrote — and step 10 refuses a tenant with two active delivery methods.',
  );
});

test('★★★ …and declaring both owners is REFUSED before anything is written', async () => {
  // The failure this refusal prevents is a duplicate, and a duplicate is the one thing a re-run cannot undo.
  const tenant = datasetTenants[0];
  const spec = BOX.tenants.find((t) => t.id === tenant);
  const dir = mkdtempSync(join(tmpdir(), 'forge-box-'));
  try {
    // A copy of the repository's own box.json with the crossing put back in, applied through a real run.
    const crossed = {
      ...BOX,
      tenants: BOX.tenants.map((t) =>
        t.id === tenant ? { ...t, apps: ['banners'] } : t,
      ),
    };
    execFileSync('cp', ['-r', join(ROOT, 'bin'), join(ROOT, 'seed'), dir]);
    writeFileSync(join(dir, 'seed', 'box.json'), JSON.stringify(crossed));
    const { code, out } = await withDoor(
      { tenant, reads: { stores: spec.stores.map((s) => ({ id: `str_${s.handle}`, handle: s.handle })) } },
      async ({ api, sent }) => {
        const r = await drive('seed-box.mjs', ['--tenant', tenant], api, {}, dir);
        // ⚠️ NOTHING WRITTEN, not merely a non-zero exit: a refusal that arrives after half the commands is
        //    a worse state than no refusal at all.
        assert.deepEqual(sent, [], 'it refused AFTER writing — the assertion runs before the first command');
        return r;
      },
    );
    assert.notEqual(code, 0);
    assert.match(out, /two owners/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 3. THE VERDICT'S OWN TEETH — proven red against a box that holds the crossing ────────────────────────────

/** The reads `bin/verify-seed.mjs` asks, with the tenant's catalogue and vocabulary as the parameters under
 *  test. Everything else answers empty: the other sections then report their own ✗, which is fine — what is
 *  asserted below are the LINES of the two sections this slice added. */
function verifyState(tenant, { products, fields }) {
  const spec = BOX.tenants.find((t) => t.id === tenant);
  return {
    tenant,
    reads: {
      stores: spec.stores.map((s) => ({ id: `str_${s.handle}`, handle: s.handle })),
      products_admin: { total: products, items: [] },
      custom_field_definitions: fields,
      products: { total: 0, items: [] },
    },
  };
}

const COFFEE_WORDS = (CATALOG.custom_fields ?? []).map((f) => ({
  owner_entity: 'product',
  key: f.key,
  source: 'merchant',
}));
const COUNTER_WORDS = (TOTEM.custom_fields ?? []).map((f) => ({
  owner_entity: 'product',
  key: f.key,
  source: 'merchant',
}));
const SHOE_WORDS = ['amortecimento', 'cano', 'drop_mm', 'pisada', 'solado', 'uso'].map((key) => ({
  owner_entity: 'product',
  key,
  source: 'app:demo-data',
}));

test('★★★ the verdict SETTLES a coffee tenant that holds only its own', async () => {
  const tenant = plainTenants[0];
  // + the STOCK POOL: products of this tenant that no shop sells, and which the tenant nevertheless HOLDS.
  // Section 3 of the verifier counts what is held, so leaving them out of this number would assert that a
  // correct box is wrong.
  const held =
    CATALOG.products.length + CATALOG.stock_pool.products.length + TOTEM.products.length;
  const out = await withDoor(
    verifyState(tenant, { products: held, fields: [...COFFEE_WORDS, ...COUNTER_WORDS] }),
    async ({ api }) => (await drive('verify-seed.mjs', ['--tenant', tenant], api)).out,
  );
  assert.match(out, new RegExp(`✓ ${tenant} — ${held} product\\(s\\), exactly what this repository creates`));
  assert.match(out, /✓ the dataset vocabulary — absent/);
  assert.match(out, /✓ this tenant's own words/);
  assert.match(out, /✓ declared × landed/);
});

test('★★★ …and turns RED on the 02/09 bench, naming both halves of the crossing', async () => {
  const tenant = plainTenants[0];
  // ⛔ THE MEASURED NUMBER, not an invented one: 2 811 products in the coffee tenant on the bench of 02/09 —
  //    the dataset's 2 790 on top of what this repository writes here. Only the 2 790 is frozen; how many
  //    this repository creates is DERIVED, because that half is a dataset edit away (the stock pool added
  //    two on 03/09) and a typed number would make a correct box read as a leak of the wrong size.
  const mine = CATALOG.products.length + CATALOG.stock_pool.products.length + TOTEM.products.length;
  const out = await withDoor(
    verifyState(tenant, {
      products: 2790 + mine,
      fields: [...COFFEE_WORDS, ...COUNTER_WORDS, ...SHOE_WORDS],
    }),
    async ({ api }) => (await drive('verify-seed.mjs', ['--tenant', tenant], api)).out,
  );
  assert.match(
    out,
    new RegExp(
      `✗ forgecafe — ${2790 + mine} product\\(s\\), and this repository creates ${mine} here — 2790 came from`,
    ),
  );
  assert.match(out, /✗ the dataset vocabulary — 6 field\(s\) from another brand's catalogue/);
  assert.match(out, /amortecimento/);
  assert.doesNotMatch(out, /✓ the dataset vocabulary/);
});

test("★★★ …and RED on the mirror: a footwear tenant carrying the coffee shop's words", async () => {
  const tenant = datasetTenants[0];
  // The other direction, and it is the one a shop window cannot show: the products were fine, the FORM was
  // wrong. Every shoe offered a roast.
  const out = await withDoor(
    verifyState(tenant, { products: 2790, fields: [...SHOE_WORDS, ...COFFEE_WORDS] }),
    async ({ api }) => (await drive('verify-seed.mjs', ['--tenant', tenant], api)).out,
  );
  assert.match(out, /✗ this tenant's own words — /);
  assert.match(out, /torra/);
  // The catalogue half is right on this tenant — the dataset IS its brand's — and a guard that reddened both
  // halves for one defect would teach a reader to stop reading which one.
  assert.match(out, /✓ forgeco — 2790 product\(s\)/);
});

// ── 3b. THE SEED'S OWN EFFECT — which words actually leave the door, per tenant ──────────────────────────────
//
// ⚠️ THIS IS THE CHECK THE SOURCE-LEVEL ONE AT THE BOTTOM CANNOT REPLACE, and the difference is the lesson of
// the previous rodada. Grepping `bin/seed.mjs` for a key proves that ONE spelling of the defect is gone; it
// says nothing about a vocabulary that arrives by another road — read from a file, spread from a constant,
// declared by a module this file has never heard of. What a merchant's registry ends up holding is decided by
// the `custom_field.define` commands that leave the door, so those are what is recorded and counted here.
//
// The run dies partway (the stub answers no upload URL, so the photographs fail) and that is IRRELEVANT and
// deliberate: `customFields()` is the second step of the curated phase, so everything under test has already
// been sent. Asserting on the exit code would be asserting on the stub.

/** The `custom_field.define` commands one run of the curated seed sends, by owner entity. */
async function wordsDeclaredBy(tenant) {
  const spec = BOX.tenants.find((t) => t.id === tenant);
  return withDoor(
    {
      tenant,
      reads: {
        stores: spec.stores.map((s) => ({
          id: `str_${s.handle}`,
          handle: s.handle,
          theme_key: s.theme_key ?? 'vanilla',
          custom_fields: {},
        })),
      },
    },
    async ({ api, sent }) => {
      await drive('seed.mjs', ['--tenant', tenant, '--phase', 'curated'], api);
      const defines = sent.filter((c) => c.name === 'custom_field.define');
      return {
        product: defines.filter((c) => c.input.owner_entity === 'product').map((c) => c.input.key),
        store: defines.filter((c) => c.input.owner_entity === 'store').map((c) => c.input.key),
      };
    },
  );
}

test('★★★ the curated seed sends the coffee words ONLY on the tenant whose shop uses them', async () => {
  const coffeeKeys = (CATALOG.custom_fields ?? []).map((f) => f.key);

  // POSITIVE CONTROL FIRST. "No coffee words reached the shoe shop" is also true of a seed that declares
  // nothing at all, and a guard that cannot tell those apart has measured nothing.
  const cafe = await wordsDeclaredBy(plainTenants[0]);
  assert.deepEqual(
    cafe.product.filter((k) => coffeeKeys.includes(k)).sort(),
    [...coffeeKeys].sort(),
    'the coffee shop must still get its whole vocabulary — the fix is a gate, not a deletion',
  );

  const shoes = await wordsDeclaredBy(datasetTenants[0]);
  assert.deepEqual(
    shoes.product.filter((k) => coffeeKeys.includes(k)),
    [],
    `the shoe tenant was sent ${JSON.stringify(shoes.product)}. Nine coffee words used to arrive here because ` +
      'this seed ran once per tenant and declared them unconditionally — measured in the registry as ' +
      '`source = merchant` on forgeco. Every shoe in the shop offered a roast.',
  );

  // ★ AND THE STORE'S WORDS STAY EVERYWHERE, which is the boundary this fix must not overshoot. A cart has a
  //   name in every shop of every tenant; `vocabulary_*` is the mechanism, not somebody's vertical.
  for (const side of [cafe, shoes]) {
    assert.deepEqual(
      side.store.sort(),
      ['vocabulary_cart', 'vocabulary_cart_empty_title'],
      'the reserved store vocabulary is tenant-agnostic and must not have been gated with the product words',
    );
  }
});

// ── 4. THE DECLARATION THAT MOVED, AND WHERE IT MAY NOT GO BACK ──────────────────────────────────────────────

test('★★ the coffee vocabulary lives beside the coffees, and bin/seed.mjs declares none of its own', () => {
  assert.ok((CATALOG.custom_fields ?? []).length > 0, 'seed/catalog.json must carry the coffee vocabulary');
  const seed = readFileSync(join(ROOT, 'bin/seed.mjs'), 'utf8');
  // The nine keys, by their real names, against the file that used to hold them. A key put back as a literal
  // here would be declared on whatever tenant the run is pointed at again — which is the whole defect.
  for (const field of CATALOG.custom_fields) {
    assert.doesNotMatch(
      seed,
      new RegExp(`key: '${field.key}'`),
      `bin/seed.mjs declares "${field.key}" again. It runs once per tenant, so a product word written here ` +
        'reaches every tenant of the box — which is how the footwear shop came to offer TORRA and FAZENDA. ' +
        'The declaration belongs in seed/catalog.json, behind the same gate the six coffees are.',
    );
  }
});
