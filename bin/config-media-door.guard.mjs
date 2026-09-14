// ★★★ A BLOCK OF THIS BOX THAT HOLDS `<field>_provider_key` MAY NOT PAINT `<field>_url` — the SPECIES.
//
//   node --test bin/config-media-door.guard.mjs        (or: bash bin/test.sh)
//
// ── WHAT THE KERNEL STAMPS, AND WHY THERE ARE THREE OF THEM ──────────────────────────────────────────────
//
// `packages/core/src/read/media.ts` (`resolveConfigMedia`) walks a block's `config_schema` and, for every
// `type:'id'` field, writes THREE sidecars next to the stored ref: `<field>_url` (the MASTER's public
// address, minted from the origin the KERNEL was configured with), `<field>_kind`, and
// `<field>_provider_key` — the opaque catalog key, stamped, in that file's own words, "so a consumer can
// route the MASTER through its own `/api/media/<key>` door for next/image derivatives + a 1-year cache,
// instead of pointing an `<img>` at the raw bucket url".
//
// ⚠️ SO THE KEY IS NOT AN ALTERNATIVE TO THE URL. It is the kernel saying, per field, «there is a door for
// this one». A render that reads the url and leaves the key untouched walks past a door the kernel opened
// for it, and nothing anywhere goes red.
//
// ── WHY THIS IS A GUARD AND NOT A FIFTH REPAIR ───────────────────────────────────────────────────────────
//
// It has been repaired FOUR times, one block at a time, and no repair found the next one's sibling:
//   · D2-F3     routed the `banners` block through the derivative door;
//   · K3-M2     routed the theme's own images through it (2026-09-02);
//   · pk34/p5   routed the shelf's promo banner through it (2026-09-13), two weeks later, same cause;
//   · pk35/p2   routed the whole `chrome` app through it — 5 blocks, 9 declared media fields — the next day,
//               and STOPPED AT THIS REPOSITORY'S FENCE: `demo-setup` is an app of this box, so the product's
//               guard cannot see it, and this file is the half that lives on this side.
//
// WHAT IT COSTS WHEN A BLOCK GETS IT WRONG, measured on `forge-preseed` 2026-09-13, the same object both
// ways: the master answers 200 with NO `Cache-Control` at all; `/api/media/<key>` answers 200
// `public, max-age=31536000, immutable`. And `/v1/media/` is on no door the warmer knows (pk34/d2 taught the
// warmer to NAME them: «our OWN addresses the warmer has no door for»), so such an image stays COLD through
// every warm run — the first shopper of every page pays for it, forever. A raw absolute url is also the
// mixed-content hazard K3-M2 photographed on this same bench: a path has no origin to be wrong about, an
// absolute url minted by another process does.
//
// ── THE RULE, DERIVED ────────────────────────────────────────────────────────────────────────────────────
//
// Jurisdiction: every app under `apps/` that declares `forge.origin: "instance"` — the value the OVEN reads
// to adopt it (bin/build-local.sh) — whose MANIFEST declares at least one `type:'id'` field in a block's
// `config_schema`. An app joining this box joins this guard on the same edit, and the fields come off the
// manifest by the same walk `resolveConfigMedia` makes when it stamps. ⛔ Never a list of blocks written
// here: a typed list is exactly what rotted through four repairs.
//
// The rule: in a shipped source of such an app, forming the name `<field>_url` obliges forming
// `<field>_provider_key` in the SAME file. The key has to be in the hand that holds the url; a key read in
// another module is a key this render cannot reach.
//
// ⚠️ TWO SHAPES, because a name can be built two ways and a per-field scan sees only one of them:
//   · written out whole   `config.logo_url`, `bag['logo_url']`, a `logo_url?: string` signature;
//   · composed            `` config[`${name}_url`] `` — the string `logo_url` never appears in the source at
//     all, which is exactly how `apps/demo-setup/block/marks.tsx` held this defect in plain sight.
// For the composed shape the rule pairs SUFFIXES: a helper that builds one sidecar name must build the other.
//
// ⚠️ AND IT READS CODE, NOT THE PROSE THAT EXPLAINS IT. This repository comments heavily and the header you
// are reading names `_url` a dozen times; a grep would flag this very file and the usual repair is to weaken
// the pattern until it stops seeing the real thing too. Comments are blanked before anything is matched, and
// the last test feeds the scanner a file whose only `_url` is a sentence and demands it come back clean.
//
// ⚠️ WHY COMMENTS ARE BLANKED RATHER THAN THE SOURCE PARSED. The product's twin
// (`scripts/composition/config-media-door.guard.test.ts`) walks a TypeScript AST; there is no TypeScript
// here to import — this repository has no package manager, it is a box's configuration (see bin/test.sh) —
// and a guard that only runs where a Forge checkout is lying around is a guard that skips on the machine
// that matters. Blanking comments is string- and template-aware, it is the same technique
// `bin/app-manifest.mjs` already uses to read a manifest, and the fixtures below prove both what it SEES and
// what it must not.
//
// WHAT IT DOES NOT COVER, said out loud: whether a file that mentions the key actually RENDERS it. That is
// the behavioural half and it lives where a block can be rendered — `apps/demo-setup/block/marks.test.tsx`,
// which draws all three marks and refuses an absolute address. This file's job is that no NEW block of this
// box can be born without one.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { blocksOf } from './app-manifest.mjs';
import { APPS_DIR, INSTANCE_ORIGIN } from './instance-apps.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The suffixes the kernel stamps beside a `type:'id'` config field — the two that matter to a render. */
const URL_SUFFIX = '_url';
const KEY_SUFFIX = '_provider_key';

