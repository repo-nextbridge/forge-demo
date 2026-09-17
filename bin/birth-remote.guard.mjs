// ★★★ A DEPLOY IS NOT A BIRTH — and a step that fails INTERRUPTS the birth rather than warning about it.
//
// ── WHAT IS BEING GRADED, AND WHY EACH HALF NEEDS THE OTHER ────────────────────────────────────────────────
//
// `bin/deploy.sh` runs on every adoption of a pin. Seeding is reset+seed by nature — `bin/seed.mjs` rewrites
// the settings every screen inherits, `dist/seed-history.js` either rebuilds a past or refuses one, and
// `seed-box.mjs` re-applies what `seed/box.json` declares over whatever the live box has since become. ⇒ A
// DEPLOY THAT SEEDED WOULD OVERWRITE THE SHOP ON EVERY VERSION BUMP. So:
//
//   ⟂ §1  a deploy WITHOUT `--birth`, against a box that HOLDS DATA, reaches no seeding gesture and leaves
//         that box's data byte-identical. This is the control the slice is named after.
//   ⟂ §2  and the control that keeps §1 from being vacuous: WITH `--birth` it does hand over. A deploy that
//         simply did nothing would pass §1 perfectly and be worth nothing.
//   ⟂ §3  a step of the birth that fails STOPS it — no step after the failure runs. «A gesture that refuses
//         and does not interrupt what comes after is not a refusal, it is a warning», and a box handed over
//         half seeded is the failure the whole file exists to make impossible.
//   ⟂ §4  the birth's step list accounts for every step the BENCH birth has. A step added to `bin/box-up.sh`
//         and not here is a step a deployed box silently never gets.
//   ⟂ §5  the address plan refuses a face this environment has no address for — and PASSES a complete one.
//
// ── HOW THE BOX IS FAKED, AND WHY THAT IS LEGITIMATE HERE ─────────────────────────────────────────────────
//
// Every gesture either script makes towards a host goes through `ssh` — the vehicle in `bin/remote-box.sh`
// has no other verb. So a stub `ssh` earlier on `PATH` IS the far side: it records every command it is asked
// to run, answers the handful of questions the scripts really ask, and can be told to fail at a named one.
// ⚠️ THAT MAKES THE ASSERTIONS ABOUT WHAT DID **NOT** HAPPEN, which is the only shape that can prove §1 and
// §3: «the log of everything this run asked of the host contains no seeding entrypoint» is a complete
// statement, where «I looked at the box afterwards and it seemed fine» is not.
//
// ⛔ AND THE TREE IS FABRICATED, NEVER THIS REPOSITORY'S. A guard that ran against the real `deploy/stag.env`
// would grade a bench — and would ssh to a real VM.

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The fence lives in the product and `bin/deploy.sh` refuses without it — the same resolution order that
 *  script declares, asked the same way. A machine with none cannot grade §1/§2, and says so. */
function fenceOnThisMachine() {
  for (const p of [
    process.env.FORGE_PROVENANCE_BIN,
    join(ROOT, 'storefront-coffee/node_modules/.bin/forge-lock-provenance'),
    join(ROOT, 'totem/node_modules/.bin/forge-lock-provenance'),
    join(ROOT, 'node_modules/.bin/forge-lock-provenance'),
  ]) {
    if (!p) continue;
    try {
      execFileSync('test', ['-e', p]);
      return p;
    } catch {
      /* next */
    }
  }
  return null;
}
const FENCE = fenceOnThisMachine();

// ── THE STUB HOST ───────────────────────────────────────────────────────────────────────────────────────────
//
// It answers the five questions the two scripts ask of a host and records everything. `PROBE_FAIL_AT` is a
// substring: the first command containing it exits 1, which is how §3 places a failure at a chosen step.
const STUB_SSH = `#!/usr/bin/env bash
# The far side, for a test. Everything after the ssh options is the command; record it, then answer.
cmd="\${@: -1}"
printf '%s\\n' "$cmd" >> "$PROBE_LOG"
if [ -n "\${PROBE_FAIL_AT:-}" ] && [[ "$cmd" == *"$PROBE_FAIL_AT"* ]]; then
  printf 'stub: refusing %s\\n' "$PROBE_FAIL_AT" >&2
  exit 1
fi
case "$cmd" in
  true) exit 0 ;;
  *'uname -n'*)
    printf 'probe-host\\n25.0.0\\n40000000\\n'; exit 0 ;;
  *'.secrets'*grep*|*grep*'.secrets'*)
    # "has this box been born?" and "does it carry the two minted secrets?" — one answer, PROBE_BORN.
    [ "\${PROBE_BORN:-no}" = yes ] && exit 0 || { printf '' ; exit 1; } ;;
  # ⚠️ THE WRITE COMES BEFORE THE READ, and the order is the whole of it: \`cat > '/opt/probe/.env'\` matches
  # the READ pattern too, so with the read first the far side answered a write by printing the old file and
  # never touching stdin — and the assertion below read an empty string and blamed the deploy.
  *'cat >'*'/.env'*) cat > "\${PROBE_ENV_WRITTEN:-/dev/null}"; exit 0 ;;
  *'cat >'*) cat > /dev/null; exit 0 ;;
  *'cat '*'/.env'*)
    cat "$PROBE_BOX_ENV" 2>/dev/null; exit 0 ;;
  *'docker image inspect'*) exit 0 ;;
  *'install -d'*) exit 0 ;;
  *'tar -C'*) cat > /dev/null; exit 0 ;;
  *python3*) cat > /dev/null; exit 0 ;;
  *'command -v node'*) exit 1 ;;
  *'provision-ref.js'*)
    printf 'sto_01PROBE\\n'
    printf 'operator token\\n  fopa_probe_operator\\nlogin-driver token\\n  fodr_probe_driver\\n' >&2
    exit 0 ;;
  *'migrate.js'*) printf '[migrate] tenants: none registered yet\\n'; exit 0 ;;
  *) exit 0 ;;
esac
`;

