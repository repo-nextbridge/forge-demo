// ★★ EVERY VOLUME THE BOX DECLARES IS CLASSIFIED, AND THE CERTIFICATES ARE NOT STATE.
//
// `bin/box-down.sh` sorts this box's volumes into three kinds and treats each differently: STATE is
// destroyed, IDENTITY is kept, CACHE is kept unless `--all`. The script names them EXPLICITLY rather than
// sweeping, precisely so that a volume nobody has thought about shows up as unclassified instead of being
// silently destroyed — and that promise is only worth something if something checks it.
//
// ⛔ THE DEFECT THIS EXISTS TO PREVENT, MEASURED 2026-09-16. `caddy_data` and `caddy_config` were in STATE, so
// every rebirth destroyed the edge's TLS certificates and its ACME account. Invisible on this bench, where
// `caddy/Caddyfile.local` sets `auto_https off` and no certificate is ever issued. Online it means a box
// reborn weekly by cron re-issues six certificates and re-registers an account every week — and the
// DUPLICATE CERTIFICATE limit is 5 per week for the same name set, so a rebirth that fails and is retried a
// few times in one day leaves the shop with NO TLS until the week rolls over.
//
// ⚠️ TWO ASSERTIONS, AND THE SECOND IS THE ONE THAT WOULD HAVE CAUGHT IT. The first (every declared volume is
// classified) was already the script's stated intent. The second (the edge's volumes are NOT in STATE) is the
// one nobody was making — the volumes WERE classified, into the wrong kind, and a completeness check alone
// reads that as healthy.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const script = readFileSync(join(repo, 'bin/box-down.sh'), 'utf8');
// ★ v0.3.3 — BOTH FILES. `compose.override.yml` declares the café's and the totem's data-cache volumes beside the
// services that mount them, and compose merges the two top-level `volumes:` blocks; a guard that read one file
// would call those two orphans of box-down.
const COMPOSE_FILES = ['compose.yml', 'compose.override.yml'];

/** The volumes one compose file declares, from its top-level `volumes:` block (none → empty). */
export function volumesOf(text) {
  // ⚠️ `\Z` is NOT a JavaScript anchor — it is a literal Z, and writing it here made this parse read
  // nothing while looking correct. The end-of-input anchor in JS is `$(?![\s\S])`.
  const block = /^volumes:\n([\s\S]*?)(?=^\S|$(?![\s\S]))/m.exec(text);
  if (!block) return new Set();
  return new Set(
    block[1]
      .split('\n')
      .map((l) => /^ {2}([a-z0-9_]+):/.exec(l))
      .filter(Boolean)
      .map((m) => m[1]),
  );
}

/** The volumes the box declares, across both compose files. */
function declaredVolumes() {
  const main = volumesOf(readFileSync(join(repo, 'compose.yml'), 'utf8'));
  assert.ok(main.size > 0, 'compose.yml has no top-level `volumes:` block — this guard is reading the wrong file.');
  return new Set(COMPOSE_FILES.flatMap((f) => [...volumesOf(readFileSync(join(repo, f), 'utf8'))]));
}

const KINDS = ['STATE', 'IDENTITY', 'RECORD', 'CACHE'];

/** A category list as `bin/box-down.sh` writes it: `NAME='a b c'`. */
function category(name) {
  const m = new RegExp(`^${name}='([^']*)'`, 'm').exec(script);
  assert.ok(m, `bin/box-down.sh no longer declares ${name}= — the categories were renamed or removed.`);
  return new Set(m[1].split(/\s+/).filter(Boolean));
}

