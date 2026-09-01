// @vitest-environment node
//
// F4 — THE MASTER DOOR SAYS WHAT THE BYTES ARE, EVEN WHEN THE BUCKET DOES NOT.
//
// WHAT WAS MEASURED, AND WHAT THE BRIEF GOT WRONG. The card said a master with no `content-type` becomes a 400
// from the optimizer and a 404 from us. It does not: `next/dist/server/image-optimizer.js:721` reads
// `detectContentType(upstreamBuffer) || imageUpstream.contentType`, so the MAGIC NUMBER wins and the header is
// only consulted when the sniff fails. Driving the real optimizer over the five masters the kernel accepts × the
// lanes × `application/octet-stream` vs. no header at all: 30 combinations, zero 400s. The derivative door was
// never the victim here.
//
// AND THE ORDER MATTERS AS MUCH AS THE SNIFF. The optimizer resolves this as `detectContentType(buffer) ||
// header`: bytes first. This door does the same, for the reason that outranks any preference — the two doors
// serve the SAME OBJECT, and a door that believed a wrong header would type the master differently from its own
// derivative, for one key. The parity is asserted below against the optimizer's own detector.
//
// THE PATH THAT IS. `MediaImage` has an UNOPTIMIZED branch (a caller that states no box — the minicart, the
// checkout summary lines) whose `<img src>` is `/api/media/<key>` DIRECTLY, with no optimizer in between. There
// the browser gets whatever this route stamps, and today that is `application/octet-stream` for any object whose
// bucket did not set a type. It renders anyway — only because browsers sniff `<img>` bytes themselves. That is
// luck, not correctness: it is one `X-Content-Type-Options: nosniff` (from us or from an edge in front) away
// from every one of those images breaking. So the door derives the type from the bytes it is already streaming.
//
// WHY THE FIXTURES ARE ENCODED, NOT HAND-TYPED. A test with the magic numbers written out by hand grades the
// implementation against a second copy of itself, and both copies can be wrong together. These masters are
// produced by the same encoder that produces real ones — sharp, borrowed from the optimizer so the storefront
// gains no dependency for a test — and the case list comes from `MASTER_EXTENSIONS`, so a sixth format the
// kernel starts accepting arrives here RED instead of arriving unproven.

import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MASTER_EXTENSIONS } from '@/lib/derivative-accept';
import { SNIFF_BYTES, sniffImageType } from '@/lib/master-content-type';
import { GET } from './[...key]/route';

const require_ = createRequire(import.meta.url);

type SharpImage = {
  png: () => SharpImage;
  webp: () => SharpImage;
  avif: () => SharpImage;
  gif: () => SharpImage;
  jpeg: () => SharpImage;
  toBuffer: () => Promise<Buffer>;
};
type SharpFactory = (
  input: Buffer | Uint8Array,
  options?: { raw: { width: number; height: number; channels: number } },
) => SharpImage;

/** Borrowed from the optimizer (see the header of `img-alpha.test.ts` for why this import is deliberate and
 * what its breaking means). Nothing in the ROUTE imports Next internals — a private path is a test's risk to
 * take, never a production route's. */
const sharp = (
  require_('next/dist/server/image-optimizer') as { getSharp: () => SharpFactory }
).getSharp();

/** ext (as `plan-upload` mints it) → the encoder that writes that master, and the mime those bytes ARE.
 * Written out rather than derived from the module under test, so the mechanism cannot certify itself. */
const MASTER: Record<string, { encode: 'jpeg' | 'png' | 'webp' | 'gif' | 'avif'; mime: string }> = {
  jpg: { encode: 'jpeg', mime: 'image/jpeg' },
  png: { encode: 'png', mime: 'image/png' },
  webp: { encode: 'webp', mime: 'image/webp' },
  gif: { encode: 'gif', mime: 'image/gif' },
  avif: { encode: 'avif', mime: 'image/avif' },
};

const SIZE = 32;
async function masterBytes(encode: 'jpeg' | 'png' | 'webp' | 'gif' | 'avif'): Promise<Buffer> {
  const px = Buffer.alloc(SIZE * SIZE * 4, 200);
  return sharp(px, { raw: { width: SIZE, height: SIZE, channels: 4 } })
    [encode]()
    .toBuffer();
}

const BASE = 'https://cdn.test/media';
const originalBase = process.env.FORGE_MEDIA_BASE_URL;

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.FORGE_MEDIA_BASE_URL = BASE;
});
afterEach(() => {
  if (originalBase === undefined) delete process.env.FORGE_MEDIA_BASE_URL;
  else process.env.FORGE_MEDIA_BASE_URL = originalBase;
});

/** The bucket answers with these bytes and these headers. `contentType: null` = the header is absent entirely. */
function bucketAnswers(bytes: Uint8Array, contentType: string | null): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(new Uint8Array(bytes), {
      status: 200,
      headers: contentType === null ? {} : { 'content-type': contentType },
    }),
  );
}

function call(segments: string[]): Promise<Response> {
  return GET(new Request('http://storefront.test/api/media/x'), {
    params: Promise.resolve({ key: segments }),
  });
}

test.each(
  MASTER_EXTENSIONS,
)('★ a .%s master whose bucket sent NO content-type is served as what its BYTES are', async (extension) => {
  const spec = MASTER[extension];
  expect(
    spec,
    `the kernel mints .${extension} provider_keys and this file has no fixture for it — add one, so the ` +
      'door is proven to identify that master from its bytes instead of stamping octet-stream on it',
  ).toBeDefined();

  const bytes = await masterBytes((spec as { encode: 'png' }).encode);
  bucketAnswers(bytes, null);
  const res = await call(['ten_a', `01J-coffee.${extension}`]);

  expect(res.status).toBe(200);
  expect(
    res.headers.get('content-type'),
    `the bucket sent no content-type and the door did not derive it from the bytes of a .${extension} ` +
      'master — the unoptimized <img> in the minicart then renders only because the browser sniffs for us',
  ).toBe((spec as { mime: string }).mime);
  expect(new Uint8Array(await res.arrayBuffer()), 'the peek ate part of the master').toEqual(
    new Uint8Array(bytes),
  );
});

