// @vitest-environment node
//
// E4-ALPHA — the derivative door must never flatten transparency, on ANY lane, for ANY master the kernel lets
// someone upload. This is the test that pins it, and it asserts the PIXEL.
//
// WHY NOT THE CONTENT TYPE. Asserting "the output is webp" stays green with the alpha dead: webp and avif both
// support transparency AND both support being written without it. The only thing that catches the defect is
// decoding the bytes the route returned and reading the alpha channel of a pixel that went in transparent.
//
// WHY THIS TEST DRIVES THE REAL NEXT OPTIMIZER (and imports two internals to do it). Our route makes no pixels:
// it picks an `Accept`, calls `/_next/image` on the loopback and streams the answer back. So every byte that
// could lose alpha is made by `next/dist/server/image-optimizer` — Next's code, over sharp. A test that mocks
// the optimizer would only ever prove that our mock preserves alpha. Booting a real `next start` inside the
// suite would be honest too, and far more expensive; the seam below is the cheap half of the same proof: the
// route's own `GET` runs, and the `fetch` it makes is answered by Next's REAL negotiation + REAL transform,
// configured from the REAL `next.config.mjs`.
//
// ⚠️ WHEN THIS IMPORT BREAKS, DO NOT "FIX" IT BY DELETING IT. `next/dist/server/image-optimizer` is a private
// path: a Next upgrade may move it, rename `imageOptimizer`/`ImageOptimizerCache`, or change their signatures.
// That red is the SIGNAL this test exists to give — the thing it pins has moved. Re-read the new optimizer
// (specifically: what it does when the negotiated mime is empty and the upstream is webp/avif — that fall-
// through to JPEG is the defect this file was written for), confirm the lanes still preserve alpha, and only
// then re-point the import. Replacing it with a stub deletes the proof and keeps the green.

import { createRequire } from 'node:module';
import { expect, test } from 'vitest';
import { acceptFor, MASTER_EXTENSIONS } from '@/lib/derivative-accept';
import { GET } from './[...spec]/route';

const require_ = createRequire(import.meta.url);

/** The slice of sharp's surface this test drives, declared structurally on purpose: the decoder comes from the
 * optimizer itself (`getSharp()`), so the storefront gains no `sharp` dependency just to read a pixel — and the
 * library that decodes our assertions is by construction the same one that encoded the bytes. */
type SharpImage = {
  png: () => SharpImage;
  webp: () => SharpImage;
  avif: () => SharpImage;
  gif: () => SharpImage;
  jpeg: () => SharpImage;
  ensureAlpha: () => SharpImage;
  raw: () => SharpImage;
  metadata: () => Promise<{ format: string }>;
  toBuffer: {
    (): Promise<Buffer>;
    (options: {
      resolveWithObject: true;
    }): Promise<{
      data: Buffer;
      info: { width: number; channels: number };
    }>;
  };
};
type SharpFactory = (
  input: Buffer | Uint8Array,
  options?: { raw: { width: number; height: number; channels: number } },
) => SharpImage;

type OptimizerModule = {
  getSharp: () => SharpFactory;
  imageOptimizer: (
    upstream: { buffer: Buffer; contentType: string; cacheControl: string | null; etag: string },
    params: { href: string; quality: number; width: number; mimeType: string },
    nextConfig: unknown,
    opts: { isDev: boolean; silent: boolean },
  ) => Promise<{ buffer: Buffer; contentType: string }>;
  ImageOptimizerCache: {
    validateParams: (
      req: { headers: Record<string, string> },
      query: Record<string, string>,
      nextConfig: unknown,
      isDev: boolean,
    ) => { errorMessage?: string; href: string; quality: number; width: number; mimeType: string };
  };
};

