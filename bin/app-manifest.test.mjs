// ★★ THE READER THAT REPLACED FIVE HAND-TYPED LISTS — and the only thing that can grade it is a manifest
// whose answer is known independently.
//
// `bin/app-manifest.mjs` exists because moving one block between two apps cost five edits in this repository
// (pk29/D1; the file's header carries the measurement). Everything downstream now believes what it returns,
// so the two failures that matter are:
//
//   · IT READS THE IDENTIFIER INSTEAD OF THE FIELDS. `config_schema: FOOTER_AREAS` is not a table of
//     literals, and a pattern-matcher would answer "one field, called FOOTER_AREAS". Every rule downstream
//     would then be green over a schema of one invented key.
//   · IT ANSWERS EMPTY. A parse that understood nothing and said so with `[]` is the vacuum this house names
//     first: the rules pass, over zero blocks, and the file that used to be a list is now a silence.
//
// The fixtures below are manifests written HERE, so the expected answer is a fact of this file rather than of
// somebody else's repository — and the last rules drive the same reader over the two REAL manifests, which is
// the half a fixture cannot prove.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  blocksOf,
  configKeysOf,
  logoComponentsOf,
  parseBlocks,
  surfaceSlots,
  wordKeysOf,
  wordmarkComponentsOf,
} from './app-manifest.mjs';

/** A manifest with every shape the two real ones use: a computed schema, a spread, an `as const`, comments
 *  with brackets in them, and a const the blocks never mention. */
const FIXTURE = `
import { type ExtensionManifest, extensionManifestSchema } from '@forgecommerce/contracts';

const AREAS = ['start', 'end'].flatMap((area) => [
  { name: \`\${area}_text\`, type: 'string' as const, optional: true },
  { name: \`\${area}_image\`, type: 'id' as const, optional: true },
]);

const MARK_FIELDS = [
  { name: 'logo', type: 'id' as const, optional: true },
  { name: 'text', type: 'string' as const, optional: true },
  { name: 'tail', type: 'string' as const, optional: true },
];

// ⛔ This one is built from an imported symbol and the blocks never mention it. Binding it would throw.
const COPY = extensionManifestSchema.describe({ en: 'a]b' });

export const manifest: ExtensionManifest = extensionManifestSchema.parse({
  id: 'fixture',
  contact: {
    hooks: [],
    blocks: [
      {
        // a comment with a ] and a ' in it
        component: 'a_footer',
        surface: 'storefront',
        area: 'a',
        config_schema: AREAS,
      },
      {
        component: 'a_brand',
        surface: 'storefront',
        area: 'a',
        config_schema: [...MARK_FIELDS, { name: 'tagline', type: 'string' as const, optional: true }],
      },
    ],
  },
});
`;

test('★★★ a COMPUTED schema is evaluated, never read as the name of the identifier', () => {
  // ⇒ SABOTAGE: make `parseBlocks` pattern-match instead of evaluate and this reports
  //   `{ a_footer: ['AREAS'] }` — one field, named after a variable, which no kernel would ever validate.
  const blocks = parseBlocks(FIXTURE, 'fixture');
  assert.deepEqual(configKeysOf(blocks), {
    a_footer: ['start_text', 'start_image', 'end_text', 'end_image'],
    a_brand: ['logo', 'text', 'tail', 'tagline'],
  });
});

test('★★ a SPREAD keeps both halves — the shared fields and the one this block adds', () => {
  const blocks = parseBlocks(FIXTURE, 'fixture');
  const brand = blocks.find((b) => b.component === 'a_brand');
  assert.equal(brand.config_schema.length, 4);
  assert.equal(brand.config_schema.at(-1).name, 'tagline');
});

test('★ a word is `type: string`; an asset reference is not a word', () => {
  const blocks = parseBlocks(FIXTURE, 'fixture');
  assert.deepEqual(wordKeysOf(blocks), {
    a_footer: ['start_text', 'end_text'],
    a_brand: ['text', 'tail', 'tagline'],
  });
  assert.deepEqual(logoComponentsOf(blocks), ['a_brand']);
  assert.deepEqual(wordmarkComponentsOf(blocks), ['a_brand']);
});