/** A dataset whose stamp describes it exactly — `bin/dataset-provenance.mjs` compares the listed files and
 *  the byte total, and calls a stamp that no longer describes its directory `stale`. */
function fabricateDataset(dir) {
  mkdirSync(dir, { recursive: true });
  const catalog = '{"products":[]}';
  const custom = '{}';
  writeFileSync(join(dir, 'catalog.json'), catalog);
  writeFileSync(join(dir, 'custom-fields.json'), custom);
  const totalBytes = Buffer.byteLength(catalog) + Buffer.byteLength(custom);
  writeFileSync(
    join(dir, 'forge-seed-dataset.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        id: 'probe',
        name: 'probe dataset',
        catalog: { version: 'probe-cat-v1', count: 2, totalBytes, files: ['catalog.json', 'custom-fields.json'] },
        photos: { version: 'probe-pho-v1', count: 0, totalBytes: 0 },
        generatedAt: '2026-09-16T00:00:00.000Z',
      },
      null,
      2,
    ),
  );
  return { totalBytes };
}

const PROBE_BOX = {
  tenants: [
    {
      id: 'probeco',
      admin_host: 'localhost:8201',
      admin_domain: { host: 'admin.probe.example', env: 'FORGE_ADMIN_DOMAIN' },
      dataset: true,
      settings: { tenant_name: 'Probe Co' },
      stores: [
        { handle: 'probe', name: 'Probe', bootstrap: true, domain: { host: 'probe.example', env: 'FORGE_DOMAIN' } },
      ],
    },
    {
      id: 'probecafe',
      admin_host: 'localhost:8202',
      admin_domain: { host: 'admin.cafe.probe.example', env: 'FORGE_CAFE_ADMIN_DOMAIN' },
      settings: { tenant_name: 'Probe Café' },
      stores: [
        {
          handle: 'cafe',
          name: 'Probe Café',
          bootstrap: true,
          domain: { host: 'cafe.probe.example', env: 'FORGE_CAFE_DOMAIN' },
        },
      ],
    },
  ],
  facilities: [],
};

/**
 * A whole scratch instance plus a stub host. `what` selects which scripts the tree carries: the deploy needs
 * its own dependencies, the birth needs its own, and giving each only what it uses keeps a missing file from
 * looking like a refusal.
 */
