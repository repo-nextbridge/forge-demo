// ★★ IB-3/IB-5 — THE LOCAL BENCH IS THE FORGE KIT, UNCHANGED, AND THIS BOX ENTERS IT ONLY THROUGH ITS SEAMS.
//
//   node --test bin/bench-kit.guard.mjs      (or: bash bin/test.sh)
//
// `bench/` is `templates/instance/bench/` of the Forge repository, copied at the commit `bench-kit.lock` names.
// The demo is the product's FIRST CLIENT: what it cannot express with the kit as shipped is a requirement on
// the kit (README §2, "What the kit bench does not cover"), and the day somebody edits `bench/up.sh` here to
// make the demo fit, the demo stops proving that the kit serves a client and starts proving that a client
// has to fork it. So:
//
//   1. EVERY KIT FILE IS THE COMMIT'S, BYTE FOR BYTE — sha256 against bench-kit.lock. The message says it out
//      loud: an edit here is a product requirement, not a local fix.
//   2. NOTHING UNDER bench/ THE LOCK DOES NOT NAME — a file ADDED to the kit's directory is a fork too. The
//      one file of ours there is bench/bench.env, the kit's declared seam, and the lock says so.
//   3. THE KIT RUNS THE DEMO'S HOOK — `bench/up.sh` itself, run in a COPY of this repository with `docker`,
//      `curl` and `node` replaced by recorders (nothing starts). Since IB-5 (kit of IB-4) the bench holds BOTH
//      tenants of seed/box.json: the hook seeds each with ITS credential (the file .forge-bench/tenants.json
//      names), hands the kit what only it learns (the café's store and the counter's, .forge-bench/hook.env —
//      what the café's fork and the totem start with), generates the café's edge rule from box-up's own
//      template, and opens every door of both. With FORGE_DEMO_BENCH_DATASET=1 it also runs the massive one-shot
//      THROUGH THE KIT (bench/compose.sh) for the tenant the dataset is about — never the café — then the window
//      and the data verdict for both; without it, none of them. Promoted to an IP, it claims the https door and
//      hands Node the certificates the kit proved it with (FORGE_BENCH_CA_FILE; without a CA the first live
//      promotion went red: every door «fetch failed»).
//
//      Since IB-7 (kit of IB-6) the totem's door is declared `:https`: promoted, the kit serves and proves it on
//      https://<address>:<block>63/ too, and the way back releases the admin addresses the promotion claimed.
//
// The real runs (a clean clone promoted to a LAN IP and back): RESULTADOS-ib-3 (one tenant), RESULTADOS-ib-5 (two),
// RESULTADOS-ib-7 (the totem by https on the IP).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK = JSON.parse(readFileSync(join(ROOT, 'bench-kit.lock'), 'utf8'));
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [relative(ROOT, join(dir, e.name))],
  );
}

const REQUIREMENT =
  'THIS IS A PRODUCT REQUIREMENT, NOT A LOCAL FIX. bench/ is the Forge instance template\'s bench, copied ' +
  'unchanged so that this demo proves the kit serves a client. If the demo needs the kit to behave ' +
  'differently, write the requirement down (file:line and what is missing — README §2, "What the kit bench ' +
  'does not cover") for templates/instance/bench/ in the Forge repository, restore the file, and take the ' +
  'fix when a new kit commit carries it (copy it over bench/, re-stamp bench-kit.lock).';

test('the lock names a whole commit and the kit it took from it', () => {
  assert.match(LOCK.source?.commit ?? '', /^[0-9a-f]{40}$/, 'bench-kit.lock must name the FULL commit the kit was copied from.');
  assert.equal(LOCK.source?.path, 'templates/instance/bench');
  // It sees its subjects: a lock that lost its entries would make the next rule pass on nothing.
  for (const f of ['bench/up.sh', 'bench/down.sh', 'bench/promote.sh', 'bench/lib.sh', 'bench/compose.bench.yml']) {
    assert.ok(LOCK.files?.[f], `bench-kit.lock does not name ${f}`);
  }
  assert.ok(LOCK.declaration?.['bench/bench.env'], 'bench-kit.lock must declare bench/bench.env as the seam of ours');
});

test('★★ every kit file under bench/ is, byte for byte, the one of the commit bench-kit.lock names', () => {
  const drift = [];
  for (const [file, want] of Object.entries(LOCK.files)) {
    const path = join(ROOT, file);
    if (!existsSync(path)) drift.push(`${file}: MISSING`);
    else if (sha256(path) !== want) drift.push(`${file}: sha256 ${sha256(path).slice(0, 12)}… ≠ the kit's ${want.slice(0, 12)}…`);
  }
  assert.deepEqual(drift, [], `bench/ is no longer the kit of ${LOCK.source.commit.slice(0, 9)}:\n  ${drift.join('\n  ')}\n\n${REQUIREMENT}`);
});

test('★ bench/ holds nothing the lock does not name (a file added to the kit is a fork too)', () => {
  const named = new Set([...Object.keys(LOCK.files), ...Object.keys(LOCK.declaration)]);
  // bench/certs/*.pem are a developer's own certificates for a promoted bench, git-ignored by the kit's rule.
  const extra = walk(join(ROOT, 'bench')).filter((f) => !named.has(f) && !/^bench\/certs\/[^/]+\.pem$/.test(f));
  assert.deepEqual(extra, [], `bench/ carries file(s) the kit did not ship: ${extra.join(', ')}.\n\n${REQUIREMENT}`);
});


// ── 3 · the kit's own up.sh, run in a copy of this repository with recorders for docker, curl and node ────────

