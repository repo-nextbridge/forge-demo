// ★★ WHAT AN APP'S BLOCKS ACTUALLY ARE — READ OFF THE MANIFEST, NEVER RE-TYPED BESIDE IT (pk29/D1).
//
// ⛔ THE DEFECT THIS EXISTS FOR, MEASURED ON 2026-09-09. Moving ONE block between two apps — the sign-in mark
// leaving `demo-setup` for `chrome` — required editing FIVE hand-written lists in this repository:
// `WORD_KEYS`, `MANIFEST_SLOTS` and `CONFIG_KEYS` (seed/chrome.test.mjs), `DECLARED_LOGOS`
// (bin/chrome-logo-crop.guard.mjs) and a literal `4` for the size of a plan. Every one of them failed LOUD,
// which is the half that went right — but one of them failed as `TypeError: WORD_KEYS[block.component] is
// not iterable`, a sentence that does not name the block whose fields nobody declared.
//
// ⇒ FIVE EDITS FOR A MOVE THE MANIFEST ALREADY DESCRIBES IN FULL. The manifest is the app telling the kernel
// which blocks it ships, which surface each renders on and which config keys each accepts; the kernel
// VALIDATES against it (`composition.place` refuses a component the installed manifest does not know, and
// drops a config key `config_schema` does not declare). A second copy of that in a test file is a list that
// can disagree with the thing it is about — and it disagrees silently, in the direction of grading less.
//
// ── WHERE THE MANIFEST IS READ FROM, AND THE HONEST HALF ────────────────────────────────────────────────────
//
// Two kinds of app, two answers, and the second is the one worth stating:
//
//   · AN APP OF THIS BOX (`apps/<id>/manifest.ts`) is HERE. Always readable, no checkout, no skip.
//   · A PRODUCT APP (`extensions/<id>/manifest.ts`) is NOT here and is not vendored — pk28/D1 measured that
//     there is no copy of `chrome` in this repository, and there should not be: this box CONSUMES a pinned
//     image, it does not carry the product's source. So the manifest is read from the monorepo AT THE COMMIT
//     `forge.lock` pins, which is the commit the running image was baked from — the same manifest the kernel
//     is validating against on the box. A machine with no Forge clone gets `{ tried }` and the caller says
//     NOT CHECKED, loudly. ⚠️ It reads a BLOB and not a working tree (`fileAtPinned`), for the reason
//     measured there: on 09/09 no worktree on this machine sat at the pinned commit and `git show` answered
//     from the clone that had just been rejected.
//
// ── HOW IT IS PARSED, AND WHY THAT IS NOT A REGEX ───────────────────────────────────────────────────────────
//
// A manifest's `blocks` array is not a table of literals — `config_schema: FOOTER_AREAS` and
// `config_schema: [...MARK_FIELDS, { … }]` are both real today, and a pattern-matcher would read the first as
// the string "FOOTER_AREAS" and the second as one field. But the array IS JavaScript once the type
// annotations are stripped: every value in it is a literal, an identifier bound by a `const` above it, or a
// spread of one. So it is EVALUATED, with exactly the consts it references bound around it.
//
// ⛔ AND IT REFUSES A PARSE THAT FOUND NOTHING. A reader that returns an empty list on a manifest it did not
// understand is the vacuum every guard in this repository is written against: the rules downstream would all
// pass, over zero blocks. Every failure here throws with the app and the file named.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileAtPinned, pinnedCommit, ROOT } from './release-tree.mjs';

/** Where an app of THIS box declares itself. */
const localManifest = (id) => join(ROOT, 'apps', id, 'manifest.ts');
/** Where a PRODUCT app declares itself, inside the release. */
const releaseManifest = (id) => `extensions/${id}/manifest.ts`;

/**
 * The balanced bracketed region that starts at `from` (which must be the opening bracket), string- and
 * comment-aware — a `]` inside `'…'`, `"…"`, a template literal or a comment closes nothing.
 */
