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
  *'config --services'*) printf '%s\n' postgres redis mailpit kernel storefront checkout admin caddy storefront-coffee totem ;;
  *dist/provision-ref.js*)
    t="$(printf '%s\n' "$@" | sed -n 's/^FORGE_REF_TENANT=//p')"; [ -n "$t" ] || t=forgeco
    printf '  operator token\n  fake-operator-%s-ib5-9f1c\n  login-driver token\n  fake-driver-%s-ib5-77a0\n' "$t" "$t" >&2
    echo "sto_FAKE$(printf %s "$t" | tr '[:lower:]' '[:upper:]')" ;;
  *dist/admin-platform-token.js*) echo "$IB5_PLATFORM" ;;
  *dist/seed-demo.js*) echo '[seed-demo] done (fake)' ;;
  # a promoted bench exports the edge's local CA: … cp edge-tls:/data/caddy/pki/authorities/local/root.crt <dest>
  *' cp edge-tls:'*) for last in "$@"; do :; done; echo 'FAKE CA' > "$last" ;;
esac
exit 0
`;
// curl: the kit's door probes get 200; the hook's one read (the café's stores, to learn the counter) gets them.
const FAKE_CURL = String.raw`#!/usr/bin/env bash
case "$*" in
  */v1/read/internal/stores*) printf '[{"id":"%s","handle":"cafe"},{"id":"%s","handle":"balcao"}]' "$IB5_CAFE_STORE" "$IB5_COUNTER" ;;
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
  for (const p of ['bench', 'bench-demo', 'bin/images-from-lock.sh', 'bin/require-node.sh', 'bin/box-up.sh', 'forge.lock',
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
  assert.match(out, /the seed hook reports:\n.*· 9-12 skipped — the massive catalogue is asked with FORGE_DEMO_BENCH_DATASET=1/);
});

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
  assert.ok(!/· 9-12 skipped/.test(out), 'the kit was told 9-12 were skipped on a run that ran them');
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
