// ★★ THE CAFÉ'S STORE ID REACHES ITS OWN STOREFRONT — DERIVED, DECLARED, DELIVERED, READ.
//
//   node --test bin/coffee-store-id.guard.mjs        (or: bash bin/test.sh)
//
// ── WHAT THIS IS ABOUT, AND IT HAS HAPPENED HERE ALREADY ────────────────────────────────────────────────
//
// The coffee storefront is a FORK, so it may give ONE store institutional pages of its own — the reference
// vitrine may not, because an entry in its overlay would be one customer's store id inside every instance's
// image. The overlay is keyed by a store id, and on this box a store id is a ULID that `provision-ref` mints
// FRESH ON EVERY BIRTH. A `sto_…` written into a source file is therefore correct until the next
// `bash bin/box-up.sh` and wrong forever after, in silence.
//
// Not a hypothesis: the café's edge rule (`caddy/extra-local/coffee.caddy`) shipped with a hand-written id from a bench that no
// longer existed. The rule matched nothing, every café request fell through to the VANILLA storefront, and
// the page still LOOKED right because the theme is resolved from the store's own row — it fooled two people.
// Step 3c of `bin/box-up.sh` closed that by generating the rule from the id it had just provisioned.
//
// ── WHY A GUARD OVER FOUR FILES AND NOT A TEST IN THE FORK ──────────────────────────────────────────────
//
// The fork's own suite grades what the overlay DOES with an id. It cannot grade whether an id ever arrives,
// and that is the failure with no symptom: the shop answers 200 either way, in the body it shares with the
// reference vitrine, so a missing compose line or an un-run `put_env` looks exactly like a shop that never
// had the feature. Same shape as A44 (`bin/box-config.guard.mjs`), which this file follows: a value has to be
// DERIVED at birth, DECLARED where a human copying `.env.example` sees it, DELIVERED to the container, and
// READ by the process. Any one of the four missing is invisible.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const VAR = 'FORGE_COFFEE_STORE_ID';
const SENTINEL = 'sto_PENDING_SEED';
const FORK_SRC = join(ROOT, 'storefront-coffee', 'src');

const BOX_UP = read('bin/box-up.sh');
const ENV_EXAMPLE = read('.env.example');
const OVERRIDE = read('compose.override.yml');
const OWN_STORE = read('storefront-coffee/src/lib/own-store.ts');

// ── 1 · DERIVED ─────────────────────────────────────────────────────────────────────────────────────────

test('★★ DERIVED — box-up writes the café store id it just provisioned, in step 3c', () => {
  assert.match(
    BOX_UP,
    new RegExp(`put_env\\s+${VAR}\\s+"\\$CAFE_STORE"`),
    `bin/box-up.sh no longer writes ${VAR} from $CAFE_STORE. Hand-writing it into .env is what this guard ` +
      'is about: the id is a fresh ULID on every birth, so a value that is not derived is a value that rots ' +
      'the next time the box is born — and rots without a symptom.',
  );

  // ★ AND IN THE BLOCK WHERE THE ID EXISTS. `CAFE_STORE` is assigned in the provisioning loop (step 3a) and
  //   the write has to sit after it and before step 5 brings the containers up, because a container reads
  //   its environment at boot. Proved by ORDER in the file rather than by a line number, which rots.
  const assigned = BOX_UP.indexOf('CAFE_STORE="$store"');
  const written = BOX_UP.indexOf(`put_env ${VAR}`);
  const containersUp = BOX_UP.indexOf("say '5 ");
  assert.ok(assigned > 0, 'bin/box-up.sh no longer assigns CAFE_STORE — step 3a moved.');
  assert.ok(
    assigned < written,
    `${VAR} is written before CAFE_STORE is resolved, so it would be written empty.`,
  );
  if (containersUp > 0)
    assert.ok(
      written < containersUp,
      `${VAR} is written AFTER the containers come up. The storefront reads its environment at boot, so ` +
        'the running container would not have it — the value would be correct in .env and absent in the process.',
    );
});

// ── 2 · DECLARED ────────────────────────────────────────────────────────────────────────────────────────