const TENANTS = ['forgeco', 'forgecafe'];
// What the recorders mint per tenant — compared here, never written to the log the assertions read.
const operatorOf = (t) => `fake-operator-${t}-ib5-9f1c`;
const driverOf = (t) => `fake-driver-${t}-ib5-77a0`;
const storeOf = (t) => `sto_FAKE${t.toUpperCase()}`;
const PLATFORM = 'fake-platform-credential-ib5-4e2b';
const COUNTER = 'sto_FAKECOUNTERBALCAO';

// docker: records each call (and, for an `up`, the two ids the café's services start with), and answers what
// the kit asks — the project's services (FORGE_BENCH_AFTER_HOOK is checked against them), provision-ref per
// tenant, the platform credential, the mailbox certificate, the promoted edge's CA.
const FAKE_DOCKER = String.raw`#!/usr/bin/env bash
line="docker $*"
case "$*" in *' up '*) line="$line ⟨totem=$FORGE_TOTEM_STORE_ID coffee=$FORGE_COFFEE_STORE_ID⟩" ;; esac
echo "$line" >> "$IB5_LOG"
if [ "$1" = run ]; then
  # the mailbox certificate: docker run … -v <dir>:/out postgres:18 openssl …
  while [ $# -gt 0 ]; do case "$1" in -v) out="$(printf %s "$2" | sed 's#:/out$##')"; shift 2 ;; *) shift ;; esac; done
  touch "$out/bench-mail.key" "$out/bench-mail.crt"; exit 0
fi
[ "$1" = ps ] && exit 0
case "$*" in
  # IB-9: with the kit's send-for-real overlay merged (\`mailpit: !reset null\`) the real compose lists no mailbox.
  *'mail.compose.yml'*'config --services'*) printf '%s\n' postgres redis kernel storefront checkout admin caddy storefront-coffee totem ;;
  *'config --services'*) printf '%s\n' postgres redis mailpit kernel storefront checkout admin caddy storefront-coffee totem ;;
  *dist/provision-ref.js*)
    t="$(printf '%s\n' "$@" | sed -n 's/^FORGE_REF_TENANT=//p')"; [ -n "$t" ] || t=forgeco
    printf '  operator token\n  fake-operator-%s-ib5-9f1c\n  login-driver token\n  fake-driver-%s-ib5-77a0\n' "$t" "$t" >&2
    echo "sto_FAKE$(printf %s "$t" | tr '[:lower:]' '[:upper:]')" ;;
  *dist/admin-platform-token.js*) echo "$IB5_PLATFORM" ;;
  *dist/seed-demo.js*) echo '[seed-demo] done (fake)' ;;
  # SH-2 · the kernel's own seed-history, answering as each image does (report on stdout, words on stderr):
  # IB5_HISTORY_IMAGE=v032 (the pinned one, the default) has no "mode" and SKIPS a tenant with a past;
  # IB5_HISTORY_IMAGE=sh1 (product e0f025738) decides by state: full · top-up · up-to-date · refused.
  *dist/seed-history.js*)
    img="$IB5_HISTORY_IMAGE"; [ -n "$img" ] || img=v032; past="$IB5_HISTORY_PAST"; [ -n "$past" ] || past=none
    case "$img:$past" in
      v032:none) echo '[seed-history] history: done — 720 orders (fake)' >&2; echo '{"orders":720,"skipped":false}' ;;
      v032:*) echo '[seed-history] history: 306 order(s) older than 90 days are already here — SKIPPING.' >&2; echo '{"orders":0,"skipped":true}' ;;
      sh1:none) echo '[seed-history] history: done — 720 orders (fake)' >&2; echo '{"orders":720,"skipped":false,"mode":"full"}' ;;
      sh1:has) echo '[seed-history] history: top-up — 51 orders (fake)' >&2; echo '{"orders":51,"skipped":false,"mode":"top-up"}' ;;
      sh1:today) echo '[seed-history] history: up to date (fake)' >&2; echo '{"orders":0,"skipped":true,"mode":"up-to-date"}' ;;
      sh1:foreign) echo '[seed-history] history: 12 order(s) are not a recorded past — refusing (fake)' >&2; echo '{"orders":0,"skipped":true,"mode":"refused"}' ;;
    esac ;;
  # a promoted bench exports the edge's local CA: … cp edge-tls:/data/caddy/pki/authorities/local/root.crt <dest>
  *' cp edge-tls:'*) for last in "$@"; do :; done; echo 'FAKE CA' > "$last" ;;
esac
exit 0
`;
// curl: the kit's door probes get 200; the hook's reads get what a bench answers — the café's stores (to learn
// the counter), and for step 10 (SH-2) the delivery methods (two active: the history sells through one), the
// buyer mail's channels (silent, unless IB5_MAIL_ARMED=1) and the notification queue. The hook's reads and
// commands are recorded (method, url, body — never a header, so never a credential).
const FAKE_CURL = String.raw`#!/usr/bin/env bash
url=''; data=''; method=GET
while [ $# -gt 0 ]; do case "$1" in -X) method="$2"; shift 2 ;; -d) data="$2"; shift 2 ;; http*) url="$1"; shift ;; *) shift ;; esac; done
case "$url" in */v1/*) echo "curl $method $url $data" >> "$IB5_LOG" ;; esac
case "$url" in
  */v1/read/internal/stores*) printf '[{"id":"%s","handle":"cafe"},{"id":"%s","handle":"balcao"}]' "$IB5_CAFE_STORE" "$IB5_COUNTER" ;;
  */v1/read/internal/shipping_methods_admin*)
    # the tenant this read is for is in a header; IB5_NO_METHODS answers [] for every tenant (sh2, 2026-10-11:
    # forgeco without the massive catalogue has no shipping method at all)
    [ "$IB5_NO_METHODS" = 1 ] && { printf '[]'; exit 0; }
    printf '[{"id":"shm_PADRAO","name":"Entrega Padrão","kind":"delivery","active":true},{"id":"shm_EXPRESSA","name":"Entrega Expressa","kind":"delivery","active":true},{"id":"shm_BALCAO","name":"Retirar no balcão","kind":"pickup","active":true}]' ;;
  */v1/read/internal/notification_types*)
    printf '[{"key":"order.placed","channels":[{"channel_key":"email","enabled":%s}]}]' "$([ "$IB5_MAIL_ARMED" = 1 ] && echo true || echo false)" ;;
  */v1/read/internal/notifications*) printf '{"total":0}' ;;
  */v1/commands/*) printf '{}' ;;
  *) printf 200 ;;
esac
`;
// node: the version require-node.sh asks, then every script the hook runs, with WHOSE credential it carried
// (the tenant it was minted for — the credential itself is never written down).
const FAKE_NODE = String.raw`#!/usr/bin/env bash
case "$1" in -v|--version) echo v24.18.0; exit 0 ;; esac
tok=absent
case "$FORGE_OPERATOR_TOKEN" in fake-operator-*-ib5-9f1c) tok="$(printf %s "$FORGE_OPERATOR_TOKEN" | sed 's/^fake-operator-//; s/-ib5-9f1c$//')" ;; ?*) tok=OTHER ;; esac
ca="$NODE_EXTRA_CA_CERTS"; [ -n "$ca" ] || ca=none
ds="$FORGE_SEED_DATASET_DIR"; [ -n "$ds" ] || ds=none
echo "node $* ds=$ds token=$tok ca=$ca" >> "$IB5_LOG"
exit 0
`;

