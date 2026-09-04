// The media decisions — `node --test 'seed/**/*.test.mjs'`.
//
// Both of these were wrong on this bench, in production, in a way nobody saw: the seed served a photograph
// that had been replaced on disk hours earlier and reported success. So every test below is a case that
// actually happened or the near-miss beside it.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { planRepoint, resolvePhoto, reuseKey, sha256 } from './media.mjs';

const SEED = dirname(fileURLToPath(import.meta.url));

const OLD = sha256(Buffer.from('the 1024x1536 frame'));
const NEW = sha256(Buffer.from('the 733x1266 re-cut'));
const index = () => new Map([['alvorada.png', new Map([[OLD, 'tenant_x/01old-alvorada.png']])]]);

// ── whether to upload at all ───────────────────────────────────────────────────────────────────────────

test('same name and same bytes → reuse the key, upload nothing (a re-run costs zero uploads)', () => {
  assert.equal(reuseKey(index(), 'alvorada.png', OLD), 'tenant_x/01old-alvorada.png');
});

test('★ same name, DIFFERENT bytes → no reuse: the re-cut photograph must reach the shop', () => {
  // ⚠️ THIS IS THE DEFECT. The file on disk changed (1024x1536 → 733x1266) and the seed did nothing,
  // because "does a product called alvorada exist?" answers yes forever. The shop served the old frame.
  assert.equal(reuseKey(index(), 'alvorada.png', NEW), null);
});

test('same bytes under a DIFFERENT name → no reuse: the name is half the identity', () => {
  assert.equal(reuseKey(index(), 'noturno.png', OLD), null);
});

test('a name the library has never seen → no reuse', () => {
  assert.equal(reuseKey(index(), 'brand-new.png', NEW), null);
  assert.equal(reuseKey(new Map(), 'alvorada.png', OLD), null);
});

// ── what to do about the product's reference ───────────────────────────────────────────────────────────

test('the product already points at the wanted key → NOTHING happens, no command is spent', () => {
  const plan = planRepoint([{ id: 'media_1', provider_key: 'k-new', kind: 'image' }], 'k-new');
  assert.deepEqual(plan, { attach: false, detach: [] });
});

test('★ the product points at the OLD key → attach the new one and detach the old', () => {
  const plan = planRepoint([{ id: 'media_1', provider_key: 'k-old', kind: 'image' }], 'k-new');
  assert.deepEqual(plan, { attach: true, detach: ['media_1'] });
});

test('a product with NO picture yet → attach, and there is nothing to detach', () => {
  assert.deepEqual(planRepoint([], 'k-new'), { attach: true, detach: [] });
});

test('several stale references are all detached — one attach, not one per stale row', () => {
  const plan = planRepoint(
    [
      { id: 'media_1', provider_key: 'k-old', kind: 'image' },
      { id: 'media_2', provider_key: 'k-older', kind: 'image' },
    ],
    'k-new',
  );
  assert.deepEqual(plan, { attach: true, detach: ['media_1', 'media_2'] });
});

test('a video reference is not an image and is left alone', () => {
  const plan = planRepoint(
    [
      { id: 'media_1', provider_key: 'k-old', kind: 'image' },
      { id: 'media_2', provider_key: 'https://youtu.be/x', kind: 'video_external' },
    ],
    'k-new',
  );
  assert.deepEqual(plan, { attach: true, detach: ['media_1'] });
});

test('★ the wanted key present ALONGSIDE a stale one: no second attach, but the stale one still goes', () => {
  // The interrupted window: a run that died between the attach and the detach leaves BOTH. Answering
  // "the wanted key is there, nothing to do" would leave the stale reference forever, behind a picture
  // that looks right — the same silence this whole slice exists to end.
  const plan = planRepoint(
    [
      { id: 'media_1', provider_key: 'k-new', kind: 'image' },
      { id: 'media_2', provider_key: 'k-old', kind: 'image' },
    ],
    'k-new',
  );
  assert.deepEqual(plan, { attach: false, detach: ['media_2'] });
});

// ── ★★ A18 · THE STORY FRAMES ARE REAL FILES NOW, AND THE STAND-INS ARE RETIRED ────────────────────────
//
// ⚠️ WHY THIS BLOCK EXISTS AT ALL, AND IT IS THE VACUUM PROBLEM. The placeholder suite already had a test
// reading «every story stand-in the dataset NEEDS is on disk» — and it derives what is needed from what
// `seed/photos/` holds, so the moment the eighteen real photographs landed it started asserting nothing and
// stayed green. A guard whose subject disappeared is a guard that reports on an empty set. So the assertion
// moves to the other side: what the dataset declares must resolve to a REAL file, and no coffee may still be
// served by a stand-in.

test('★★★ every photograph the six coffees declare is a REAL file, never a stand-in', () => {
  const catalog = JSON.parse(readFileSync(join(SEED, 'catalog.json'), 'utf8'));
  const have = {
    photos: new Set(readdirSync(join(SEED, 'photos'))),
    placeholders: new Set(readdirSync(join(SEED, 'placeholder-media'))),
  };
  const products = catalog.products ?? [];
  assert.equal(products.length, 6, 'the coffee catalogue is no longer six coffees');
  for (const product of products) {
    const declared = product.photos ?? [];
    assert.equal(declared.length, 4, `"${product.handle}" declares ${declared.length} photographs, not 4`);
    for (const file of declared) {
      const found = resolvePhoto(file, have);
      assert.ok(found, `"${file}" resolves to nothing at all — the seed would die naming both files`);
      assert.equal(
        found.placeholder,
        false,
        `"${file}" still resolves to a stand-in. The merchant delivered the eighteen story frames on ` +
          '2026-09-04; a coffee still wearing a grey rectangle means a name was translated wrong.',
      );
    }
  }
});

test('★★ the eighteen story frames carry the dimensions the grid was designed against', () => {
  // A file in the wrong ratio does not fail anything — the page CROPS — so it is the class of mistake that
  // ships. `historia-1` spans both columns at 4:3 and the two squares are 1:1; the delivered art is 1216x912
  // and 816x816, i.e. the same ratios, larger. Reducing preserves sharpness; enlarging does not.
  const wantRatio = { 'historia-1': 4 / 3, 'historia-2': 1, 'historia-3': 1 };
  const catalog = JSON.parse(readFileSync(join(SEED, 'catalog.json'), 'utf8'));
  let checked = 0;
  for (const product of catalog.products ?? []) {
    for (const file of product.photos ?? []) {
      const shot = Object.keys(wantRatio).find((s) => file.includes(`-${s}.`));
      if (!shot) continue;
      const { width, height } = pngSize(join(SEED, 'photos', file));
      assert.ok(
        Math.abs(width / height - wantRatio[shot]) < 0.01,
        `${file} is ${width}x${height} — the ${shot} slot is drawn at ${wantRatio[shot].toFixed(3)}:1, so ` +
          'this one is cropped rather than fitted.',
      );
      checked += 1;
    }
  }
  assert.equal(checked, 18, `expected to measure 18 story frames, measured ${checked}`);
});

/** A PNG's declared size, straight off the IHDR — no decoder, no dependency: this repository has neither. */
function pngSize(path) {
  const head = readFileSync(path).subarray(0, 33);
  assert.equal(head.subarray(1, 4).toString('latin1'), 'PNG', `${path} is not a PNG`);
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}