test('★ DECLARED — .env.example carries the variable, as the sentinel and never as a real id', () => {
  const line = ENV_EXAMPLE.split('\n').find((l) => l.startsWith(`${VAR}=`));
  assert.ok(
    line,
    `.env.example does not declare ${VAR}. A human copying that file would have no idea the variable ` +
      'exists, and the café would quietly serve the reference vitrine\'s copy on its own pages.',
  );
  assert.equal(
    line,
    `${VAR}=${SENTINEL}`,
    `.env.example ships ${VAR} as something other than the sentinel. A real \`sto_…\` there is the rot this ` +
      'whole mechanism exists against: it is an id from a box that no longer exists, and it matches nothing.',
  );
});

// ── 3 · DELIVERED ───────────────────────────────────────────────────────────────────────────────────────

/** The `storefront-coffee` service block of compose.override.yml — up to the next top-level service key. */
function coffeeService() {
  const start = OVERRIDE.indexOf('\n  storefront-coffee:\n');
  assert.ok(start >= 0, 'compose.override.yml no longer declares a `storefront-coffee` service.');
  const rest = OVERRIDE.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][\w-]*:\n/);
  return next >= 0 ? rest.slice(0, next + 1) : rest;
}

test('★★ DELIVERED — compose hands the variable to the COFFEE service, not to some other one', () => {
  const block = coffeeService();
  assert.match(
    block,
    new RegExp(`^\\s+${VAR}: \\$\\{${VAR}[:-]`, 'm'),
    `compose.override.yml does not pass ${VAR} to storefront-coffee. This was the leg actually missing when ` +
      'A44 was measured on the sibling variable: a correct .env reaching no container at all.',
  );
  // ⚠️ SOFT, NOT REQUIRED — and it is a decision, not an oversight. `${VAR:?…}` would refuse to start the
  //    shop over one paragraph; the totem's own id is hard for the opposite reason (a till pointed at no
  //    store is the wrong shop). If somebody makes this hard, the box stops booting from a bare .env.example.
  assert.match(
    block,
    new RegExp(`${VAR}: \\$\\{${VAR}:-`),
    `${VAR} is delivered with a REQUIRED (\`:?\`) interpolation. That makes a bare .env.example unable to ` +
      'bring the shop up, to protect a fallback that is already harmless. See the comment in compose.override.yml.',
  );
  // And it must not be a literal: a `sto_…` typed here rots exactly like one typed in the source.
  assert.doesNotMatch(
    block,
    new RegExp(`${VAR}: *sto_(?!PENDING)`),
    `compose.override.yml pins a literal store id for ${VAR}.`,
  );
});

// ── 4 · READ ────────────────────────────────────────────────────────────────────────────────────────────

test('★ READ — the fork resolves the variable by that exact name, and refuses the sentinel', () => {
  assert.ok(
    OWN_STORE.includes(`'${VAR}'`),
    `storefront-coffee/src/lib/own-store.ts no longer names ${VAR}. The four files have to agree on the ` +
      'spelling; nothing checks it at runtime, because an unread variable is simply an absent one.',
  );
  assert.ok(
    OWN_STORE.includes(`'${SENTINEL}'`),
    `own-store.ts does not name "${SENTINEL}". The sentinel starts with \`sto_\`, so a prefix check alone ` +
      'grades it VALID and the overlay is keyed on a string no store will ever carry — a box copied from ' +
      '.env.example and never born, indistinguishable from a broken step 3c.',
  );
});

// ── 5 · ⛔ AND NOWHERE IS A STORE ID WRITTEN BY HAND ────────────────────────────────────────────────────

/** Every source file of the fork that ships in the image — tests and fixtures excluded, by name. */
function forkSources(dir = FORK_SRC, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      forkSources(full, out);
    } else if (/\.(ts|tsx|mjs|js)$/.test(entry.name) && !/\.(test|guard\.test)\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** A store id as `provision-ref` mints them: the prefix plus a ULID. The sentinel is not one. */
const HAND_WRITTEN_ID = /\bsto_(?!PENDING_SEED\b)[0-9A-HJKMNP-TV-Z]{10,}/;

/**
 * The file with its COMMENT LINES removed — and that exemption is the first thing this guard measured.
 *
 * `src/components/coffee/CoffeeChrome.tsx` records, in prose, the two ids it compared to prove that the bag
 * in the coffee shop was landing in the SHOE shop's checkout (*"`/checkout` answered with store
 * sto_01M1DE555DZ… while `/s/<café>/checkout` answered with sto_01M1DE555TJ…"*). That is a MEASUREMENT, and
 * a guard that refuses it would be teaching this repository to stop writing down what it measured — the one
 * habit that makes these files readable a year later. What must never exist is an id the image USES.
 *
 * ⚠️ WHOLE LINES ONLY, never a `//` found mid-line: stripping from an arbitrary `//` would also eat the tail
 * of any line holding a URL, and a value hidden behind one would go unscanned. A soldered id lives in code,
 * and code does not begin with a comment marker.
 */
function codeOnly(text) {
  const out = [];
  let inBlock = false;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (inBlock) {
      if (t.includes('*/')) inBlock = false;
      continue;
    }
    if (t.startsWith('/*')) {
      if (!t.includes('*/')) inBlock = true;
      continue;
    }
    if (t.startsWith('//') || t.startsWith('*')) continue;
    out.push(line);
  }
  return out.join('\n');
}