/** Build output and vendored trees: a copy of a file is never the file. */
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'coverage', 'out']);
/** A test builds deliberately degenerate configs — a url with NO key is a case it has to cover — so the rule
 *  is over what SHIPS. Everything else under the app is in, including a file nobody has staged yet. */
const IS_TEST = /\.test\.tsx?$/;

// ── the family, derived from the manifests ───────────────────────────────────────────────────────────────

/** Every directory under `apps/` that declares itself an app of THIS box. Read from the filesystem and from
 *  each package's own declaration, never from a list here. */
function instanceAppIds() {
  const out = [];
  for (const entry of readdirSync(APPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(join(APPS_DIR, entry.name, 'package.json'), 'utf8'));
    } catch {
      continue;
    }
    if (manifest.forge?.origin === INSTANCE_ORIGIN) out.push(entry.name);
  }
  return out.sort();
}

/**
 * Every `type:'id'` config field of every block of every app of this box — top level AND inside the `list`
 * composite, which is the same walk `collectConfigAssetIds` makes on the kernel's side.
 *
 * `blocksOf` reads `apps/<id>/manifest.ts` and EVALUATES the array rather than pattern-matching it, so a
 * schema assembled from a `const` (`[...MARK_FIELDS, { … }]`, which is what all three of this box's blocks
 * are) is read as what it IS. A parser that matched literals would absolve exactly those.
 */
function mediaConfigFields() {
  const out = [];
  for (const app of instanceAppIds()) {
    const read = blocksOf(app);
    assert.ok(read.blocks, `apps/${app}/manifest.ts could not be read: ${(read.tried ?? []).join('; ')}`);
    for (const block of read.blocks) {
      const push = (field) => out.push({ app, block: block.component, field });
      for (const field of block.config_schema ?? []) {
        if (field.type === 'id') push(field.name);
        if (field.type === 'list' && Array.isArray(field.item))
          for (const item of field.item) if (item.type === 'id') push(item.name);
      }
    }
  }
  return out;
}

// ── the scanner ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * The source with every COMMENT blanked out and every string left alone.
 *
 * Strings, template literals and their `${…}` are kept because a sidecar name is frequently BUILT in one; a
 * comment is deleted because prose about `logo_url` is not a render of it. `//` and `/*` can never open a
 * regular expression (an empty regex is a syntax error and `*` is a quantifier with nothing to repeat), so
 * the two cases do not overlap.
 */
export function codeOnly(source) {
  let out = '';
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    if (c === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      if (end < 0) return out;
      out += '\n';
      i = end;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) return out;
      // Keep the newlines so a reported line number still means something.
      out += source.slice(i, end + 2).replace(/[^\n]/g, ' ');
      i = end + 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      out += c;
      for (i += 1; i < source.length; i += 1) {
        out += source[i];
        if (source[i] === '\\') {
          i += 1;
          out += source[i] ?? '';
        } else if (source[i] === c) break;
      }
      continue;
    }
    out += c;
  }
  return out;
}