test('⛔ a manifest this reader did not understand THROWS — it never answers an empty list', () => {
  // ⛔ THE VACUUM, named. Every rule downstream loops over what this returns.
  assert.throws(() => parseBlocks('export const manifest = { id: "x" };', 'nothing.ts'), /declares no `blocks`/);
  assert.throws(
    () => parseBlocks('const manifest = { blocks: [] };', 'empty.ts'),
    /parsed to no blocks at all/,
  );
  assert.throws(
    () => parseBlocks("const manifest = { blocks: [{ component: 'a' }] };", 'schemaless.ts'),
    /has no readable `config_schema`/,
  );
  assert.throws(
    () => parseBlocks("const manifest = { blocks: [{ surface: 's', config_schema: [] }] };", 'nameless.ts'),
    /block with no `component`/,
  );
});

test('⛔ a block whose schema is an identifier NOTHING declares fails loudly, never as an empty schema', () => {
  assert.throws(
    () => parseBlocks("const manifest = { blocks: [{ component: 'a', config_schema: MISSING }] };", 'dangling.ts'),
    /could not be evaluated/,
  );
});

// ── the two real manifests, which is what a fixture cannot prove ─────────────────────────────────────────

test('★★ `demo-setup` is an app of THIS box, so its manifest is read with no checkout and no skip', () => {
  const found = blocksOf('demo-setup');
  assert.ok(found.blocks, `apps/demo-setup/manifest.ts is here and was not read: ${found.tried?.join(' · ')}`);
  assert.equal(found.from, 'apps/demo-setup');
  assert.ok(found.blocks.length >= 3, 'this app ships one mark per place; fewer than three is a parse, not a move');
});

test('★★ `chrome` is a PRODUCT app: read at the commit the running image was baked from, or NOT CHECKED', (t) => {
  const found = blocksOf('chrome');
  if (found.tried) {
    // ⛔ NEVER A SILENT PASS. This repository does not vendor the product (pk28/D1 measured that there is no
    // copy of `chrome` here), so a machine with no Forge clone genuinely cannot answer — and has to say so.
    t.skip(`NOT CHECKED — no Forge clone holds the pinned manifest: ${found.tried.join(' · ')}`);
    return;
  }
  const keys = configKeysOf(found.blocks);
  assert.ok(
    keys.checkout_header?.includes('logo'),
    `the pinned chrome manifest parsed to ${JSON.stringify(keys)} — that is not this app`,
  );
  assert.deepEqual(
    logoComponentsOf(found.blocks).sort(),
    ['account_brand', 'account_header', 'checkout_header'],
    'the components that can carry a mark are the two funnel bars and the sign-in mark',
  );
});

test('⛔ an array named through a TYPE that carries `[]` is not read as the type\'s empty brackets', () => {
  // ⚠️ THIS HAPPENED, while writing the reader: the slot catalogue is declared
  // `SIBLING_SLOTS: readonly SiblingSlots[] = [ … ]`, and "the first bracket after the name" is the `[]` of
  // the annotation. It parsed, it returned ZERO slots, and every "this slot exists" would have been true of
  // any string. The fixture reproduces the shape on the blocks array, where the same reader is used.
  const blocks = parseBlocks(
    "const manifest: Thing[] = { blocks: [{ component: 'a', surface: 's', config_schema: [{ name: 'k', type: 'string' }] }] };",
    'typed.ts',
  );
  assert.deepEqual(configKeysOf(blocks), { a: ['k'] });
});

test('★★ the surface publishes the slots this box places chrome into, or NOT CHECKED', (t) => {
  const found = surfaceSlots();
  if (found.tried) {
    t.skip(`NOT CHECKED — no Forge clone holds the pinned slot catalogue: ${found.tried.join(' · ')}`);
    return;
  }
  // ⛔ ANTI-VACUUM, spelled where a reader can see it: a catalogue that came back short makes "the slot this
  // declaration names exists" a claim about nothing.
  for (const slot of ['checkout.header', 'checkout.footer', 'account.header', 'account.footer', 'account.brand'])
    assert.ok(found.slots.includes(slot), `the storefront surface no longer publishes \`${slot}\``);
});