function balanced(src, from) {
  const open = src[from];
  const close = { '[': ']', '{': '}', '(': ')' }[open];
  if (!close) throw new Error(`balanced() called at ${JSON.stringify(open)}, which opens nothing`);
  let depth = 0;
  for (let i = from; i < src.length; i += 1) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      i = src.indexOf('\n', i);
      if (i < 0) break;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) break;
      i = end + 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      for (i += 1; i < src.length; i += 1) {
        if (src[i] === '\\') i += 1;
        else if (src[i] === c) break;
      }
      continue;
    }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return src.slice(from, i + 1);
    }
  }
  throw new Error('unbalanced brackets — the manifest is not the file this reader expects');
}

/** TypeScript that is not JavaScript, in the two spellings a manifest actually uses. */
const asJs = (src) => src.replace(/\s+as\s+const\b/g, '');

/** Every top-level `const NAME = …;` of a module, as source. Nothing is evaluated here. */
function topLevelConsts(src) {
  const out = new Map();
  for (const match of src.matchAll(/^const ([A-Za-z_$][\w$]*)(?:\s*:[^=]+)?\s*=\s*/gm)) {
    const from = match.index + match[0].length;
    // The initialiser is everything up to the `;` that closes it at depth zero. Taking the balanced region of
    // its first bracket is not enough: `['a'].flatMap(…)` starts with `[` and continues after the `]`.
    let depth = 0;
    let end = from;
    for (; end < src.length; end += 1) {
      const c = src[end];
      if (c === "'" || c === '"' || c === '`') {
        for (end += 1; end < src.length; end += 1) {
          if (src[end] === '\\') end += 1;
          else if (src[end] === c) break;
        }
        continue;
      }
      if ('[{('.includes(c)) depth += 1;
      else if (']})'.includes(c)) depth -= 1;
      else if (c === ';' && depth === 0) break;
    }
    out.set(match[1], src.slice(from, end));
  }
  return out;
}

/**
 * The array literal a pattern points at — the bracket the MATCH ends on, never `indexOf('[')` from there.
 *
 * ⚠️ MEASURED WHILE WRITING THIS: `SIBLING_SLOTS: readonly SiblingSlots[] = [` carries a `[]` in its TYPE, so
 * "the first bracket after the name" is the empty array of the annotation. The reader parsed it happily and
 * returned zero slot names — the exact silence the anti-vacuum below exists to refuse, arriving through the
 * search rather than through the source.
 */
function arrayAfter(src, pattern, complaint) {
  const match = src.match(pattern);
  if (!match) throw new Error(complaint());
  return balanced(src, match.index + match[0].length - 1);
}

/** The identifiers a fragment mentions — a superset, which is what a dependency walk wants. */
const mentions = (src) => new Set([...src.matchAll(/\b([A-Z][A-Z0-9_]*)\b/g)].map((m) => m[1]));

/**
 * One array of a manifest, evaluated — the half `parseBlocks` and `parseHooks` share.
 *
 * Only the consts the array really reaches are bound, transitively. Binding ALL of them would drag in the
 * ones built from imported symbols (`extensionManifestSchema`, the i18n catalogs) and throw on a manifest
 * this reader understands perfectly well.
 */
function evaluateArray(src, pattern, where, what, complaint) {
  const array = arrayAfter(src, pattern, complaint);
  const consts = topLevelConsts(src);
  const needed = [];
  const seen = new Set();
  const walk = (fragment) => {
    for (const name of mentions(fragment)) {
      if (seen.has(name) || !consts.has(name)) continue;
      seen.add(name);
      walk(consts.get(name));
      needed.push(`const ${name} = ${consts.get(name)};`);
    }
  };
  walk(array);

  try {
    // eslint-disable-next-line no-new-func -- the subject IS source at a pinned commit; see the header.
    return new Function(`"use strict";${needed.join('\n')}\nreturn ${array};`)();
  } catch (error) {
    throw new Error(`${where}: its \`${what}\` array could not be evaluated — ${error.message}`);
  }
}

/**
 * The app's blocks, evaluated. Each carries what the manifest declares and nothing this repository invented:
 * `{ component, label?, surface, area?, placement?, config_schema: [{ name, type, optional? }] }`.
 */