/** A copy of what `bench/up.sh` and the hook read, outside this repository, with the three recorders first on PATH. */
function benchCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'ib5-kit-'));
  const shop = join(dir, 'shop');
  for (const p of ['bench', 'bench-demo', 'bin/images-from-lock.sh', 'bin/require-node.sh', 'bin/box-up.sh', 'bin/history-mode.sh', 'forge.lock',
    'compose.yml', 'compose.override.yml', 'seed/box.json']) {
    cpSync(join(ROOT, p), join(shop, p), { recursive: true });
  }
  rmSync(join(shop, '.forge-bench'), { recursive: true, force: true });
  const fake = join(dir, 'fake');
  mkdirSync(fake);
  for (const [name, body] of [['docker', FAKE_DOCKER], ['curl', FAKE_CURL], ['node', FAKE_NODE]]) {
    writeFileSync(join(fake, name), body);
    chmodSync(join(fake, name), 0o755);
  }
  return { dir, shop, fake, log: join(dir, 'calls.log') };
}

const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

function up(extraEnv = {}) {
  const c = benchCopy();
  const env = {
    PATH: `${c.fake}:/usr/bin:/bin`,
    HOME: c.dir,
    COMPOSE_PROJECT_NAME: 'ib5-guard',
    FORGE_BENCH_PORT_BLOCK: '71',
    IB5_LOG: c.log,
    IB5_PLATFORM: PLATFORM,
    IB5_CAFE_STORE: storeOf('forgecafe'),
    IB5_COUNTER: COUNTER,
    ...extraEnv,
  };
  const r = spawnSync('bash', [join(c.shop, 'bench', 'up.sh')], { cwd: c.shop, env, encoding: 'utf8' });
  const calls = read(c.log).split('\n').filter(Boolean);
  const state = join(c.shop, '.forge-bench');
  const files = {
    tenants: read(join(state, 'tenants.json')),
    hookEnv: read(join(state, 'hook.env')),
    coffee: read(join(c.shop, 'caddy', 'extra-local', 'coffee.caddy')),
  };
  rmSync(c.dir, { recursive: true, force: true });
  return { rc: r.status, out: `${r.stdout}${r.stderr}`, calls, files, nodes: calls.filter((l) => l.startsWith('node ')) };
}

const script = (l) => l.split(' ')[1] + (l.includes('--phase window') ? ' window' : '');
const tenantOf = (l) => / --tenant (\S+) /.exec(l)?.[1];
const steps = (nodes) => nodes.map((l) => `${script(l)} ${tenantOf(l)}`);