test('every volume the compose declares is classified by box-down', () => {
  const declared = declaredVolumes();
  assert.ok(declared.size > 0, 'read no volumes from compose.yml — the parse is broken, not the tree.');
  const classified = new Set(KINDS.flatMap((k) => [...category(k)]));
  const unclassified = [...declared].filter((v) => !classified.has(v));
  assert.deepEqual(
    unclassified,
    [],
    `compose.yml declares volume(s) that bin/box-down.sh never names: ${unclassified.join(', ')}. ` +
      'Decide which kind each is — destroyed (STATE), kept because it is this box at this address ' +
      '(IDENTITY), what the box wrote down about itself (RECORD), or re-fetchable (CACHE) — and add it to that list.',
  );
});

test('box-down names no volume the compose does not declare', () => {
  const declared = declaredVolumes();
  const classified = KINDS.flatMap((k) => [...category(k)]);
  const orphan = classified.filter((v) => !declared.has(v));
  assert.deepEqual(orphan, [], `bin/box-down.sh classifies volume(s) this box no longer has: ${orphan.join(', ')}.`);
});

test("★ the edge's certificates are NOT state — a rebirth may not destroy them", () => {
  const state = category('STATE');
  for (const v of ['caddy_data', 'caddy_config']) {
    assert.ok(
      !state.has(v),
      `${v} is back in STATE, so every rebirth destroys it. That volume holds the TLS certificates and the ` +
        'ACME account key: a box reborn weekly would re-issue six certificates a week, and the duplicate-' +
        'certificate allowance (5/week for one name set) is spent by a couple of failed retries — after ' +
        'which the shop answers with no certificate at all. It belongs in IDENTITY.',
    );
  }
  const identity = category('IDENTITY');
  assert.ok(
    identity.has('caddy_data') && identity.has('caddy_config'),
    "the edge's volumes left IDENTITY. If the edge stopped holding certificates, say so here; otherwise this " +
      'is the rebirth quietly getting a new machine wearing the old name.',
  );
});

test('⟂ the database IS state — this guard did not make everything precious', () => {
  const state = category('STATE');
  for (const v of ['pgdata', 'redisdata', 'media']) {
    assert.ok(state.has(v), `${v} left STATE. A birth that keeps the database is not a birth.`);
  }
});

// ── ★★ v0.3.3 — THE FRONTS' DATA CACHES DIE WITH THE DATABASE; THE EDGE'S LOG DOES NOT ─────────────────────
//
// Until v0.3.3 the fronts kept their cached port reads in the container layer, so every `down` dropped them and
// a restore served nothing stale (`bin/demo-reset.sh` says it measured that). VC-1 put them on volumes, and a
// volume survives `down` — so the property now holds only if box-down DESTROYS them, i.e. calls them STATE.
// The access log is the opposite case: kept across a rebirth, because the days before it are what it is for.

/** Every named volume a compose file mounts at the data-cache directory the service declares. */
export function dataCacheVolumes(text) {
  const out = [];
  for (const m of text.matchAll(/FORGE_DATA_CACHE_DIR:\s*(\S+)/g)) {
    const dir = m[1];
    const rest = text.slice(m.index);
    const mount = new RegExp(`^ {6}- ([a-z0-9_]+):${dir.replace(/[/.]/g, '\\$&')}\\s*$`, 'm').exec(rest);
    if (mount) out.push(mount[1]);
  }
  return out;
}

test('★★ every front data-cache volume is STATE — a restore may not serve a render of the previous database', () => {
  const state = category('STATE');
  const caches = COMPOSE_FILES.flatMap((f) => dataCacheVolumes(readFileSync(join(repo, f), 'utf8')));
  assert.ok(caches.length >= 3, `read only ${caches.length} data-cache volume(s) — storefront, café and totem each mount one`);
  for (const v of caches) {
    assert.ok(state.has(v), `${v} holds a front's cached port reads and is not STATE: a restore would keep it.`);
  }
});

test("★ the edge's access log is kept by a rebirth (RECORD), never destroyed as STATE", () => {
  assert.ok(category('RECORD').has('caddy_logs'), 'caddy_logs left RECORD');
  assert.ok(!category('STATE').has('caddy_logs'), 'caddy_logs is STATE: every rebirth erases the edge log of the days before it');
});