test('`application/octet-stream` is the bucket saying "I do not know", so the bytes decide', async () => {
  // This is the REAL shape of the defect: GCS and S3 do not omit the header, they stamp the universal
  // placeholder on an object uploaded without a type. Our own dev connector does the same for an extension it
  // does not recognize (`apps/api/src/storage-connector.ts`, `mimeForKey`).
  const bytes = await masterBytes('webp');
  bucketAnswers(bytes, 'application/octet-stream');
  expect((await call(['ten_a', 'x.webp'])).headers.get('content-type')).toBe('image/webp');
});

test('★ the BYTES beat a header that contradicts them — the two doors may not disagree about one object', async () => {
  // A header is a claim; the bytes are the fact. The decisive reason is not that, though: `/api/img` hands the
  // same object to the optimizer, which sniffs BEFORE it reads the header. A door preferring the claim would
  // type the master one way and its own derivative another, for one key.
  const bytes = await masterBytes('png');
  for (const claim of ['image/jpeg', 'text/plain', 'binary/octet-stream']) {
    bucketAnswers(bytes, claim);
    expect(
      (await call(['ten_a', 'x.png'])).headers.get('content-type'),
      `the bucket claimed ${claim} over bytes that are demonstrably a PNG, and the door believed the claim`,
    ).toBe('image/png');
  }
});

test('★ …and this door answers exactly what the OPTIMIZER would, for every master the kernel mints', async () => {
  // The parity itself, pinned against the sister door's own detector instead of against a sentence in a
  // comment. If Next's sniffer and ours ever diverge on a master, one key starts having two types.
  const detectContentType = (
    require_('next/dist/server/image-optimizer') as {
      detectContentType: (buffer: Buffer) => string | undefined;
    }
  ).detectContentType;
  expect(
    typeof detectContentType,
    'next no longer exports detectContentType — the parity below cannot be checked, and the reason this door ' +
      'sniffs at all (matching what /api/img does with the same object) needs re-reading before this test is ' +
      'changed. Do NOT delete it.',
  ).toBe('function');

  for (const extension of MASTER_EXTENSIONS) {
    const spec = MASTER[extension] as { encode: 'png' };
    const bytes = await masterBytes(spec.encode);
    expect(
      sniffImageType(new Uint8Array(bytes.subarray(0, SNIFF_BYTES))),
      `the optimizer and this door disagree about what a .${extension} master is`,
    ).toBe(detectContentType(bytes));
  }
});

test('a format this door cannot sniff falls back to the bucket, verbatim (a header is not a bare mime)', async () => {
  // Nothing is lost by inverting: the stated type still answers for everything with no signature here — the
  // new or exotic format, which is precisely the case a hand-written detector is behind on.
  bucketAnswers(
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    'image/svg+xml; charset=utf-8',
  );
  expect((await call(['ten_a', 'x.svg'])).headers.get('content-type')).toBe(
    'image/svg+xml; charset=utf-8',
  );
});

test('★ bytes nothing recognizes still STREAM, and the real reason reaches whoever is debugging', async () => {
  // The response cannot say "the object is there but I cannot identify it": a public answer that distinguishes
  // "missing" from "unusable" tells an anonymous caller which keys exist in the bucket. So the distinction lives
  // in the log — and it has to live SOMEWHERE, because the alternative is a human hunting for a key that is
  // present and fine.
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  bucketAnswers(Buffer.from('this is not an image at all, really'), null);

  const res = await call(['ten_a', '01J-mystery.bin']);
  expect(res.status, 'an unidentifiable master must degrade, not break the page').toBe(200);
  expect(res.headers.get('content-type')).toBe('application/octet-stream');

  const said = warn.mock.calls.map((call_) => call_.join(' ')).join('\n');
  expect(said, 'the door went silent about a master it could not identify').toContain(
    'content-type',
  );
  expect(said, 'the warning does not name the key, so it cannot be acted on').toContain(
    'ten_a/01J-mystery.bin',
  );
});

test('a master the bucket DID type never warns — a log line per healthy image is a log nobody reads', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  bucketAnswers(await masterBytes('png'), 'image/png');
  await call(['ten_a', 'x.png']);
  expect(warn).not.toHaveBeenCalled();
});

test('the peek returns the stream intact — many chunks, and a body shorter than the sniff window', async () => {
  // The door streams; it must not start buffering the master to look at its head. What it reads it must hand
  // back, in order, without waiting for the rest.
  const chunks = [
    new Uint8Array([0x89, 0x50]), // a PNG signature split ACROSS chunks — the peek has to join them
    new Uint8Array([0x4e, 0x47, 0x0d, 0x0a]),
    new Uint8Array([0x1a, 0x0a]),
    new Uint8Array(64_000).fill(7),
  ];
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      }),
      { status: 200 },
    ),
  );
  const res = await call(['ten_a', 'x.png']);
  expect(res.headers.get('content-type')).toBe('image/png');
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(
    new Uint8Array(chunks.flatMap((chunk) => [...chunk])),
  );

  // Shorter than the sniff window: the read loop must end on the stream, not on the byte count.
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
  );
  const tiny = await call(['ten_a', 'y.bin']);
  expect(tiny.status).toBe(200);
  expect(new Uint8Array(await tiny.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
});