test('★★ bench/up.sh runs the hook bench/bench.env declares, and it seeds BOTH tenants, each with its own credential', () => {
  const { rc, out, nodes, calls, files } = up();
  assert.equal(rc, 0, `bench/up.sh (the kit's) did not finish on the copy:\n${out.slice(-2500)}`);
  assert.match(out, /7\/8 the seed hook: bash bench-demo\/seed-hook\.sh/, 'the kit did not announce the demo\'s hook');
  // The kit was told about both tenants, and the hook read them from the kit's own list.
  assert.deepEqual(JSON.parse(files.tenants).map((t) => t.tenant), TENANTS, 'the kit did not provision the two tenants of seed/box.json');
  assert.deepEqual(
    steps(nodes),
    ['bin/seed-box.mjs forgeco', 'bin/seed-box.mjs forgecafe', 'bin/store-host.mjs forgeco', 'bin/seed.mjs forgeco',
      'bin/seed.mjs forgecafe', 'bin/prove-doors.mjs forgeco', 'bin/prove-doors.mjs forgecafe'],
    `the hook did not run the box's seed in box-up's order, for both tenants (6, 6b, 8, 14-bis):\n  ${nodes.join('\n  ')}`,
  );
  for (const l of nodes) {
    assert.match(l, /--api http:\/\/localhost:7100( |$)/, `not the shop's loopback door of block 71: ${l}`);
    // Each tenant's script carries THAT tenant's credential, the one the kit filed for it.
    assert.match(l, new RegExp(` token=${tenantOf(l)} `), `not the credential the kit minted for ${tenantOf(l)}: ${l}`);
    // On localhost there is no CA to hand over, and none is invented.
    assert.match(l, / ca=none$/, `a CA was handed to Node on a localhost bench: ${l}`);
  }
  assert.match(nodes[2], new RegExp(`--origin http://localhost:7100 --store ${storeOf('forgeco')} `), 'store-host did not claim the kit\'s origin for the root store');
  for (const secret of [...TENANTS.flatMap((t) => [operatorOf(t), driverOf(t)]), PLATFORM]) {
    assert.ok(!out.includes(secret), 'a credential the kit minted reached the output');
  }
  // What only the hook can learn reaches the kit, and the café's two services start WITH it — before 14-bis
  // opens their doors (left to the kit's step 8 they answered 502 to it, measured live in IB-4).
  assert.equal(files.hookEnv, `FORGE_COFFEE_STORE_ID=${storeOf('forgecafe')}\nFORGE_TOTEM_STORE_ID=${COUNTER}\n`, 'the hook did not hand the kit the café\'s two ids');
  const cafeUp = calls.findIndex((l) => / up -d --wait --no-deps storefront-coffee totem /.test(l));
  assert.ok(cafeUp >= 0, `the café's fork and the totem were never started:\n  ${calls.join('\n  ')}`);
  assert.match(calls[cafeUp], new RegExp(`⟨totem=${COUNTER} coffee=${storeOf('forgecafe')}⟩`), `the café's services started without what the hook learned: ${calls[cafeUp]}`);
  assert.match(calls[cafeUp], /-f \S+\/bench\/compose\.bench\.yml/, `the café's services did not go through the kit's compose: ${calls[cafeUp]}`);
  assert.ok(cafeUp < calls.findIndex((l) => l.startsWith('node bin/prove-doors.mjs')), 'the café\'s doors were opened before its services started');
  // The café's edge rule, from box-up's own template, with the café's id — and the edge restarted to read it.
  assert.match(files.coffee, new RegExp(`handle /s/${storeOf('forgecafe')}\\* \\{\\n\\theader X-Forge-Served-By "storefront-coffee"`), `the café's edge rule was not generated:\n${files.coffee}`);
  assert.ok(calls.some((l) => / restart caddy/.test(l)), 'the edge was not restarted with the café\'s rule');
  // Without the ask, the massive one-shot never runs, and neither do the steps that need it — and the kit says so.
  assert.ok(!calls.some((l) => l.includes('seed-demo')), 'seed-demo ran on a bench that did not ask for the dataset');
  assert.ok(!nodes.some((l) => /verify-seed|--phase window/.test(l)), 'the window or verify-seed ran with no massive catalogue: verify-seed is red by construction there');
  assert.match(out, /the seed hook reports:\n.*· 9, 11, 12 skipped — the massive catalogue is asked with FORGE_DEMO_BENCH_DATASET=1/);
});

// ★ MZ-6/D5 — the kit lays a second tenant's admin on <block>21 (bench/lib.sh bench_ports), not on the
// `localhost:82NN` seed/box.json declares for box-up. Measured 2026-10-13: every kit bench's step 6 asked the
// directory about `localhost:<block>02` for the café — a door nobody on the bench claims — and warned
// «admin host … answers (nobody)» with a repair that would claim it. The hook now hands seed-box the door the
// kit itself filed (tenants.json `admin_loopback_origin`), on localhost and promoted alike (the loopback door is
// claimed either way).
for (const [where, extra] of [['on localhost', {}], ['promoted to an IP', { FORGE_BENCH_ADDRESS: '192.0.2.20' }]]) {
  test(`★ MZ-6/D5 · ${where}, seed-box verifies the admin door THE KIT claimed for each tenant — the café's is <block>21, never 82NN's <block>02`, () => {
    const { rc, out, nodes, files } = up(extra);
    assert.equal(rc, 0, `bench/up.sh did not finish:\n${out.slice(-2500)}`);
    const filed = Object.fromEntries(JSON.parse(files.tenants).map((t) => [t.tenant, t.admin_loopback_origin]));
    assert.deepEqual(filed, { forgeco: 'http://localhost:7101', forgecafe: 'http://localhost:7121' }, 'the kit filed other admin doors than this rule was written against');
    const seedBox = nodes.filter((l) => l.startsWith('node bin/seed-box.mjs'));
    assert.equal(seedBox.length, 2, `seed-box ran ${seedBox.length} time(s):\n  ${nodes.join('\n  ')}`);
    for (const l of seedBox) {
      const door = new URL(filed[tenantOf(l)]).host;
      assert.match(l, new RegExp(` --admin-host ${door}( |$)`), `seed-box for ${tenantOf(l)} was not handed the admin door the kit claimed (${door}): ${l}`);
    }
    assert.ok(!seedBox.some((l) => /--admin-host localhost:7102( |$)/.test(l)), 'the café was verified on box-up\'s <block>02 again');
  });
}

