// ★★ IB-3 — THE LOCAL BENCH IS THE FORGE KIT, UNCHANGED, AND THIS BOX ENTERS IT ONLY THROUGH ITS SEAMS.
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
//      `curl` and `node` replaced by recorders (nothing starts): the hook bench/bench.env declares is called,
//      and it calls this box's own seed (seed-box, store-host, seed, prove-doors) with the kit's credential,
//      which never reaches the output. With FORGE_DEMO_BENCH_DATASET=1 it also runs the massive one-shot
//      THROUGH THE KIT (bench/compose.sh), then the window and the data verdict — and without it, none of them.
//      Promoted to an IP, it claims the https door and hands Node the CA the kit exported (without it, the first
//      live promotion went red: every door «fetch failed»).
//
// The real run (a clean clone, block 66, promoted to a LAN IP and back) is in RESULTADOS-ib-3.
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

const FAKE_OPERATOR = 'fake-operator-credential-ib3-9f1c';
const FAKE_DRIVER = 'fake-driver-credential-ib3-77a0';
const FAKE_STORE = 'sto_01FAKEIB3STORE0000000000';

const FAKE_DOCKER = String.raw`#!/usr/bin/env bash
echo "docker $*" >> "$IB3_LOG"
if [ "$1" = run ]; then
  # the mailbox certificate: docker run … -v <dir>:/out postgres:18 openssl …
  while [ $# -gt 0 ]; do case "$1" in -v) out="$(printf %s "$2" | sed 's#:/out$##')"; shift 2 ;; *) shift ;; esac; done
  touch "$out/bench-mail.key" "$out/bench-mail.crt"; exit 0
fi
[ "$1" = ps ] && exit 0
case "$*" in
  *dist/provision-ref.js*)
    printf '  operator token\n  %s\n  login-driver token\n  %s\n' "$IB3_OP" "$IB3_DRV" >&2
    echo "$IB3_STORE" ;;
  *dist/seed-demo.js*) echo '[seed-demo] done (fake)' ;;
  # a promoted bench exports the edge's local CA: … cp edge-tls:/data/caddy/pki/authorities/local/root.crt <dest>
  *' cp edge-tls:'*) for last in "$@"; do :; done; echo 'FAKE CA' > "$last" ;;
esac
exit 0
`;
const FAKE_CURL = `#!/usr/bin/env bash\nprintf 200\n`;
// node: the version require-node.sh asks, then every script the hook runs, with whether it carried the KIT's
// credential (compared here, never written down).
const FAKE_NODE = String.raw`#!/usr/bin/env bash
case "$1" in -v|--version) echo v24.18.0; exit 0 ;; esac
tok=absent; [ "$FORGE_OPERATOR_TOKEN" = "$IB3_OP" ] && tok=kit; [ -n "$FORGE_OPERATOR_TOKEN" ] && [ "$tok" = absent ] && tok=OTHER
ca="$NODE_EXTRA_CA_CERTS"; [ -n "$ca" ] || ca=none
echo "node $* token=$tok ca=$ca" >> "$IB3_LOG"
exit 0
`;

/** A copy of what `bench/up.sh` and the hook read, outside this repository, with the three recorders first on PATH. */
function benchCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'ib3-kit-'));
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

function up(extraEnv = {}) {
  const c = benchCopy();
  const env = {
    PATH: `${c.fake}:/usr/bin:/bin`,
    HOME: c.dir,
    COMPOSE_PROJECT_NAME: 'ib3-guard',
    FORGE_BENCH_PORT_BLOCK: '71',
    IB3_LOG: c.log,
    IB3_OP: FAKE_OPERATOR,
    IB3_DRV: FAKE_DRIVER,
    IB3_STORE: FAKE_STORE,
    ...extraEnv,
  };
  const r = spawnSync('bash', [join(c.shop, 'bench', 'up.sh')], { cwd: c.shop, env, encoding: 'utf8' });
  const calls = existsSync(c.log) ? readFileSync(c.log, 'utf8').split('\n').filter(Boolean) : [];
  rmSync(c.dir, { recursive: true, force: true });
  return { rc: r.status, out: `${r.stdout}${r.stderr}`, calls, nodes: calls.filter((l) => l.startsWith('node ')) };
}