/** The sidecar names a source FORMS, in the two shapes a name can be built in. */
export function formedNames(source) {
  const code = codeOnly(source);
  const named = (suffix) =>
    new Set([...code.matchAll(new RegExp(`\\b([A-Za-z_$][\\w$]*)${suffix}\\b`, 'g'))].map((m) => m[1]));
  return {
    url: named(URL_SUFFIX),
    key: named(KEY_SUFFIX),
    // `` `${name}_url` `` survives comment-blanking as `}_url`: the field is unknowable here, which is
    // precisely why this shape pairs SUFFIXES instead of fields.
    composesUrl: new RegExp(`\\}${URL_SUFFIX}\\b`).test(code),
    composesKey: new RegExp(`\\}${KEY_SUFFIX}\\b`).test(code),
  };
}

/** The offences of ONE file, given the media fields its app declares. Two shapes, one rule. */
export function offencesIn(file, formed, fields) {
  const out = [];
  for (const { app, block, field } of fields) {
    if (!formed.url.has(field)) continue;
    if (formed.key.has(field)) continue;
    out.push(`${file} forms \`${field}${URL_SUFFIX}\` (${app} · block \`${block}\`) and never \`${field}${KEY_SUFFIX}\``);
  }
  if (formed.composesUrl && !formed.composesKey) {
    // ⚠️ THE FIELD IS UNKNOWABLE IN THIS SHAPE — that is the whole reason it pairs suffixes — so the message
    // names every field this app declares, which is exactly the set a composing helper is called with. A
    // refusal that named only the file would send whoever reads it looking for a string that is not there.
    const at = fields.map(({ app, block, field }) => `${app} · ${block} · \`${field}\``).join(', ');
    out.push(
      `${file} composes \`\${…}${URL_SUFFIX}\` and never \`\${…}${KEY_SUFFIX}\` — the helper that builds one ` +
        `sidecar name has to build the other. The field(s) it is called with: ${at}`,
    );
  }
  return out;
}

/** Every TS/TSX source under an app that SHIPS, walked from the filesystem rather than from `git ls-files`:
 *  a guard that lists tracked files is blind to the file somebody just wrote, which is the exact moment a
 *  new call site appears. */
function shippedSources(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) shippedSources(join(dir, entry.name), acc);
    } else if (/\.tsx?$/.test(entry.name) && !IS_TEST.test(entry.name)) {
      acc.push(join(dir, entry.name));
    }
  }
  return acc;
}

const FIELDS = mediaConfigFields();
const BY_APP = new Map();
for (const field of FIELDS) BY_APP.set(field.app, [...(BY_APP.get(field.app) ?? []), field]);

// ── the rules ────────────────────────────────────────────────────────────────────────────────────────────

test('★★★ THE RULE — a block that holds the catalog key may not paint the master url', () => {
  const offences = [];
  for (const [app, appFields] of BY_APP) {
    for (const file of shippedSources(join(APPS_DIR, app))) {
      offences.push(...offencesIn(relative(ROOT, file), formedNames(readFileSync(file, 'utf8')), appFields));
    }
  }
  assert.deepEqual(
    offences,
    [],
    'a block of this box read the MASTER address the kernel minted and left the catalog key it stamped ' +
      "beside it untouched. The key is what routes the image through the front's own door " +
      '(`/api/media/<key>` via `mediaRenderSrc`): a same-origin path, a 1-year immutable cache, and an ' +
      'address the warmer can reach. The master has none of the three, and on this bench it answers with no ' +
      `\`Cache-Control\` header at all.\n  ${offences.join('\n  ')}`,
  );
});