test('★ FORGE_DEMO_BENCH_DATASET=1: the massive one-shot runs THROUGH THE KIT for the dataset\'s tenant only, then the window and the verdict for both', () => {
  const { rc, out, nodes, calls } = up({ FORGE_DEMO_BENCH_DATASET: '1' });
  assert.equal(rc, 0, `bench/up.sh with the dataset asked did not finish:\n${out.slice(-2500)}`);
  // ⛔ A container path never reaches a host script: bench/bench.env says /app/seed-dataset for the KERNEL.
  // Measured live 2026-10-10 without this: step 11 «FORGE_SEED_DATASET_DIR=/app/seed-dataset holds no …».
  for (const l of nodes) assert.match(l, / ds=\/\S+\/shop\/seed\/dataset /, `a host script was handed a container path (or none): ${l}`);
  const seedDemo = calls.filter((l) => l.includes('dist/seed-demo.js'));
  // ⛔ ONE run, for forgeco: the café is never filled with the footwear dataset (box-up's step 9 rule, 02/09).
  assert.equal(seedDemo.length, 1, `seed-demo should run once, for the dataset's tenant:\n  ${seedDemo.join('\n  ')}`);
  // Through bench/compose.sh: the kit's file list (its overlay), never a bare `docker compose`.
  assert.match(seedDemo[0], /-f \S+\/bench\/compose\.bench\.yml/, `seed-demo did not go through the kit's compose: ${seedDemo[0]}`);
  assert.match(seedDemo[0], /-e FORGE_REF_TENANT=forgeco -e FORGE_REF_STORE_HANDLE=forge -e FORGE_SEED_DEMO=1 /);
  assert.match(out, /seed-demo for "forgeco" ended after 0 min \(rc=0\)/, 'box-up\'s speaking block did not run');
  assert.match(out, /9 · forgecafe does not carry the example dataset/, 'the café was skipped without a word');
  assert.deepEqual(steps(nodes), [
    'bin/seed-box.mjs forgeco', 'bin/seed-box.mjs forgecafe', 'bin/store-host.mjs forgeco',
    'bin/seed.mjs forgeco', 'bin/seed.mjs forgecafe',
    'bin/seed.mjs window forgeco', 'bin/seed.mjs window forgecafe',
    'bin/verify-seed.mjs forgeco', 'bin/verify-content.mjs forgeco', 'bin/verify-seed.mjs forgecafe', 'bin/verify-content.mjs forgecafe',
    'bin/prove-doors.mjs forgeco', 'bin/prove-doors.mjs forgecafe',
  ]);
  for (const l of nodes) assert.match(l, new RegExp(` token=${tenantOf(l)} `), `not the credential the kit minted for ${tenantOf(l)}: ${l}`);
  assert.ok(!/· 9, 11, 12 skipped/.test(out), 'the kit was told 9, 11, 12 were skipped on a run that ran them');
  // SH-2 · box-up's order: 9 (the massive) → 10 (the past, inside the silence) → 10b (the queue drained) → 11.
  const at = (re) => calls.findIndex((l) => re.test(l));
  const history = at(/dist\/seed-history\.js --tenant forgeco/);
  assert.ok(history > at(/dist\/seed-demo\.js/), `the past was written before the massive catalogue (box-up: 9 then 10):\n  ${calls.join('\n  ')}`);
  assert.ok(at(/notifications\?limit=1&status=pending/) > history, 'the window was not preceded by the queue drain (10b)');
  assert.ok(at(/^node bin\/seed\.mjs .*--phase window/) > at(/notifications\?limit=1&status=pending/), 'the window re-armed the mail before the queue was drained');
});