test('★★ bench/up.sh runs the hook bench/bench.env declares, and it seeds THIS box with the kit\'s credential', () => {
  const { rc, out, nodes, calls } = up();
  assert.equal(rc, 0, `bench/up.sh (the kit's) did not finish on the copy:\n${out.slice(-2500)}`);
  assert.match(out, /7\/7 the seed hook: bash bench-demo\/seed-hook\.sh/, 'the kit did not announce the demo\'s hook');
  const scripts = nodes.map((l) => l.split(' ')[1]);
  assert.deepEqual(
    scripts,
    ['bin/seed-box.mjs', 'bin/store-host.mjs', 'bin/seed.mjs', 'bin/prove-doors.mjs'],
    `the hook did not run the box's seed in box-up's order (6, 6b, 8, 14-bis):\n  ${nodes.join('\n  ')}`,
  );
  for (const l of nodes) {
    assert.match(l, /--tenant forgeco /, `not the kit's tenant: ${l}`);
    assert.match(l, /--api http:\/\/localhost:7100( |$)/, `not the shop's loopback door of block 71: ${l}`);
    assert.match(l, / token=kit /, `not the credential the kit minted and filed: ${l}`);
    // On localhost there is no CA to hand over, and none is invented.
    assert.match(l, / ca=none$/, `a CA was handed to Node on a localhost bench: ${l}`);
  }
  assert.match(nodes[1], new RegExp(`--origin http://localhost:7100 --store ${FAKE_STORE} `), 'store-host did not claim the kit\'s origin for the kit\'s store');
  assert.ok(!out.includes(FAKE_OPERATOR) && !out.includes(FAKE_DRIVER), 'a credential the kit minted reached the output');
  // Without the ask, the massive one-shot never runs, and neither do the steps that need it.
  assert.ok(!calls.some((l) => l.includes('seed-demo')), 'seed-demo ran on a bench that did not ask for the dataset');
  assert.ok(!scripts.includes('bin/verify-seed.mjs'), 'verify-seed ran with no massive catalogue: it is red by construction there');
  assert.match(out, /9-12 · skipped — the massive catalogue is asked with FORGE_DEMO_BENCH_DATASET=1/);
});

test('★ FORGE_DEMO_BENCH_DATASET=1: the massive one-shot runs THROUGH THE KIT, speaking, then the window and the verdict', () => {
  const { rc, out, nodes, calls } = up({ FORGE_DEMO_BENCH_DATASET: '1' });
  assert.equal(rc, 0, `bench/up.sh with the dataset asked did not finish:\n${out.slice(-2500)}`);
  const seedDemo = calls.filter((l) => l.includes('dist/seed-demo.js'));
  assert.equal(seedDemo.length, 1, `seed-demo should run once:\n  ${calls.join('\n  ')}`);
  // Through bench/compose.sh: the kit's file list (its overlay), never a bare `docker compose`.
  assert.match(seedDemo[0], /-f \S+\/bench\/compose\.bench\.yml/, `seed-demo did not go through the kit's compose: ${seedDemo[0]}`);
  assert.match(seedDemo[0], /-e FORGE_REF_TENANT=forgeco -e FORGE_REF_STORE_HANDLE=forge -e FORGE_SEED_DEMO=1 /);
  assert.match(out, /seed-demo for "forgeco" ended after 0 min \(rc=0\)/, 'box-up\'s speaking block did not run');
  assert.deepEqual(
    nodes.map((l) => l.split(' ').slice(1, 2).concat(l.includes('--phase window') ? ['window'] : []).join(' ')),
    ['bin/seed-box.mjs', 'bin/store-host.mjs', 'bin/seed.mjs', 'bin/seed.mjs window', 'bin/verify-seed.mjs', 'bin/verify-content.mjs', 'bin/prove-doors.mjs'],
  );
});

test('★ PROMOTED to an IP, the hook claims the https door and hands Node the CA the kit exported (14-bis opens it there)', () => {
  // Measured 2026-10-10 without this: every door «fetch failed», «NOT ONE door of forgeco was opened», the `up` red.
  const { rc, out, nodes } = up({ FORGE_BENCH_ADDRESS: '192.0.2.20' });
  assert.equal(rc, 0, `bench/up.sh promoted to 192.0.2.20 did not finish:\n${out.slice(-2500)}`);
  assert.equal(nodes.length, 4, `the hook ran ${nodes.length} script(s):\n  ${nodes.join('\n  ')}`);
  assert.match(nodes[1], /--origin https:\/\/192\.0\.2\.20:7143 /, `store-host did not claim the promoted https door: ${nodes[1]}`);
  for (const l of nodes) {
    assert.match(l, /--api http:\/\/localhost:7100( |$)/, `promoted, the scripts still talk through the loopback door: ${l}`);
    assert.match(l, / ca=\S+\/\.forge-bench\/ca\.crt$/, `Node was not handed the kit's local CA: ${l}`);
  }
});