function loadOptimizer(): {
  optimizer: OptimizerModule;
  imageConfigDefault: Record<string, unknown>;
} {
  try {
    return {
      optimizer: require_('next/dist/server/image-optimizer') as OptimizerModule,
      imageConfigDefault: (
        require_('next/dist/shared/lib/image-config') as {
          imageConfigDefault: Record<string, unknown>;
        }
      ).imageConfigDefault,
    };
  } catch (cause) {
    throw new Error(
      'E4-ALPHA: this test pins the behaviour of the NEXT IMAGE OPTIMIZER, which is what actually encodes ' +
        'every derivative this route serves — so it imports it directly. That import just failed, which ' +
        'means Next moved it, not that the test is wrong. Read the header of this file before touching the ' +
        'import: re-read the new optimizer (does an empty negotiated mime over a webp/avif upstream still ' +
        'fall through to JPEG?), then re-point it. Do NOT replace it with a stub — that deletes the proof.',
      { cause },
    );
  }
}

const { optimizer, imageConfigDefault } = loadOptimizer();
const sharp = optimizer.getSharp();

/** The optimizer's config, read from the REAL next.config.mjs — `images.formats` is the only thing the lane's
 * `Accept` is ever matched against, so a test that hardcoded it would be grading its own copy. */
const userConfig = (await import('../../../../next.config.mjs')).default as {
  images?: Record<string, unknown>;
};
const nextConfig = {
  images: { ...imageConfigDefault, ...(userConfig.images ?? {}) },
  experimental: {},
};

// ── the fixture, and the proof that the fixture is worth anything ──────────────────────────────────────────

/** A ladder width equal to the fixture's own size, so the optimizer's resize is a no-op and the pixel we assert
 * on is the pixel we authored — never a resampled neighbour. */
const SIZE = 256;
/** Alpha is stored in its own plane in every format here, so a transparent pixel round-trips at exactly 0 and an
 * opaque one at exactly 255 (measured). The tolerance is there so a codec revision that dithers by a step does
 * not turn this into a flake — it is nowhere near wide enough to let alpha 255 pass as transparent. */
const TOLERANCE = 2;

/** The canonical extension the kernel mints → the encoder + mime that master is. Derived from the kernel's own
 * allow-list (guarded in `derivative-accept.guard.test.ts`), so a format the kernel starts accepting lands in
 * this matrix instead of becoming an unproven sixth path — and lands LOUDLY, because it has no encoder here. */
const ENCODER: Record<string, 'png' | 'webp' | 'avif' | 'gif' | 'jpeg'> = {
  jpg: 'jpeg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  avif: 'avif',
};

/** Top half fully transparent, bottom half opaque red. Two halves, not one flat fill: a test on an all-
 * transparent image cannot tell "alpha preserved" from "everything became transparent". */
async function master(format: 'png' | 'webp' | 'avif' | 'gif' | 'jpeg'): Promise<Buffer> {
  const px = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      if (y >= SIZE / 2) {
        px[i] = 220;
        px[i + 1] = 40;
        px[i + 2] = 40;
        px[i + 3] = 255;
      }
    }
  }
  const image = sharp(px, { raw: { width: SIZE, height: SIZE, channels: 4 } });
  if (format === 'png') return image.png().toBuffer();
  if (format === 'webp') return image.webp().toBuffer();
  if (format === 'avif') return image.avif().toBuffer();
  if (format === 'gif') return image.gif().toBuffer();
  return image.jpeg().toBuffer();
}

/** The alpha byte of one pixel, decoded. `ensureAlpha` makes an image with NO alpha channel answer 255 instead
 * of throwing — which is exactly what a flattened derivative is, and exactly what must fail. */
async function alphaAt(bytes: Buffer | Uint8Array, x: number, y: number): Promise<number> {
  const { data, info } = await sharp(Buffer.from(bytes))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data[(y * info.width + x) * info.channels + (info.channels - 1)] as number;
}