test('★ PROMOTED to an IP, the hook claims the https door and hands Node the certificates the kit proved it with', () => {
  // Measured 2026-10-10 (IB-3) without a CA: every door «fetch failed», «NOT ONE door of forgeco was opened».
  const { rc, out, nodes } = up({ FORGE_BENCH_ADDRESS: '192.0.2.20' });
  assert.equal(rc, 0, `bench/up.sh promoted to 192.0.2.20 did not finish:\n${out.slice(-2500)}`);
  assert.equal(nodes.length, 7, `the hook ran ${nodes.length} script(s):\n  ${nodes.join('\n  ')}`);
  const claim = nodes.find((l) => l.startsWith('node bin/store-host.mjs'));
  assert.match(claim, /--origin https:\/\/192\.0\.2\.20:7143 /, `store-host did not claim the promoted https door: ${claim}`);
  for (const l of nodes) {
    assert.match(l, /--api http:\/\/localhost:7100( |$)/, `promoted, the scripts still talk through the loopback door: ${l}`);
    // FORGE_BENCH_CA_FILE: the file the kit's own step 6 trusted (trust.pem), not a guess at ca.crt.
    assert.match(l, / ca=\S+\/\.forge-bench\/trust\.pem$/, `Node was not handed the certificates the kit proved the doors with: ${l}`);
  }
  // ★ IB-7 (kit of IB-6): the totem's door is declared `:https`, so a promoted bench serves the counter on
  // <block>63 and the kit's own step 6 proves it there. Without the 4th field (the kit of IB-4/IB-5) the totem
  // stayed on 127.0.0.1:<block>03 — a tablet on the LAN had no counter (README §2 listed it as not covered).
  assert.match(out, /✅ the declared door FORGE_TOTEM_HTTPS_PORT is published — https:\/\/192\.0\.2\.20:7163\/ answers 200/,
    'promoted, the kit never proved the totem by https on the promoted address (bench/bench.env FORGE_BENCH_DOORS lost `:https`?)');
  assert.match(out, /FORGE_TOTEM_HTTPS_PORT {2}https:\/\/192\.0\.2\.20:7163\//, 'the promoted summary does not hand out the totem\'s https door');
  assert.doesNotMatch(out, /LOOPBACK ONLY/, 'promoted, the kit says a declared door of the demo stays on this machine');
});

test('★ on localhost the totem keeps its loopback door and no https one (the 4th field only acts when promoted)', () => {
  const { rc, out } = up();
  assert.equal(rc, 0, `bench/up.sh on localhost did not finish:\n${out.slice(-2500)}`);
  assert.match(out, /✅ the declared door FORGE_TOTEM_HTTP_PORT is published — http:\/\/localhost:7103\/ answers 200/);
  assert.doesNotMatch(out, /FORGE_TOTEM_HTTPS_PORT|:7163/, 'a localhost bench handed out an https door for the totem');
});

// ── ★★ SH-2 · STEP 10, THE PAST, ON THE KIT BENCH ───────────────────────────────────────────────────────────────
//
// Measured 2026-10-11: a kit bench was born with no past — step 10 lived only in bin/box-up.sh — so the admin
// home's dashboard (30 days by default) was all but empty on a dev bench from day one. The hook now runs box-up's
// step 10: the kernel's `dist/seed-history.js`, through the KIT's compose, for every tenant, after the curated
// seed (8) and before the doors (14-bis), inside the mail silence, through ONE delivery method re-armed after.
const historyRuns = (calls) => calls.filter((l) => / node dist\/seed-history\.js /.test(l));

test('★★ SH-2 · the past is written on every bench: seed-history per tenant, through the kit, inside the silence, one delivery method', () => {
  const { rc, out, calls } = up();
  assert.equal(rc, 0, `bench/up.sh did not finish:\n${out.slice(-2500)}`);
  const runs = historyRuns(calls);
  assert.deepEqual(runs.map((l) => / --tenant (\S+)/.exec(l)[1]), TENANTS, `seed-history did not run once per tenant, in order:\n  ${runs.join('\n  ')}`);
  for (const l of runs) {
    assert.match(l, /-f \S+\/bench\/compose\.bench\.yml/, `the past did not go through the kit's compose: ${l}`);
    assert.match(l, / run --rm .*kernel node dist\/seed-history\.js /, `the past did not run inside the kernel: ${l}`);
  }
  const at = (re) => calls.findIndex((l) => re.test(l));
  const lastCurated = calls.map((l) => /^node bin\/seed\.mjs /.test(l)).lastIndexOf(true);
  assert.ok(calls.indexOf(runs[0]) > lastCurated, 'the past ran before the curated seed — outside the mail silence step 8 opens');
  assert.ok(calls.indexOf(runs[1]) < at(/^node bin\/prove-doors\.mjs/), 'the past ran after the doors were proved');
  // The mailbox guard asked, per store, with `store=` (box-up: the kernel ignores `store_id` silently).
  assert.ok(at(/notification_types\?store=/) >= 0 && at(/notification_types\?store=/) < calls.indexOf(runs[0]), 'no past may be written before the buyer mail is proved silent');
  // One delivery method while the past is written, the other re-armed after — per tenant.
  for (const run of runs) {
    const i = calls.indexOf(run);
    const before = calls.slice(0, i).filter((l) => /shipping\.method\.update/.test(l)).pop();
    const after = calls.slice(i).find((l) => /shipping\.method\.update/.test(l));
    assert.match(before ?? '', /"method_id":"shm_EXPRESSA","active":false/, `the extra delivery method was not silenced before: ${run}`);
    assert.match(after ?? '', /"method_id":"shm_EXPRESSA","active":true/, `the extra delivery method was not re-armed after: ${run}`);
  }
  assert.ok(!calls.some((l) => /shm_PADRAO|shm_BALCAO/.test(l) && /shipping\.method\.update/.test(l)), 'the kept method (or a pickup) was touched');
  assert.match(out, /10 · forgeco · the past written in \d+ s/);
  assert.doesNotMatch(out, /the seed hook reports:[\s\S]*10 (skipped|· already)/, 'the kit was told the past was skipped on a run that wrote it');
});

// ★ ONE PLAIN RUN PER TENANT, ALWAYS — no flag, no probe of the image before it (SH-1 has no flag: the script
// decides by state). An earlier version read the image for `--top-up` and would have passed it to the new script,
// whose text DOES contain "top-up" (a value of `mode`), as a flag it does not read.
const plainRuns = (calls) =>
  historyRuns(calls).every((l) => / node dist\/seed-history\.js --tenant \S+$/.test(l)) &&
  !calls.some((l) => /--entrypoint cat/.test(l));

test('★ SH-2 · a second `up` on the PINNED image (v0.3.2, the past is there) does not break: «already has a past», said, NOT completed', () => {
  const { rc, out, calls } = up({ IB5_HISTORY_PAST: 'has' });
  assert.equal(rc, 0, `a bench that already has a past went red on its next up:\n${out.slice(-2500)}`);
  assert.match(out, /10 · forgeco ALREADY HAS A PAST — kept, NOT completed to today: this image's seed-history is reset\+seed/);
  assert.match(out, /the seed hook reports:[\s\S]*10 · already had a past: forgeco forgecafe — kept, NOT completed to today/);
  assert.ok(plainRuns(calls), `not one plain run per tenant:\n  ${historyRuns(calls).join('\n  ')}`);
  // Even skipped, the delivery method comes back.
  assert.equal(calls.filter((l) => /"method_id":"shm_EXPRESSA","active":true/.test(l)).length, 2, 'a delivery method was left silenced');
});

test('★ SH-2 · on an image with SH-1 (state decides, no flag) the same plain run COMPLETES the past to today, and says so', () => {
  const { rc, out, calls } = up({ IB5_HISTORY_PAST: 'has', IB5_HISTORY_IMAGE: 'sh1' });
  assert.equal(rc, 0, `bench/up.sh did not finish:\n${out.slice(-2500)}`);
  assert.equal(historyRuns(calls).length, 2, `not ONE run per tenant:\n  ${historyRuns(calls).join('\n  ')}`);
  assert.ok(plainRuns(calls), `a flag or a probe reached the image:\n  ${calls.filter((l) => /seed-history/.test(l)).join('\n  ')}`);
  assert.match(out, /10 · forgeco · its past COMPLETED TO TODAY in \d+ s \(51 orders added\)/);
  assert.match(out, /the seed hook reports:[\s\S]*10 · past completed to today: forgeco forgecafe/);
  assert.doesNotMatch(out, /NOT completed/);
});

test('★ SH-2 · SH-1 image: up to date adds nothing and says it; refused keeps the past and names it — neither is a red `up`', () => {
  const today = up({ IB5_HISTORY_PAST: 'today', IB5_HISTORY_IMAGE: 'sh1' });
  assert.equal(today.rc, 0, today.out.slice(-2500));
  assert.match(today.out, /10 · forgeco · its past is already up to date — nothing added/);
  assert.doesNotMatch(today.out, /NOT completed|COMPLETED TO TODAY|ALREADY HAS A PAST/);
  const foreign = up({ IB5_HISTORY_PAST: 'foreign', IB5_HISTORY_IMAGE: 'sh1' });
  assert.equal(foreign.rc, 0, foreign.out.slice(-2500));
  assert.match(foreign.out, /10 · forgeco · seed-history REFUSED to touch this past/);
  assert.match(foreign.out, /the seed hook reports:[\s\S]*10 · seed-history refused the past of: forgeco forgecafe/);
});

test('⛔ SH-2 · buyer mail ARMED: no past is written, and the `up` says why', () => {
  const { rc, out, calls } = up({ IB5_MAIL_ARMED: '1' });
  assert.notEqual(rc, 0, 'a past was let through with the buyer mail armed');
  assert.match(out, /REFUSING to seed the past for forgeco: buyer order mail is ARMED/);
  assert.equal(historyRuns(calls).length, 0, 'seed-history ran with the mail armed');
});

test('★ SH-2 · FORGE_DEMO_BENCH_HISTORY=0 skips the past by name, and the kit\'s report says so', () => {
  const { rc, out, calls } = up({ FORGE_DEMO_BENCH_HISTORY: '0' });
  assert.equal(rc, 0, `bench/up.sh did not finish:\n${out.slice(-2500)}`);
  assert.equal(historyRuns(calls).length, 0, 'the past ran although it was declined');
  assert.match(out, /the seed hook reports:[\s\S]*10 skipped — asked with FORGE_DEMO_BENCH_HISTORY=0/);
});

test('★ SH-2 · a tenant with NO delivery method (forgeco without the massive, measured) is named and skipped — never a red `up`', () => {
  const { rc, out, calls } = up({ IB5_NO_METHODS: '1' });
  assert.equal(rc, 0, `a bench whose tenant has no logistics went red:\n${out.slice(-2500)}`);
  assert.match(out, /10 · forgeco has no delivery method — its logistics come with the massive catalogue/);
  assert.match(out, /the seed hook reports:[\s\S]*10 · no past for: forgeco forgecafe — no delivery method/);
  assert.equal(historyRuns(calls).length, 0, 'a past was asked of a tenant with nothing to sell it through');
});

// ── ★★ IB-9 · THE KIT OF IB-8: THE MAILBOX STAYS THE DEFAULT, AND A DEVELOPER MAY SEND FOR REAL BY DECLARING IT ──
//
// Until IB-9 the kit pinned the kernel's FORGE_SMTP_* to its own mailbox as literals: no value of bench.env or of
// the shell could reach a real SMTP, so a developer of this demo testing transactional mail had to edit the kit.
// The kit of IB-8 (Forge 3acffcd0f) declares the mailbox away with FORGE_BENCH_MAILBOX=none: a generated overlay
// (.forge-bench/mail.compose.yml, merged last) removes `mailpit` and hands the kernel the five FORGE_SMTP_* by
// reference. With `none` the kit keeps the five FORGE_SMTP_* of the shell (bench_load_declarations), so the demo
// declares nothing for them: bench/bench.env only DOCUMENTS the switch, commented out. Proved live with an SMTP of
// the developer's own outside the bench — RESULTADOS-ib-9 / README §2 "Sending mail for real".
const MAIL_OVERLAY = /-f \S+\/\.forge-bench\/mail\.compose\.yml/;
const composeOps = (calls) => calls.filter((l) => /^docker compose .* (up|run) /.test(l));
// Not a secret: an invented value, so a leak of it is found by searching for it.
const PROD_PASS = 'ib9-production-key-never-a-real-one';

test('★★ IB-9 · the demo as committed keeps the bench\'s mailbox — production\'s SMTP in the shell is dropped, never merged', () => {
  const { rc, out, calls } = up({ FORGE_SMTP_HOST: 'smtp.resend.com', FORGE_SMTP_USER: 'resend', FORGE_SMTP_FROM: 'hi@forgecommerce.pro', FORGE_SMTP_PASS: PROD_PASS });
  assert.equal(rc, 0, `bench/up.sh did not finish:\n${out.slice(-2500)}`);
  assert.match(out, /ignored \d+ variable\(s\) of this shell .*FORGE_SMTP_HOST.*FORGE_SMTP_PASS/, 'production\'s FORGE_SMTP_* in the shell were not dropped by name');
  assert.ok(composeOps(calls).length > 0, 'no compose up/run was recorded — this test would pass on nothing');
  assert.deepEqual(composeOps(calls).filter((l) => MAIL_OVERLAY.test(l)), [], 'the demo, as committed, merged the send-for-real overlay');
  assert.ok(calls.some((l) => / up -d .*postgres redis mailpit/.test(l)), `the mailbox was not started with the database:\n  ${calls.join('\n  ')}`);
  assert.match(out, /the code is in the mailbox/, 'the summary no longer sends the operator to the mailbox');
  assert.ok(!out.includes(PROD_PASS), 'the production SMTP password reached the output');
});

test('★★ IB-9 · FORGE_BENCH_MAILBOX=none from the shell: no mailbox, the overlay on every compose call, the hook whole, both tenants invite the declared operator', () => {
  const operator = 'operator@ib9-guard.internal';
  const { rc, out, calls, nodes } = up({
    FORGE_BENCH_MAILBOX: 'none', FORGE_SMTP_HOST: 'smtp.ib9-guard.internal', FORGE_SMTP_PORT: '2525', FORGE_SMTP_USER: 'bench-user',
    FORGE_SMTP_FROM: 'bench@mail.example.test', FORGE_SMTP_PASS: PROD_PASS, FORGE_ADMIN_SEED_EMAIL: operator,
  });
  assert.equal(rc, 0, `bench/up.sh with FORGE_BENCH_MAILBOX=none did not finish:\n${out.slice(-2500)}`);
  const ops = composeOps(calls);
  assert.ok(ops.length > 3, `too few compose calls to judge:\n  ${calls.join('\n  ')}`);
  assert.deepEqual(ops.filter((l) => !MAIL_OVERLAY.test(l)), [], 'a compose call of a bench that sends for real did not merge the mail overlay');
  assert.ok(!calls.some((l) => /\bmailpit\b/.test(l)), `the mailbox was started on a bench declared without one:\n  ${calls.filter((l) => /mailpit/.test(l)).join('\n  ')}`);
  assert.ok(!calls.some((l) => / openssl /.test(l)), 'the mailbox certificate was minted on a bench without a mailbox');
  // The demo's hook ran whole, for both tenants, as on the default bench.
  assert.deepEqual(steps(nodes), ['bin/seed-box.mjs forgeco', 'bin/seed-box.mjs forgecafe', 'bin/store-host.mjs forgeco', 'bin/seed.mjs forgeco',
    'bin/seed.mjs forgecafe', 'bin/prove-doors.mjs forgeco', 'bin/prove-doors.mjs forgecafe'], `the hook did not run whole:\n  ${nodes.join('\n  ')}`);
  for (const t of TENANTS) {
    assert.match(out, new RegExp(`4/8 provision — tenant '${t}' .*operator ${operator}`), `${t} was not provisioned with the declared operator`);
  }
  assert.match(out, new RegExp(`the code is MAILED to ${operator}`), 'the summary does not say the code is mailed');
  assert.ok(!out.includes(PROD_PASS), 'the SMTP password reached the output');
});

test('⛔ IB-9 · the switch is off in git: bench/bench.env declares no FORGE_BENCH_MAILBOX nor FORGE_SMTP_*, and .gitignore keeps bench/smtp.pass out', () => {
  const code = (text) => text.split('\n').filter((l) => !/^\s*#/.test(l));
  const declared = code(readFileSync(join(ROOT, 'bench', 'bench.env'), 'utf8')).filter((l) => /^(FORGE_BENCH_MAILBOX|FORGE_SMTP_[A-Z]+|FORGE_BENCH_SMTP_CA_FILE)=/.test(l));
  assert.deepEqual(declared, [], 'bench/bench.env switches the mail on for every developer of this repository — it is a line for YOUR copy or your shell');
  // The section that tells a developer how is there (its names commented out), or the switch is undiscoverable.
  assert.match(readFileSync(join(ROOT, 'bench', 'bench.env'), 'utf8'), /^# FORGE_BENCH_MAILBOX=none$/m, 'bench/bench.env no longer documents FORGE_BENCH_MAILBOX=none');
  assert.ok(code(readFileSync(join(ROOT, '.gitignore'), 'utf8')).includes('bench/smtp.pass'), '.gitignore does not ignore bench/smtp.pass — the SMTP password of a developer would be one `git add .` from the repository');
  // And the committed operator is fictitious: switched on as committed, the kit refuses it before anything starts.
  const { rc, out, calls } = up({ FORGE_BENCH_MAILBOX: 'none', FORGE_SMTP_HOST: 'smtp.ib9-guard.internal', FORGE_SMTP_USER: 'u', FORGE_SMTP_FROM: 'bench@mail.example.test', FORGE_SMTP_PASS: PROD_PASS });
  assert.equal(rc, 1, `the committed operator was accepted on a bench that sends:\n${out.slice(-1500)}`);
  assert.match(out, /FORGE_ADMIN_SEED_EMAIL=operator@bench\.example\.test is at a reserved test domain/);
  assert.deepEqual(composeOps(calls), [], 'something was started before the refusal');
});