test('control: the data-cache reader sees a mount at the declared directory, and only that one', () => {
  const svc = (dir, mount) =>
    `  x:\n    environment:\n      FORGE_DATA_CACHE_DIR: ${dir}\n    volumes:\n      - ./themes:/t:ro\n      - ${mount}\n`;
  assert.deepEqual(dataCacheVolumes(svc('/var/cache/forge-storefront', 'a_cache:/var/cache/forge-storefront')), ['a_cache']);
  assert.deepEqual(dataCacheVolumes(svc('/var/cache/forge-storefront', 'a_cache:/elsewhere')), []);
  assert.deepEqual(volumesOf('services:\n  x: {}\nvolumes:\n  a:\n  # b:\n  c:\n'), new Set(['a', 'c']));
});

// ── ★★★ THE DESTINATION MOVED; THE RULES DID NOT ────────────────────────────────────────────────────────────
//
// ⛔ MEASURED 2026-09-17: there was no way to tear a DEPLOYED box down. `bin/box-cycle.sh` calls `box-down.sh`
// directly, so the weekly rebirth of the INFRA-EXEMPLAR spec could not exist; and the one remote gesture that
// did, `birth-remote --again`, CONVERGES — which does not finish on a box that has had commerce (17 SKUs with
// a reservation made `inventory.adjust` refuse to put stock back below what is reserved, correctly).
//
// `--env` was the answer, and the danger it brings is a SECOND OPINION about what a certificate is. These
// hold the single author: one file, one set of lists, whichever box is being torn down.

test('★★★ `--env` exists, and it routes through the ONE place that knows how to reach a box', () => {
  assert.match(script, /--env\)/, 'box-down.sh has no --env: a deployed box cannot be torn down');
  assert.match(
    script,
    /remote-box\.sh[\s\S]{0,200}remote_box_load/,
    'the remote destination is built here instead of through bin/remote-box.sh — that is a second author of the ssh command',
  );
});

test('★★★ the four category lists exist EXACTLY ONCE — a remote run reads the same ones', () => {
  for (const [name, re] of [
    ['STATE', /^STATE=/gm],
    ['IDENTITY', /^IDENTITY=/gm],
    ['RECORD', /^RECORD=/gm],
    ['CACHE', /^CACHE=/gm],
  ]) {
    const hits = script.match(re) ?? [];
    assert.equal(
      hits.length,
      1,
      `${name} is assigned ${hits.length} time(s). Two assignments is two opinions about what that volume is, ` +
        'and the remote box would get whichever one ran last.',
    );
  }
});

test("★★ a REMOTE run uses the BOX's secrets, never this checkout's", () => {
  // Sourcing this checkout's env-source for a remote `down` would hand the deployed box the bench's database
  // URL — and compose would either interpolate the wrong thing or refuse, leaving the containers standing.
  assert.match(
    script,
    /if \[ -z "\$ENV_NAME" \][\s\S]{0,260}env-source\.sh/,
    'the local env-source is sourced unconditionally; a remote run must not read this checkout\'s secrets',
  );
  assert.match(
    script,
    /REMOTE_PRELUDE=.{0,40}env-source\.sh/,
    'a remote compose command carries no env-source prelude, so `${DATABASE_URL:?}` will stop the teardown',
  );
});

test('★★ `--plan` destroys nothing — every `volume rm` is behind the check', () => {
  const removals = [...script.matchAll(/docker volume rm/g)];
  assert.ok(removals.length > 0, 'no volume removal at all — this guard is about the ones that exist');
  for (const m of removals) {
    const before = script.slice(Math.max(0, m.index - 220), m.index);
    assert.match(
      before,
      /\$PLAN"? = 1/,
      'a `docker volume rm` is not guarded by the PLAN check — a plan that destroys is not a plan',
    );
  }
});