/** Both halves, on any image that claims to carry this fixture's transparency. Throws when it does not. */
async function expectBothHalves(bytes: Buffer | Uint8Array, what: string): Promise<void> {
  const transparent = await alphaAt(bytes, 4, 4);
  const opaque = await alphaAt(bytes, SIZE - 4, SIZE - 4);
  expect(
    transparent,
    `${what}: the transparent half came back with alpha ${transparent}`,
  ).toBeLessThanOrEqual(TOLERANCE);
  expect(opaque, `${what}: the opaque half came back with alpha ${opaque}`).toBeGreaterThanOrEqual(
    255 - TOLERANCE,
  );
}

test('★ THE FIXTURES CARRY REAL ALPHA — proven before a single output is asserted', async () => {
  // Without this, every assertion below could be comparing two opacities and staying green forever.
  for (const format of ['png', 'webp', 'avif', 'gif'] as const) {
    await expectBothHalves(await master(format), `the ${format} fixture`);
  }
});

test('★ …and that proof KNOWS HOW TO FAIL: a jpeg master (no alpha channel at all) is rejected by it', async () => {
  // The guard on the guard. A fixture check that cannot reject an opaque image proves nothing about the ones
  // it accepts — this is the "anti-hardcoding test with a hardcoding inside" failure mode, closed.
  await expect(expectBothHalves(await master('jpeg'), 'an opaque jpeg')).rejects.toThrow();
});

// ── the matrix: every master × every lane, through the route's own GET ─────────────────────────────────────

const BASE = 'https://cdn.test/media';

/** Answers the route's loopback call by running Next's REAL optimizer over `masterBytes`, negotiating with the
 * REAL `Accept` the route chose. Nothing here decides a format: `validateParams` reads the header the route
 * sent, `imageOptimizer` decides and encodes. */
function optimizerHarness(masterBytes: Buffer, masterType: string) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const accept = (init?.headers as Record<string, string> | undefined)?.accept;
    expect(
      accept,
      'the route called the optimizer without an Accept — the lane decides nothing then',
    ).toBeDefined();
    const params = optimizer.ImageOptimizerCache.validateParams(
      { headers: { accept: accept as string } },
      {
        url: url.searchParams.get('url') as string,
        w: url.searchParams.get('w') as string,
        q: url.searchParams.get('q') as string,
      },
      nextConfig,
      false,
    );
    if (params.errorMessage)
      throw new Error(`the optimizer refused the params: ${params.errorMessage}`);
    const out = await optimizer.imageOptimizer(
      { buffer: masterBytes, contentType: masterType, cacheControl: null, etag: 'fixture' },
      params,
      nextConfig,
      { isDev: false, silent: true },
    );
    return new Response(new Uint8Array(out.buffer), {
      status: 200,
      headers: { 'content-type': out.contentType },
    });
  };
}

/** Every image mime `plan-upload` accepts, as the extension the provider_key carries. `jpeg` is in the matrix
 * on purpose even though it has no alpha: it is the lane's most common master, and a fix for the others that
 * broke it would go unnoticed otherwise. */
const LANES = ['webp', 'orig'] as const;

/**
 * The format each lane is EXPECTED to have actually encoded, decoded off the returned bytes (never off the
 * Content-Type header, which a passthrough would copy for free).
 *
 * This is what stops the file from grading itself. Every alpha assertion here would stay green if the optimizer
 * seam degraded into a passthrough — the master already has alpha, so handing it back untouched "preserves" it
 * perfectly. Pinning the encoded format proves a real transform ran, and pins WHICH one: `webp` never
 * negotiates, and `orig` is the master's own format except for the two Next would otherwise flatten to JPEG.
 * Written out rather than derived from `acceptFor`, so the mechanism cannot certify itself.
 */
const ENCODED_AS: Record<string, Record<(typeof LANES)[number], string>> = {
  png: { webp: 'webp', orig: 'png' },
  webp: { webp: 'webp', orig: 'webp' },
  avif: { webp: 'webp', orig: 'webp' },
  gif: { webp: 'webp', orig: 'gif' },
  jpg: { webp: 'webp', orig: 'jpeg' },
};