test('⛔ no store id is written by hand anywhere in the image the café ships', () => {
  const files = forkSources();
  assert.ok(
    files.length > 20,
    `only ${files.length} source file(s) found under storefront-coffee/src — this guard is looking at the ` +
      'wrong tree, and a scan over nothing is green for the wrong reason.',
  );
  const offenders = [];
  for (const file of files) {
    const hit = codeOnly(readFileSync(file, 'utf8')).match(HAND_WRITTEN_ID);
    if (hit) offenders.push(`${relative(ROOT, file)}: ${hit[0]}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `a store id is soldered into the coffee fork's source: ${offenders.join(' · ')}. Store ids are minted ` +
      `fresh on every birth; the id arrives through ${VAR} (bin/box-up.sh step 3c → compose.override.yml → ` +
      'src/lib/own-store.ts) and nowhere else. This is the defect caddy/extra-local/coffee.caddy had.',
  );
});

test('★ the scan can SEE a soldered id — the control the test above needs to mean anything', () => {
  // Without this, an escape or a tightened character class would leave the scan green over a source tree
  // full of dead ids, which is precisely the state it exists to refuse.
  const soldered = codeOnly("const CAFE = 'sto_01M1JS22WZ4RN8PGH9GG56PJPW';");
  assert.match(soldered, HAND_WRITTEN_ID);
  assert.doesNotMatch(`${VAR}=${SENTINEL}`, HAND_WRITTEN_ID, 'the sentinel must not read as a real id');

  // ★ AND THE EXEMPTION IS PROVED IN BOTH DIRECTIONS, or `codeOnly` could be silently swallowing everything.
  assert.equal(codeOnly('// measured: sto_01M1DE555DZ answered').trim(), '');
  assert.equal(
    codeOnly(' * the id was sto_01M1DE555TJ, with the coffee theme').trim(),
    '',
    'a block-comment continuation line is prose too',
  );
  assert.match(
    codeOnly("// measured once\nconst id = 'sto_01M1DE555DZQQQQQQQQQQQQQQ';"),
    HAND_WRITTEN_ID,
    'a file that opens with a comment must still have its CODE scanned',
  );
});

// ── 6 · AND THE FORK STILL HAS SOMETHING TO PUT IN THE OVERLAY ──────────────────────────────────────────

test('★★ against the vacuum — the fork declares at least one template of the café\'s own', () => {
  // Every check above is satisfied by an image that wires the id perfectly and gives the café nothing. The
  // fork's vitest suite asserts this over the runtime map; it is repeated here because `bash bin/test.sh`
  // reports a fork whose node_modules is absent as NOT CHECKED, and this file always runs.
  const registry = read('storefront-coffee/src/templates/cms/registry.ts');
  // ⚠️ UP TO THE FIRST `}`, and that is a measured correction rather than a style. Written as
  // `= \{([\s\S]*?)\n\};` this matched an EMPTIED map (`= {};`, which has no newline before its brace) by
  // running on to the next `\n};` in the file — the `ResolvedPageTemplate` type — and counted ITS fields as
  // entries. The sabotage (empty the overlay) turned the fork's own suite red and left this test green.
  const own = registry.match(/export const OWN: Record<string, PageTemplate> = \{([^}]*)\}/);
  assert.ok(own, 'storefront-coffee/src/templates/cms/registry.ts no longer exports an `OWN` map.');
  const entries = own[1].split('\n').filter((l) => /^\s+[\w'-]+:/.test(l));
  assert.ok(
    entries.length > 0,
    'the coffee fork\'s store overlay declares NO template. The axis would be wired end to end and the café ' +
      'would still serve the reference vitrine\'s shoe-shop copy on every institutional page.',
  );
});
