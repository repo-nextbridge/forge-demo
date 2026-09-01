// The media decisions — `node --test 'seed/**/*.test.mjs'`.
//
// Both of these were wrong on this bench, in production, in a way nobody saw: the seed served a photograph
// that had been replaced on disk hours earlier and reported success. So every test below is a case that
// actually happened or the near-miss beside it.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planRepoint, reuseKey, sha256 } from './media.mjs';

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