function scratch({ born = false, failAt = '', bench = false, missingFace = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'forge-birth-guard-'));
  mkdirSync(join(dir, 'bin'), { recursive: true });
  mkdirSync(join(dir, 'deploy'), { recursive: true });
  mkdirSync(join(dir, 'seed'), { recursive: true });
  mkdirSync(join(dir, 'stub'), { recursive: true });
  mkdirSync(join(dir, 'apps/probe'), { recursive: true });
  mkdirSync(join(dir, 'caddy'), { recursive: true });

  for (const f of [
    'birth-remote.sh',
    'deploy.sh',
    'remote-box.sh',
    'require-node.sh',
    'images-from-lock.sh',
    'deployed-faces.mjs',
    'box-domains.mjs',
    'roteiro.mjs',
    'dataset-provenance.mjs',
  ]) {
    cpSync(join(ROOT, 'bin', f), join(dir, 'bin', f));
  }

  const { totalBytes } = fabricateDataset(join(dir, 'dataset'));

  writeFileSync(join(dir, 'seed/box.json'), JSON.stringify(PROBE_BOX, null, 2));
  writeFileSync(
    join(dir, 'forge.lock'),
    JSON.stringify(
      {
        forgeVersion: 'v0.0.0-probe',
        node: { minMajor: 24, engines: '>=24' },
        // ⚠️ THE LIST MUST BE NON-EMPTY: `bin/images-from-lock.sh:105` refuses a lock that pins images and
        // names no composition, and an empty `apps` array is exactly that refusal. Caught here — an empty one
        // made the deploy die at step 2 and the §1 assertion read «it never reached the host».
        composition: { id: 'probe', apps: ['probe'] },
        dataset: {
          source: 'probe',
          id: 'probe',
          catalog: { version: 'probe-cat-v1', totalBytes },
          photos: { version: 'probe-pho-v1', totalBytes: 0 },
        },
        images: {
          kernel: { ref: `probe-kernel@sha256:${'a'.repeat(64)}`, origin: 'own build' },
          storefront: { ref: `probe-storefront@sha256:${'b'.repeat(64)}`, origin: 'own build' },
          checkout: { ref: `probe-checkout@sha256:${'c'.repeat(64)}`, origin: 'own build' },
          admin: { ref: `probe-admin@sha256:${'d'.repeat(64)}`, origin: 'own build' },
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(dir, 'composition.json'),
    JSON.stringify({ version: 1, apps: [], instanceApps: [] }, null, 2),
  );
  writeFileSync(join(dir, '.env'), `FORGE_SEED_DATASET_HOST_DIR=${join(dir, 'dataset')}\n`);
  writeFileSync(join(dir, 'env-source.sh'), '#!/usr/bin/env bash\n');
  writeFileSync(join(dir, 'compose.yml'), '# probe\n');
  writeFileSync(join(dir, 'compose.override.yml'), '# probe\n');
  writeFileSync(join(dir, 'caddy/Caddyfile'), '# probe\n');
  mkdirSync(join(dir, 'caddy/certs'), { recursive: true });
  mkdirSync(join(dir, 'caddy/extra'), { recursive: true });
  mkdirSync(join(dir, 'extensions'), { recursive: true });
  mkdirSync(join(dir, 'i18n'), { recursive: true });
  mkdirSync(join(dir, 'themes'), { recursive: true });
  cpSync(join(ROOT, 'bin/verify-composition.sh'), join(dir, 'bin/verify-composition.sh'));

  // ⚠️ AND IT DECLARES THE SENTINEL, exactly as the real `deploy/box.env` does. Without that line §1 was
  // blind to the one key a deploy really could undo — see the test that follows it.
  writeFileSync(
    join(dir, 'deploy/box.env'),
    [
      'FORGE_ADMIN_TENANT=',
      'FORGE_SEED_DATASET_HOST_DIR=./seed/dataset',
      'FORGE_TOTEM_STORE_ID=sto_PENDING_SEED',
      'FORGE_COFFEE_STORE_ID=sto_PENDING_SEED',
      '',
    ].join('\n'),
  );
  const faces = [
    `FORGE_DOMAIN=${bench ? 'localhost' : 'probe.example'}`,
    missingFace ? '' : 'FORGE_CAFE_DOMAIN=cafe.probe.example',
    'FORGE_ADMIN_DOMAIN=admin.probe.example',
    'FORGE_CAFE_ADMIN_DOMAIN=admin.cafe.probe.example',
  ].filter(Boolean);
  writeFileSync(
    join(dir, 'deploy/probe.env'),
    [
      'FORGE_DEPLOY_HOST=probe.invalid',
      'FORGE_DEPLOY_USER=root',
      'FORGE_DEPLOY_DIR=/opt/probe',
      `FORGE_DEPLOY_KEY=${join(dir, 'fake-key')}`,
      ...faces,
      'FORGE_PUBLIC_ORIGIN=https://probe.example',
      '',
    ].join('\n'),
  );
  writeFileSync(join(dir, 'fake-key'), 'not a key\n');

  // ★ THE BOX'S OWN STATE, AND IT IS WHAT §1 MEASURES. A `.env` carrying keys only a birth can write is a box
  // that HOLDS DATA: those values exist because a seed minted them. §1 asserts they come back untouched.
  // ★ WHAT THE DEPLOY REALLY ASSEMBLED. The `.env` travels on the ssh session's STDIN, never in a command
  // line, so the recorded command log cannot answer «what did it write?». This file can.
  const envWritten = join(dir, 'env-written.txt');
  const boxEnv = join(dir, 'box-side.env');
  writeFileSync(
    boxEnv,
    [
      'FORGE_TOTEM_STORE_ID=sto_01LIVEDATA',
      'FORGE_COFFEE_STORE_ID=sto_01LIVECAFE',
      "FORGE_STORE_HOSTS='{\"probe.example\":\"sto_01LIVEROOT\"}'",
      'FORGE_REVALIDATE_SECRET=deadbeefdeadbeef',
      '',
    ].join('\n'),
  );

  writeFileSync(join(dir, 'stub/ssh'), STUB_SSH, { mode: 0o755 });
  const log = join(dir, 'probe.log');
  writeFileSync(log, '');

  const env = {
    ...process.env,
    PATH: `${join(dir, 'stub')}:${process.env.PATH}`,
    PROBE_LOG: log,
    PROBE_BOX_ENV: boxEnv,
    PROBE_ENV_WRITTEN: envWritten,
    PROBE_BORN: born ? 'yes' : 'no',
    PROBE_FAIL_AT: failAt,
    FORGE_LOCK: join(dir, 'forge.lock'),
    // The deploy's closing verdict waits up to two minutes for a certificate per face, and `probe.example`
    // resolves to nothing. What is graded here is the LOG, not the verdict, so the wait is zeroed rather
    // than endured — the variable is the deploy's own (`FORGE_DEPLOY_FACE_WAIT`), not one invented for a test.
    FORGE_DEPLOY_FACE_WAIT: '0',
    // ⚠️ AND THE BIRTH'S, FOR THE SAME REASON AND WITH ONE MORE: with it at its default, a sabotage that
    // turns a refusal into a warning does not FAIL this suite, it HANGS it for three minutes — and a red
    // that arrives as a timeout is a red nobody reads as one.
    FORGE_BIRTH_HEALTH_WAIT: '0',
  };
  if (FENCE) env.FORGE_PROVENANCE_BIN = FENCE;

  return {
    dir,
    log,
    boxEnv,
    envWritten,
    written: () => (existsSync(envWritten) ? readFileSync(envWritten, 'utf8') : ''),
    env,
    read: () => readFileSync(log, 'utf8'),
    boxState: () => readFileSync(boxEnv, 'utf8'),
    run: (script, args) => spawnSync('bash', [join(dir, 'bin', script), ...args], { env, encoding: 'utf8' }),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Every gesture that WRITES DATA. A deploy may reach none of them. */
const SEEDING = [
  'provision-ref.js',
  'seed-demo.js',
  'seed-history.js',
  'admin-platform-token.js',
  'bulk-read-token.js',
  'seed-box.mjs',
  'seed.mjs',
  'store-host.mjs',
];

// ── ⟂ §1 · THE CONTROL THE SLICE IS NAMED AFTER ────────────────────────────────────────────────────────────
test('a deploy without --birth, against a box that HOLDS DATA, reaches no seeding gesture', (t) => {
  if (!FENCE) {
    t.skip(
      'NOT CHECKED: the surface-provenance fence is not on this machine, so bin/deploy.sh refuses before it ' +
        'reaches the host. Point FORGE_PROVENANCE_BIN at <forge checkout>/packages/surface-codegen/dist/provenance-main.js.',
    );
    return;
  }
  const s = scratch({ born: true });
  try {
    const before = s.boxState();
    const r = s.run('deploy.sh', ['probe']);
    const log = s.read();

    // It DID deploy — otherwise the absence below would be the absence of a script that does nothing.
    assert.match(log, /migrate\.js/, `the deploy never reached the host at all; §1 would be vacuous\n${r.stdout}\n${r.stderr}`);
    for (const gesture of SEEDING) {
      assert.ok(!log.includes(gesture), `a deploy with no --birth asked the host to run ${gesture}`);
    }
    // ⚠️ AND THE HAND-OFF IS ASSERTED ON THE DEPLOY'S OWN OUTPUT, not only on the host log. Measured while
    // sabotaging this file: with the `--birth` branch neutralised the deploy DID hand over, the birth then
    // refused the box as already born, and the host log stayed innocent — so the absence of a seeding
    // gesture is true and says nothing. The line the deploy prints when it hands over is the fact.
    assert.ok(!r.stdout.includes('handing over'), 'a deploy with no --birth handed over to the birth');
    assert.equal(s.boxState(), before, "the deploy changed the box's own derived values");
  } finally {
    s.cleanup();
  }
});

// ── ⟂ §2 · AND THE CONTROL THAT KEEPS §1 FROM BEING VACUOUS ────────────────────────────────────────────────
//
// The deploy's hand-off is ONE line, so what is graded here is that the line exists, fires only under the
// flag, and is the only path from this script to anything that seeds. The birth's own behaviour is §3's.
test('--birth is the ONE path from a deploy to a birth, and it fires only when typed', () => {
  const text = readFileSync(join(ROOT, 'bin/deploy.sh'), 'utf8');
  // ⚠️ AN INVOCATION, NOT A MENTION. The deploy NAMES the birth in its help line and in the note it prints
  // before handing over, and a filter that counted those would be red over prose.
  const calls = text.split('\n').filter((l) => /^\s*bash\s+"\$HERE\/bin\/birth-remote\.sh"/.test(l));
  assert.equal(calls.length, 1, `bin/deploy.sh invokes the birth ${calls.length} time(s); it must be exactly one`);
  const at = text.indexOf(calls[0]);
  const guard = text.lastIndexOf("if [ \"$BIRTH\" = 'yes' ]", at);
  assert.ok(guard > -1 && guard < at, 'the hand-off is not inside the `--birth` branch');

  // ⛔ AND NO SEEDING ENTRYPOINT IS NAMED ANYWHERE ELSE IN THE DEPLOY. A second path would be a second truth,
  // and this is the file a pin bump runs.
  for (const gesture of SEEDING) {
    assert.ok(
      !text.split('\n').some((l) => l.includes(gesture) && !l.trimStart().startsWith('#')),
      `bin/deploy.sh names ${gesture} outside a comment`,
    );
  }
});

// ⟂ AND THE BEHAVIOURAL HALF OF §2: with the flag, against a box that has NOT been born, the deploy really
// does reach the birth's first write. Without this, §1 would also pass against a `--birth` that did nothing.
test('a deploy WITH --birth reaches the birth’s first write', (t) => {
  if (!FENCE) {
    t.skip('NOT CHECKED: no surface-provenance fence on this machine (see §1).');
    return;
  }
  const s = scratch({ born: false, failAt: 'python3' });
  try {
    s.run('deploy.sh', ['probe', '--birth']);
    const log = s.read();
    assert.match(log, /provision-ref\.js/, '--birth did not reach the birth');
  } finally {
    s.cleanup();
  }
});

test('a deploy refuses a birth-only flag when there is no birth', () => {
  const s = scratch();
  try {
    const r = s.run('deploy.sh', ['probe', '--no-warm']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /argument of the BIRTH/);
    assert.equal(s.read(), '', 'it touched the host before refusing');
  } finally {
    s.cleanup();
  }
});

// ── ⟂ §2b · THE SENTINEL MAY NOT OVERWRITE WHAT A BIRTH MINTED ────────────────────────────────────────────
//
// ⛔ MEASURED ON THE STAGING BOX, 2026-09-16, AND IT IS THE HOLE §1 COULD NOT SEE. `deploy/box.env` declares
// `FORGE_TOTEM_STORE_ID=sto_PENDING_SEED` because `compose.override.yml` refuses to interpolate without a
// value and only a seed can mint the real one. Its own comment claimed «a deploy never replaces a real id
// with this» — false: a declared key wins over a carried one, so a deploy against a box that HAD been born
// wrote the sentinel back and brought the box up with `--scale totem=0`. Nothing was deleted and the shop
// still lost a front on a pin bump.
//
// ⟂ THE CONTROL IS IN THE SAME TEST: on a box that has NOT been born, the sentinel must still be written —
// without it compose cannot parse the file at all, and the box does not come up.
test('a deploy keeps the counter id a birth minted, and still writes the sentinel on a box that has none', (t) => {
  if (!FENCE) {
    t.skip('NOT CHECKED: no surface-provenance fence on this machine (see §1).');
    return;
  }
  const born = scratch({ born: true });
  try {
    born.run('deploy.sh', ['probe']);
    assert.match(
      born.written(),
      /^FORGE_TOTEM_STORE_ID=sto_01LIVEDATA$/m,
      `the deploy wrote the sentinel over the counter id a birth had minted:\n${born.written()}`,
    );
    assert.ok(
      !born.written().includes('FORGE_TOTEM_STORE_ID=sto_PENDING_SEED'),
      'the sentinel went up beside the real id — compose would take whichever came last',
    );
    // ⟂ AND THE SOFT ONE, which is the half the live box caught and this guard originally could not see: the
    //   café's store id is read by the fork alone, its absence is SILENT (every page still answers 200), so a
    //   deploy blanking it took the café's institutional pages off the air with nothing saying so.
    assert.match(
      born.written(),
      /^FORGE_COFFEE_STORE_ID=sto_01LIVECAFE$/m,
      `the deploy blanked the café store id a birth had written:\n${born.written()}`,
    );
  } finally {
    born.cleanup();
  }

  // ⟂ and the other half: a box with nothing there gets the sentinel, because compose demands a value.
  const virgin = scratch({ born: false });
  try {
    writeFileSync(virgin.boxEnv, '');
    virgin.run('deploy.sh', ['probe']);
    assert.match(
      virgin.written(),
      /^FORGE_COFFEE_STORE_ID=sto_PENDING_SEED$/m,
      `a virgin box did not receive the café placeholder:\n${virgin.written()}`,
    );
    assert.match(
      virgin.written(),
      /^FORGE_TOTEM_STORE_ID=sto_PENDING_SEED$/m,
      `a box with no counter id got no sentinel either, and compose cannot parse the file without one:\n${virgin.written()}`,
    );
  } finally {
    virgin.cleanup();
  }
});

// ── ⟂ §2c · A KEY THE BIRTH WRITES AND `deploy/` ALSO DECLARES MUST DECLARE THE **SENTINEL** ──────────────
//
// ⛔ THE TEST ABOVE FABRICATES ITS OWN `deploy/box.env`, so it grades the RULE and not this repository's own
// declaration — and that blind spot is exactly what the staging box found twice. `FORGE_COFFEE_STORE_ID` was
// declared EMPTY, which is still a declaration, so a deploy blanked the id a birth had written and the café's
// institutional pages fell back to the shared body with every page still answering 200.
//
// ⚠️ AND EMPTY COULD NOT BE READ AS "PLACEHOLDER" IN GENERAL, which is why the repair had to be in the
// declaration rather than in the rule: empty is a real DECISION in that same file — `FORGE_ADMIN_TENANT=` is
// host mode, `FORGE_BENCH_BIND=` is every interface, `FORGE_STORAGE_DRIVER=` is the local driver. So the key
// has to SAY it is a placeholder, and this is what makes a later slice say it too.
//
// ★ THE LIST OF KEYS IS DERIVED FROM THE BIRTH ITSELF (`remote_env_put <KEY>`), never typed here: the day the
// birth writes an eighth key, this rule already covers it.
test('every key the birth writes that `deploy/` also declares is declared as the sentinel', () => {
  const birth = readFileSync(join(ROOT, 'bin/birth-remote.sh'), 'utf8');
  const written = [...birth.matchAll(/^\s*remote_env_put\s+([A-Z_][A-Z0-9_]*)/gm)].map((m) => m[1]);
  assert.ok(written.length >= 4, `only ${written.length} key(s) found — this rule is grading nothing`);

  const sentinel = 'sto_PENDING_SEED';
  const files = readdirSync(join(ROOT, 'deploy')).filter((f) => f.endsWith('.env'));
  assert.ok(files.length >= 2, 'no deploy/*.env to grade');

  for (const file of files) {
    const text = readFileSync(join(ROOT, 'deploy', file), 'utf8');
    for (const key of new Set(written)) {
      const line = text.split('\n').find((l) => l.startsWith(`${key}=`));
      if (line === undefined) continue;
      assert.equal(
        line,
        `${key}=${sentinel}`,
        `deploy/${file} declares ${key}, and a declared key wins over a carried one — so a deploy would ` +
          `overwrite what the birth mints there. Declare it as \`${sentinel}\` (the vocabulary this box ` +
          `already has for "not provisioned yet") or take it out of the file. Found: ${JSON.stringify(line)}`,
      );
    }
  }
});

// ── ⟂ §3 · A STEP THAT FAILS INTERRUPTS THE BIRTH ──────────────────────────────────────────────────────────
//
// Two placements, because "it stopped" has to mean "nothing AFTER it ran" rather than "it printed something
// and carried on": the first failure is before any write, the second is after the box is standing.
test('a birth whose data tier refuses never reaches migrate', () => {
  const s = scratch({ failAt: 'up -d postgres' });
  try {
    const r = s.run('birth-remote.sh', ['probe']);
    assert.notEqual(r.status, 0, 'the birth survived a step that failed');
    assert.match(r.stderr, /THE BIRTH STOPPED HERE/);
    const log = s.read();
    assert.ok(!log.includes('migrate.js'), 'the birth went on to migrate after the tier refused');
    for (const gesture of SEEDING) {
      assert.ok(!log.includes(gesture), `the birth reached ${gesture} after a step had failed`);
    }
  } finally {
    s.cleanup();
  }
});

test('a birth whose migration refuses never provisions a tenant', () => {
  const s = scratch({ failAt: 'migrate.js' });
  try {
    const r = s.run('birth-remote.sh', ['probe']);
    assert.notEqual(r.status, 0);
    const log = s.read();
    assert.match(log, /up -d postgres/, 'it never got as far as the step that was meant to fail');
    assert.match(log, /migrate\.js/, 'the failing step was never attempted');
    assert.ok(!log.includes('provision-ref.js'), 'the birth provisioned a tenant after the migration failed');
  } finally {
    s.cleanup();
  }
});

// ⟂ THE CONTROL: the same tree with nothing failing gets PAST both of those, so the two reds above are about
// the refusal and not about a scenario that could never run.
// ⚠️ IT IS STOPPED AT STEP 3b RATHER THAN LET RUN, and the reason is the scenario rather than impatience:
// step 5 waits three minutes for a certificate from an edge that does not exist. What this control has to
// show is that the two reds above are about the REFUSAL rather than about a scenario that could never get
// there — so it has to pass both of their failure points, and the step after the last one is enough.
// ⚠️ AND IT IS A STEP THAT REALLY DIES. Written first against step 4, this control proved nothing: minting
// the platform credential NOTES and never dies (an absent one is a degraded box, not a dead one), so the run
// sailed past the stub's refusal into step 5's three-minute wait. `3b` writes the host map with `|| die`.
test('the same birth, with nothing refusing until step 3b, gets past the tier and the migration', () => {
  const s = scratch({ failAt: 'python3' });
  try {
    s.run('birth-remote.sh', ['probe']);
    const log = s.read();
    assert.match(log, /up -d postgres/);
    assert.match(log, /migrate\.js/);
    assert.match(log, /provision-ref\.js/, 'the run stopped before provisioning for a reason of its own');
  } finally {
    s.cleanup();
  }
});

test('a box that has already been born refuses a second birth unless --again', () => {
  const s = scratch({ born: true });
  try {
    const r = s.run('birth-remote.sh', ['probe']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /HAS ALREADY BEEN BORN/);
    assert.ok(!s.read().includes('up -d postgres'), 'it started bringing the box up before refusing');

    const again = scratch({ born: true, failAt: 'migrate.js' });
    try {
      again.run('birth-remote.sh', ['probe', '--again']);
      assert.match(again.read(), /up -d postgres/, '--again did not get past the refusal');
    } finally {
      again.cleanup();
    }
  } finally {
    s.cleanup();
  }
});

// ── ⟂ §4 · THE TWO BIRTHS DECLARE THE SAME STEPS ───────────────────────────────────────────────────────────
//
// ⛔ A step added to `bin/box-up.sh` and not here is a step a DEPLOYED box silently never gets — and nothing
// else in this repository would ever say so, because the two scripts are never run on the same machine.
const stepIds = (text) => {
  const at = text.indexOf("BIRTH_STEPS='");
  assert.ok(at > -1, 'no BIRTH_STEPS in this file');
  const body = text.slice(at + "BIRTH_STEPS='".length, text.indexOf("'", at + "BIRTH_STEPS='".length));
  return body
    .split('\n')
    .map((l) => l.split('|')[0].trim())
    .filter(Boolean);
};

test('the remote birth declares every step the bench birth declares, in the same order', () => {
  const bench = stepIds(readFileSync(join(ROOT, 'bin/box-up.sh'), 'utf8'));
  const remote = stepIds(readFileSync(join(ROOT, 'bin/birth-remote.sh'), 'utf8'));
  assert.deepEqual(
    remote,
    bench,
    'the two birth step lists have diverged. A step the bench gained and this one did not is a step a ' +
      'deployed box never gets; one this one gained alone is a step no bench ever proves.',
  );
});

test('every step the remote birth declares is either said or skipped in the file', () => {
  const text = readFileSync(join(ROOT, 'bin/birth-remote.sh'), 'utf8');
  const body = text.slice(text.indexOf('\nset -uo pipefail'));
  for (const id of stepIds(text)) {
    const said = new RegExp(`say '${id.replace('-', '-')} ·`).test(body);
    const skipped = new RegExp(`skip ${id} `).test(body);
    assert.ok(said || skipped, `step ${id} is declared and the file neither says nor skips it`);
  }
});

// ── ⟂ §5 · THE ADDRESS PLAN ────────────────────────────────────────────────────────────────────────────────
test('a birth refuses an environment that has no address for a face this box declares', () => {
  const s = scratch({ missingFace: true });
  try {
    const r = s.run('birth-remote.sh', ['probe']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /FORGE_CAFE_DOMAIN/);
    assert.equal(s.read(), '', 'it touched the host before refusing an environment it cannot be born into');
  } finally {
    s.cleanup();
  }
});

test('a birth refuses an environment whose face carries a BENCH address', () => {
  const s = scratch({ bench: true });
  try {
    const r = s.run('birth-remote.sh', ['probe']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /BENCH address/);
    assert.equal(s.read(), '', 'it touched the host before refusing');
  } finally {
    s.cleanup();
  }
});

// ⟂ AND THE CONTROL: the complete environment yields SIX faces and does not refuse — otherwise the two reds
// above would also pass against a module that refused everything.
test('a complete environment yields one face per declaration', async () => {
  const { deployedFaces } = await import('./deployed-faces.mjs');
  const { faces } = deployedFaces(
    {
      FORGE_DOMAIN: 'probe.example',
      FORGE_CAFE_DOMAIN: 'cafe.probe.example',
      FORGE_ADMIN_DOMAIN: 'admin.probe.example',
      FORGE_CAFE_ADMIN_DOMAIN: 'admin.cafe.probe.example',
    },
    PROBE_BOX,
  );
  assert.equal(faces.length, 4);
  assert.deepEqual(
    faces.map((f) => f.value).sort(),
    ['admin.cafe.probe.example', 'admin.probe.example', 'cafe.probe.example', 'probe.example'],
  );
});

// ── ⟂ THE COUNTER IS EDGE-ONLY, AND THE DECLARATION IS WHAT SAYS SO ────────────────────────────────────────
//
// `directory: false` is the whole distinction pk34 had to draw: WHERE A FRONT ANSWERS is not WHAT THE
// KERNEL'S ADDRESS BOOK CLAIMS FOR THAT STORE. A birth that claimed the counter's hostname would put an
// «Acompanhar o pedido» button on every counter receipt pointing at the totem's own 404.
test('a face declared directory:false is carried as edge-only, never dropped and never claimed', async () => {
  const { deployedFaces } = await import('./deployed-faces.mjs');
  const box = structuredClone(PROBE_BOX);
  box.tenants[1].stores.push({
    handle: 'balcao',
    name: 'Balcão',
    domain: { host: 'totem.probe.example', env: 'FORGE_TOTEM_DOMAIN', directory: false },
  });
  const { faces } = deployedFaces(
    {
      FORGE_DOMAIN: 'probe.example',
      FORGE_CAFE_DOMAIN: 'cafe.probe.example',
      FORGE_TOTEM_DOMAIN: 'totem.probe.example',
      FORGE_ADMIN_DOMAIN: 'admin.probe.example',
      FORGE_CAFE_ADMIN_DOMAIN: 'admin.cafe.probe.example',
    },
    box,
  );
  const totem = faces.find((f) => f.store === 'balcao');
  assert.ok(totem, 'the counter was dropped from the plan instead of being carried as edge-only');
  assert.equal(totem.directory, false);
});

// ── ⟂ §5b · NOBODY PRE-FLATTENS THE VEHICLE'S ARGUMENTS ANY MORE ──────────────────────────────────────────
//
// ⛔ MEASURED ON THE STAGING BOX, 2026-09-16, ON THE FIRST RUN AFTER THE VEHICLE MOVED. `remote_compose` used
// to take ONE string and interpolate it with `$*`; it now re-quotes each argument (so that a store called
// «Forge Café» survives the trip, which is the whole reason it moved). A caller left in the old shape sends
// `-f compose.yml -f compose.override.yml ps` as a SINGLE token, and `docker compose` answers by printing its
// help — sixty lines of it, on the deploy's verdict, with exit 0. Nothing was broken and nothing said so.
test('every remote_compose caller passes arguments, not one pre-flattened string', () => {
  for (const file of ['bin/deploy.sh', 'bin/birth-remote.sh']) {
    for (const [i, line] of readFileSync(join(ROOT, file), 'utf8').split('\n').entries()) {
      if (!/^\s*remote_compose\s/.test(line)) continue;
      assert.ok(
        !line.includes('[*]'),
        `${file}:${i + 1} still flattens its arguments — the vehicle would send them as one token:\n  ${line.trim()}`,
      );
    }
  }
});

// ── ⟂ §5c · THE VEHICLE KEEPS THE CONNECTION AWAKE ────────────────────────────────────────────────────────
//
// ⛔ MEASURED ON THE STAGING BOX, 2026-09-16, TWICE. The massive seed prints nothing for ten to thirty minutes
// while it writes; both times the one-shot FINISHED on the box and the local ssh never returned. A hang is
// the one ending a birth's discipline cannot cover — every refusal in `bin/birth-remote.sh` is written so a
// failing step STOPS the run, and a step that neither fails nor returns escapes all of it.
//
// ⚠️ IT IS GRADED ON THE COMMAND THE VEHICLE BUILDS, not by waiting fifteen minutes for a VM to go quiet.
// The option either reaches `ssh` or it does not.
test('every remote gesture travels with a keepalive, so a silent quarter of an hour cannot hang the birth', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forge-remote-keepalive-'));
  try {
    mkdirSync(join(dir, 'stub'), { recursive: true });
    mkdirSync(join(dir, 'deploy'), { recursive: true });
    // The far side prints the ARGUMENTS it was given, which is the whole subject here.
    writeFileSync(join(dir, 'stub/ssh'), '#!/usr/bin/env bash\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
    writeFileSync(join(dir, 'deploy/box.env'), '');
    writeFileSync(
      join(dir, 'deploy/probe.env'),
      [
        'FORGE_DEPLOY_HOST=probe.invalid',
        'FORGE_DEPLOY_USER=root',
        'FORGE_DEPLOY_DIR=/opt/probe',
        'FORGE_DOMAIN=probe.example',
        'FORGE_ADMIN_DOMAIN=admin.probe.example',
        'FORGE_PUBLIC_ORIGIN=https://probe.example',
        '',
      ].join('\n'),
    );
    const r = spawnSync(
      'bash',
      [
        '-c',
        `set -uo pipefail
. ${JSON.stringify(join(ROOT, 'bin/remote-box.sh'))}
remote_box_load probe ${JSON.stringify(dir)} remote_box_die || exit 1
remote_run true`,
      ],
      { env: { ...process.env, PATH: `${join(dir, 'stub')}:${process.env.PATH}` }, encoding: 'utf8' },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /ServerAliveInterval=\d+/, 'no keepalive interval: a silent command can hang forever');
    assert.match(r.stdout, /ServerAliveCountMax=\d+/, 'no keepalive ceiling: a dead session would never be declared dead');
    // ⟂ the control — the option that was already there still is, so this is not a test that passes on any
    //   string containing "ServerAlive".
    assert.match(r.stdout, /ConnectTimeout=\d+/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── ⟂ §5d · A CONTAINER PATH MAY NEVER REACH A HOST PROCESS ───────────────────────────────────────────────
//
// ⛔ MEASURED ON THE STAGING BOX 2026-09-16, AT STEP 11, AFTER TWENTY MINUTES OF SEEDING:
// «FORGE_SEED_DATASET_DIR=/app/seed-dataset holds no forge-seed-dataset.json». `deploy/box.env` declares the
// paths the BOX's containers read, `remote_box_load` sources that file into the birth's own shell (it is
// where the host and the hostnames come from), and every node process the birth starts HERE inherited a path
// that is true three thousand kilometres away.
//
// ⚠️ THE ASSERTION IS THE GENERAL RULE, NOT THE TWO VARIABLES THAT BIT. A third one added to `deploy/box.env`
// next month has to be caught too, and it is caught by the same line: the birth blanks anything of that
// shape and says which. So this scenario puts a variable there that NOTHING in this repository knows.
test('a path that only exists inside a container never reaches the steps that run here', () => {
  const s = scratch({ failAt: 'up -d postgres' });
  try {
    writeFileSync(
      join(s.dir, 'deploy/box.env'),
      [
        'FORGE_ADMIN_TENANT=',
        'FORGE_SEED_DATASET_HOST_DIR=./seed/dataset',
        'FORGE_TOTEM_STORE_ID=sto_PENDING_SEED',
        'FORGE_SEED_DATASET_DIR=/app/seed-dataset',
        'FORGE_SEED_PHOTOS_DIR=/data/seed-photos',
        // The one nothing here has ever heard of — this is the half that keeps the rule from going stale.
        'FORGE_SOMETHING_NOBODY_KNOWS_DIR=/data/invented-by-a-later-slice',
        '',
      ].join('\n'),
    );
    const r = s.run('birth-remote.sh', ['probe']);
    assert.match(r.stderr, /FORGE_SEED_PHOTOS_DIR/, 'a container path was carried into this machine unnoticed');
    assert.match(
      r.stderr,
      /FORGE_SOMETHING_NOBODY_KNOWS_DIR/,
      'the rule only covers the variables somebody remembered to list',
    );
    // ⟂ THE CONTROL: the dataset is REMAPPED rather than blanked — blanking it would make step 0c refuse for
    //   a reason that has nothing to do with the box, which is the opposite failure.
    assert.ok(
      !/blanked container path\(s\)[^\n]*FORGE_SEED_DATASET_DIR/.test(r.stderr),
      'the dataset pointer was blanked instead of pointed at the tree this machine really holds',
    );
    assert.match(r.stderr, /the same tree the images were built from|catalog /, 'step 0c never graded the dataset');
  } finally {
    s.cleanup();
  }
});

// ── ⟂ §6 · THE BOX'S `.env` IS WRITTEN VERBATIM, AND THE VALUE REALLY ARRIVES ──────────────────────────────
//
// ⛔ THE BUG THIS EXISTS FOR, CAUGHT BEFORE THE FUNCTION HAD EVER RUN AGAINST A REAL BOX. `remote_env_put`
// sent the value down the pipe and read it with `sys.stdin.read()` — but `python3 -` takes its PROGRAM from
// stdin, and the program arrives in a here-doc, so the pipe and the here-doc are the same channel. The read
// returned the EMPTY STRING: every key the birth writes would have landed as `NAME=` on a box whose files
// then look plausible, and the first thing anyone would have noticed is a front resolving no store.
//
// ★ SO THE STUB HERE IS NOT A RECORDER — IT RUNS THE COMMAND. That is the only way to catch this class: a
// stub that records `python3 …` and answers 0 is green over a writer that writes nothing.
//
// ⟂ AND THE VALUE CARRIES `&`, `|` AND `\`, the three characters sed's replacement side treats as syntax.
// `bin/box-up.sh::put_env` closed that class on the bench for exactly this reason («the values here are
// GENERATED, and "no `&` in any of them, ever" is a property nobody is checking»); this is the same rule
// asked of the same writer one machine away.
test('a key written to the box arrives verbatim, value and all', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forge-remote-env-'));
  try {
    mkdirSync(join(dir, 'stub'), { recursive: true });
    mkdirSync(join(dir, 'box'), { recursive: true });
    mkdirSync(join(dir, 'deploy'), { recursive: true });
    // The far side, for real: strip ssh's options, run the command here. The box's directory is a local path.
    writeFileSync(
      join(dir, 'stub/ssh'),
      '#!/usr/bin/env bash\nexec bash -c "${@: -1}"\n',
      { mode: 0o755 },
    );
    writeFileSync(join(dir, 'box/.env'), 'FORGE_KEPT=yes\nFORGE_TARGET=old\n');
    writeFileSync(join(dir, 'deploy/box.env'), '');
    writeFileSync(
      join(dir, 'deploy/probe.env'),
      [
        'FORGE_DEPLOY_HOST=probe.invalid',
        'FORGE_DEPLOY_USER=root',
        `FORGE_DEPLOY_DIR=${join(dir, 'box')}`,
        'FORGE_DOMAIN=probe.example',
        'FORGE_ADMIN_DOMAIN=admin.probe.example',
        'FORGE_PUBLIC_ORIGIN=https://probe.example',
        '',
      ].join('\n'),
    );
    const tricky = String.raw`'{"a&b":"c|d\e"}'`;
    const driver = `
set -uo pipefail
. ${JSON.stringify(join(ROOT, 'bin/remote-box.sh'))}
remote_box_load probe ${JSON.stringify(dir)} remote_box_die || exit 1
remote_env_put FORGE_TARGET ${JSON.stringify(tricky)} || exit 1
remote_env_put FORGE_NEW sto_01NEW || exit 1
remote_env_get FORGE_TARGET
`;
    const r = spawnSync('bash', ['-c', driver], {
      env: { ...process.env, PATH: `${join(dir, 'stub')}:${process.env.PATH}` },
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, `the writer refused: ${r.stderr}`);

    const env = readFileSync(join(dir, 'box/.env'), 'utf8');
    assert.match(env, /^FORGE_KEPT=yes$/m, 'a key this deploy does not declare was dropped');
    assert.match(env, /^FORGE_NEW=sto_01NEW$/m, 'an appended key never arrived');
    assert.ok(env.includes(`FORGE_TARGET=${tricky}`), `the value did not arrive verbatim:\n${env}`);
    assert.ok(!/^FORGE_TARGET=old$/m.test(env), 'the old value survived beside the new one');
    assert.equal(r.stdout.trim(), tricky, 'reading the key back gave something else');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