export function parseBlocks(source, where) {
  const src = asJs(source);
  const blocks = evaluateArray(
    src,
    /\bblocks:\s*\[/,
    where,
    'blocks',
    () => `${where} declares no \`blocks\` array — this reader is about an app that ships blocks`,
  );

  // ⛔ ANTI-VACUUM. A reader that quietly returns [] makes every rule downstream green over nothing.
  if (!Array.isArray(blocks) || blocks.length === 0) throw new Error(`${where} parsed to no blocks at all`);
  for (const block of blocks) {
    if (typeof block?.component !== 'string' || !block.component)
      throw new Error(`${where} has a block with no \`component\` — the parse is wrong, not the manifest`);
    // ⚠️ pk35/d7 — AN ABSENT `config_schema` IS DATA, NOT A FAILED PARSE, and this line said otherwise until
    // the first caller asked about an app that has one. The contract declares the field
    // `z.array(blockConfigFieldSchema).optional()` (packages/contracts/src/extensions.ts:215) and
    // `apps/payment-pos` really ships two blocks with no config at all — a block the operator drops and does
    // not fill in. Refusing that read a legal manifest as a broken reader, which is the opposite of what the
    // refusal below is for, and it was invisible for as long as nobody called `blocksOf('payment-pos')`. So
    // absence is normalised to `[]` — every consumer here walks `config_schema` and none of them wants a
    // branch — and what still throws is a schema this reader HALF understood: present, and not a list of
    // named fields.
    if (block.config_schema === undefined) block.config_schema = [];
    if (!Array.isArray(block.config_schema) || block.config_schema.some((f) => typeof f?.name !== 'string'))
      throw new Error(`${where}: block \`${block.component}\` has no readable \`config_schema\``);
  }
  return blocks;
}

/**
 * ★★ pk34/D3 — THE APP'S DECLARED DEFAULT PLACEMENTS: `hooks: [{ component, target }]`.
 *
 * `blocks` says which components the app ships; `hooks` says WHERE each one lands the moment somebody
 * installs the app. `extension.install` materialises one `hook_placement` row per scope for every entry here
 * (`seedDefaultPlacements`), so this array is the answer to "where is this block when nobody has dragged it".
 * It is the manifest's, never a seed's and never this repository's.
 */
export function parseHooks(source, where) {
  const hooks = evaluateArray(
    asJs(source),
    /\bhooks:\s*\[/,
    where,
    'hooks',
    () => `${where} declares no \`hooks\` array — an app that places nothing at install has \`hooks: []\``,
  );
  if (!Array.isArray(hooks)) throw new Error(`${where}: \`hooks\` did not parse to an array`);
  for (const hook of hooks) {
    // ⛔ NOT ANTI-VACUUM ON LENGTH, and the difference is the point: `hooks: []` is a REAL and common answer
    // (both apps this box writes declare it), so an empty list here is data. What must never be silent is a
    // list this reader half-understood — an entry missing either field means the parse is wrong.
    if (typeof hook?.component !== 'string' || typeof hook?.target !== 'string')
      throw new Error(
        `${where} has a hook without \`component\` and \`target\` — the parse is wrong, not the manifest`,
      );
  }
  return hooks;
}

/** One app's manifest source, from wherever that app's manifest lives — `{ text, where, from }` or `{ tried }`. */
function manifestSource(id) {
  const local = localManifest(id);
  if (existsSync(local))
    return { text: readFileSync(local, 'utf8'), where: `apps/${id}/manifest.ts`, from: `apps/${id}` };

  const pinned = pinnedCommit();
  if (!pinned)
    return { tried: ['forge.lock names registry digests, not a branch@sha — there is no commit to read from'] };
  const rel = releaseManifest(id);
  const found = fileAtPinned(pinned, rel);
  if (found.tried) return { tried: found.tried };
  return { text: found.text, where: `${rel} @ ${pinned.sha}`, from: found.from };
}

/**
 * The blocks of one app, from wherever that app's manifest lives.
 * `{ blocks, from }` when it was read, `{ tried }` when this machine cannot reach it.
 */
export function blocksOf(id) {
  const source = manifestSource(id);
  if (source.tried) return { tried: source.tried };
  return { blocks: parseBlocks(source.text, source.where), from: source.from };
}

/**
 * The default placements of one app, read the same way and from the same place.
 * `{ hooks, from }` when it was read, `{ tried }` when this machine cannot reach it.
 */
export function hooksOf(id) {
  const source = manifestSource(id);
  if (source.tried) return { tried: source.tried };
  return { hooks: parseHooks(source.text, source.where), from: source.from };
}

/** `component -> [config key, …]`, in the manifest's own order. */
export const configKeysOf = (blocks) =>
  Object.fromEntries(blocks.map((b) => [b.component, b.config_schema.map((f) => f.name)]));

/** `component -> [key, …]` for the fields that hold a WORD — `type: 'string'`. An `id` is an asset ref. */
export const wordKeysOf = (blocks) =>
  Object.fromEntries(
    blocks.map((b) => [b.component, b.config_schema.filter((f) => f.type === 'string').map((f) => f.name)]),
  );

/** The components that can carry a mark: their schema declares a `logo` (a `type:'id'` reference). */
export const logoComponentsOf = (blocks) =>
  blocks.filter((b) => b.config_schema.some((f) => f.name === 'logo')).map((b) => b.component);

/**
 * The components whose mark may be WORDS INSTEAD OF A PICTURE — a wordmark block, which the manifest says by
 * declaring `tail`: the terminação the theme paints with its accent. It is the field that distinguishes «this
 * block IS the mark» (logo or words, exclusive) from «this block WEARS the mark beside other content» (a bar,
 * where the picture and the words stand side by side and the picture is not optional).
 */
export const wordmarkComponentsOf = (blocks) =>
  blocks.filter((b) => b.config_schema.some((f) => f.name === 'tail')).map((b) => b.component);

// ── ★ WHERE A BLOCK IS ALLOWED TO LAND, WHICH IS A DIFFERENT DECLARATION FROM THE APP'S ────────────────────
//
// A manifest says which blocks an app ships and which SURFACE they render on; it does NOT say which slot of
// that surface a store puts one in — that is the instance's choice, written in `seed/*.json` and validated at
// place time. So the slot NAMES are the consumer deployable's own declaration, aggregated by codegen into
// `apps/storefront/src/lib/slots/generated/sibling-slots.ts` — the catalogue the admin's Composição reads.
//
// ⚠️ IT LIVES BEHIND THE SAME DOOR AS THE MANIFESTS AND THAT IS WHY IT IS IN THIS FILE. Both are read from
// the release at the pinned commit; two files asking "where is the release" is the drift `release-tree.mjs`
// was written to prevent.
const SLOT_CATALOGUE = 'apps/storefront/src/lib/slots/generated/sibling-slots.ts';

/** Every slot name the storefront surface publishes, at the pinned commit. `{ slots, from }` or `{ tried }`. */
export function surfaceSlots() {
  const pinned = pinnedCommit();
  if (!pinned) return { tried: ['forge.lock names registry digests, not a branch@sha'] };
  const found = fileAtPinned(pinned, SLOT_CATALOGUE);
  if (found.tried) return { tried: found.tried };
  const src = asJs(found.text);
  const array = arrayAfter(
    src,
    /\bSIBLING_SLOTS\b[^=]*=\s*\[/,
    () => `${SLOT_CATALOGUE} no longer exports SIBLING_SLOTS as an array`,
  );
  let consumers;
  try {
    // eslint-disable-next-line no-new-func -- generated source at a pinned commit; see the header.
    consumers = new Function(`"use strict";return ${array};`)();
  } catch (error) {
    throw new Error(`${SLOT_CATALOGUE}: could not be evaluated — ${error.message}`);
  }
  const slots = consumers.flatMap((c) => (c.slots ?? []).map((s) => s.name)).filter(Boolean);
  // ⛔ ANTI-VACUUM: an empty catalogue would make "this slot exists" true of every string.
  if (slots.length === 0) throw new Error(`${SLOT_CATALOGUE} parsed to no slot names at all`);
  return { slots, from: found.from };
}