/** One case per master the KERNEL accepts × per lane. Nothing here is a hand-kept list. */
const CASES = MASTER_EXTENSIONS.flatMap((extension) => LANES.map((lane) => ({ extension, lane })));

test.each(
  CASES,
)('★ a transparent .$extension master survives the $lane lane — alpha asserted on the returned PIXELS', async ({
  extension,
  lane,
}) => {
  const format = ENCODER[extension];
  expect(
    format,
    `the kernel accepts .${extension} uploads and this matrix has no encoder for it — add one, and let the ` +
      'per-pixel proof below tell you whether that master keeps its alpha on both lanes',
  ).toBeDefined();
  const bytes = await master(format as 'png');
  const key = `ten_a/01J-coffee.${extension}`;
  const originalFetch = globalThis.fetch;
  process.env.FORGE_MEDIA_BASE_URL = BASE;
  process.env.FORGE_INTERNAL_ORIGIN = 'http://127.0.0.1:3000';
  globalThis.fetch = optimizerHarness(bytes, `image/${format}`) as typeof fetch;
  try {
    const res = await GET(new Request('http://storefront.test/api/img/x'), {
      params: Promise.resolve({ spec: [lane, String(SIZE), ...key.split('/')] }),
    });
    expect(res.status).toBe(200);
    const out = Buffer.from(await res.arrayBuffer());

    // A REAL transform ran, and it produced the format this lane means. Both halves matter: the format alone
    // would pass on a passthrough of a same-format master, and "bytes differ" alone would pass on any re-encode.
    expect(
      (await sharp(out).metadata()).format,
      `the ${lane} lane encoded something other than ${ENCODED_AS[extension]?.[lane]} for a .${extension} master`,
    ).toBe(ENCODED_AS[extension]?.[lane]);
    expect(
      out.equals(bytes),
      `the ${lane} lane handed the .${extension} master straight back — the optimizer never ran, so nothing below proves anything`,
    ).toBe(false);

    if (format === 'jpeg') {
      // No alpha went in, so none can come out; what must hold is that the lane still serves the image.
      expect(out.byteLength).toBeGreaterThan(0);
      return;
    }
    await expectBothHalves(
      out,
      `the ${lane} lane flattened a .${extension} master (served as ${res.headers.get('content-type')})`,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ── the mechanism itself: which Accept each lane sends, and why ────────────────────────────────────────────

test('the lane + the MASTER decide the Accept — and only the masters Next would flatten deviate', () => {
  // The webp lane never negotiates: one URL, one format, whatever the master is.
  for (const ext of ['png', 'webp', 'avif', 'gif', 'jpg']) {
    expect(acceptFor('webp', `ten_a/x.${ext}`)).toBe('image/webp');
  }
  // The orig lane keeps the request it always sent for every master the optimizer passes through untouched…
  for (const ext of ['png', 'gif', 'jpg']) {
    expect(acceptFor('orig', `ten_a/x.${ext}`)).toBe('image/jpeg,image/png,image/gif');
  }
  // …and asks for a format that CARRIES alpha for the two the optimizer would otherwise flatten to JPEG.
  expect(acceptFor('orig', 'ten_a/x.webp')).toBe('image/webp');
  expect(acceptFor('orig', 'ten_a/x.avif')).toBe('image/webp');
  // An extension nobody minted falls back to today's behaviour rather than inventing a transcode.
  expect(acceptFor('orig', 'ten_a/x.bin')).toBe('image/jpeg,image/png,image/gif');
  expect(acceptFor('orig', 'ten_a/noextension')).toBe('image/jpeg,image/png,image/gif');
  // The extension is read off the LAST segment, so a dot in a directory name cannot be mistaken for one.
  expect(acceptFor('orig', 'ten_a.v2/x.webp')).toBe('image/webp');
  expect(acceptFor('orig', 'ten_a.webp/x.png')).toBe('image/jpeg,image/png,image/gif');
});