test('★★ ANTI-VACUUM · there is a family to grade, and the scanner SEES it', () => {
  // ⛔ A guard whose subject list is empty passes in silence, which is how this species survived four
  // repairs. Two halves: the manifests declare media fields at all, and every app that declares one has a
  // shipped source that really forms the sidecar — otherwise the rule above is green over nothing.
  assert.ok(
    FIELDS.length > 0,
    "no block of any app of this box declares a `type:'id'` config field any more. Either the apps stopped " +
      'carrying pictures — in which case this guard has no subject and should be deleted deliberately — or ' +
      '`blocksOf()` stopped reading a manifest shape and this file just went blind.',
  );
  const blind = [];
  for (const [app, appFields] of BY_APP) {
    const sees = shippedSources(join(APPS_DIR, app)).some((file) => {
      const formed = formedNames(readFileSync(file, 'utf8'));
      return formed.composesUrl || appFields.some(({ field }) => formed.url.has(field));
    });
    if (!sees) blind.push(`${app} (${[...new Set(appFields.map((f) => f.field))].join(', ')})`);
  }
  assert.deepEqual(
    blind,
    [],
    'these apps declare a media config field and NO shipped source of theirs ever forms its `_url` sidecar. ' +
      'Either the block ignores what the kernel stamped for it, or this scanner stopped seeing a shape the ' +
      'repository now uses — and the second reading is why the rule above cannot be trusted until somebody ' +
      `looks: ${blind.join(' · ')}`,
  );
});

test('★★ ANTI-VACUUM · the scanner goes RED on a block written the wrong way, in BOTH shapes', () => {
  const fields = [{ app: 'demo-x', block: 'mark', field: 'logo' }];

  // (1) written out whole — the shape `banners` and `content` use.
  const whole = formedNames('export const src = (c: Record<string, unknown>) => c.logo_url as string;');
  assert.equal(offencesIn('whole.ts', whole, fields).length, 1);
  assert.match(offencesIn('whole.ts', whole, fields)[0], /logo_url/);
  assert.match(offencesIn('whole.ts', whole, fields)[0], /block `mark`/);

  // (2) composed around a variable — the shape `chrome`, `shelves` AND `apps/demo-setup/block/marks.tsx`
  // use, and the one a per-field list of names cannot see at all: the string `logo_url` never appears.
  const composed = formedNames('export const src = (c, n: string) => c[`${n}_url`] as string;');
  assert.equal(offencesIn('composed.ts', composed, fields).length, 1);
  assert.match(offencesIn('composed.ts', composed, fields)[0], /_provider_key/);

  // (3) the same two with the key in hand — GREEN, so the rule is a rule and not a ban on `_url`.
  for (const source of [
    'export const src = (c) => [c.logo_url, c.logo_provider_key];',
    'export const src = (c, n: string) => [c[`${n}_url`], c[`${n}_provider_key`]];',
  ])
    assert.deepEqual(offencesIn('fixed.ts', formedNames(source), fields), []);
});

test('★★ ANTI-VACUUM · the scanner reads CODE, never the prose that explains it', () => {
  const fields = [{ app: 'demo-x', block: 'mark', field: 'logo' }];
  // A file whose only `logo_url` is a sentence ABOUT `logo_url` — this repository is full of them, the
  // header of this very file included. A grep flags it, and the usual repair weakens the pattern until it
  // stops seeing the real thing too.
  const prose = formedNames(
    [
      '// The kernel stamps `logo_url` beside the ref, and this block deliberately renders neither.',
      '/* logo_url, logo_kind — see packages/core/src/read/media.ts. And `${x}_url`, composed. */',
      'export const nothing = 1;',
    ].join('\n'),
  );
  assert.deepEqual(offencesIn('prose.ts', prose, fields), []);

  // …and it does NOT read a comment as cover for the code beneath it: the same file with one real call site
  // is red again, which is what stops "blank the comments" from becoming "blank the file".
  const covered = formedNames(
    ['// nothing to see: logo_url, logo_provider_key, all accounted for', 'export const s = (c) => c.logo_url;'].join('\n'),
  );
  assert.equal(offencesIn('covered.ts', covered, fields).length, 1);
});

test('★ it reports the honest size of the family, so nobody has to guess what "the species" covers', () => {
  // ⛔ NÃO INFLE NÚMERO. Today: one app, three blocks, one field name. Said out loud rather than implied by
  // a rule that sounds fleet-wide.
  const apps = new Set(FIELDS.map((f) => f.app));
  const blocks = new Set(FIELDS.map((f) => `${f.app}/${f.block}`));
  console.error(
    `[config-media-door] ${FIELDS.length} declared media field(s) — ${blocks.size} block(s) in ` +
      `${apps.size} app(s) of this box: ${[...blocks].join(', ')}`,
  );
  for (const app of apps) assert.ok(statSync(join(APPS_DIR, app)).isDirectory());
});
