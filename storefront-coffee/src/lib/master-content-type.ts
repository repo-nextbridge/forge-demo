// F4 — what the master door tells the browser the bytes ARE, when the bucket does not.
//
// THE MEASURED SHAPE OF THE PROBLEM. An object uploaded to GCS or S3 without a type is not served with the
// header missing — it is served with `application/octet-stream`, the universal "I do not know". (Our own dev
// connector does the same: `apps/api/src/storage-connector.ts`'s `mimeForKey` falls back to it for an extension
// it does not recognize.) So "the bucket did not say" arrives here in two shapes, and both have to be handled
// or the fix only works in tests.
//
// WHY THIS MATTERS AND WHERE. It is NOT the derivative door: Next's optimizer sniffs the buffer before it reads
// the header (`image-optimizer.js:721`, `detectContentType(upstreamBuffer) || imageUpstream.contentType`), and
// its sniffer knows all five masters the kernel accepts — measured, 30 lane × master × header combinations, no
// refusals. The path that actually suffers is the one with no optimizer in it: `MediaImage`'s UNOPTIMIZED
// branch renders `<img src="/api/media/<key>">` directly (the minicart, the checkout summary lines), and a
// browser only renders an `application/octet-stream` there because it sniffs `<img>` bytes on its own. That is
// luck. One `X-Content-Type-Options: nosniff` — ours, or an edge's, neither of which exists today but either of
// which is one hardening decision away — and every one of those images breaks at once.
//
// WHY SNIFFING AND NOT THE KEY'S EXTENSION. `derivative-accept.ts` derives from the extension because it must
// decide BEFORE the fetch, with nothing else to go on. Here the bytes are already in hand, and bytes cannot be
// wrong about themselves: a key mis-minted or an object replaced under it would make the extension lie.
//
// ★ AND WHY THE BYTES BEAT THE HEADER RATHER THAN ONLY FILLING ITS GAP. The decisive reason is not taste, it is
// that THE SISTER DOOR ALREADY DECIDES THIS WAY: `/api/img` hands the master to the Next optimizer, which reads
// `detectContentType(upstreamBuffer) || imageUpstream.contentType` — sniff first, header second. If this door
// preferred the header, the two doors that serve the SAME OBJECT would disagree about what it is whenever a
// bucket states the wrong type: the derivative would be one thing and the master another, for one key. That is
// a defect with an appointment — someone finds it at 2am with an image that works on one screen and not the
// other. `masterContentTypeAgreesWithOptimizer` in the route's test pins that parity against the optimizer's own
// detector rather than against a sentence.
//
// The secondary reason is the ordinary one: a header is a CLAIM, the bytes are the FACT, and a bucket stamping
// the wrong type is the sibling case of one stamping none. Nothing is lost by inverting — a stated type is still
// the answer for everything this detector does not recognize, which is exactly the new or exotic format it has
// no signature for.
//
// THE SIGNATURES BELOW ARE THE FIVE THE KERNEL MINTS (`plan-upload`'s allow-list, guarded against drift by
// `derivative-accept.guard.test.ts` through `MASTER_EXTENSIONS`). Not a general image sniffer: this door serves
// catalogue masters, and answering for a format the kernel never accepts would be inventing a capability. What
// it does not recognize keeps the honest placeholder and gets said out loud instead.

/** What a content-type header means when it carries no information — absent, or this. */
export const UNKNOWN_CONTENT_TYPE = 'application/octet-stream';

/** Enough bytes for every signature below: AVIF needs the brand at offsets 8..11. */
export const SNIFF_BYTES = 12;

const ASCII = (text: string): number[] => [...text].map((character) => character.charCodeAt(0));

/**
 * One signature: the bytes that must match, at their offsets. `null` is a wildcard — the four length bytes of a
 * RIFF/ISO-BMFF box carry the size, not the identity.
 */
type Signature = { mime: string; at: number; bytes: Array<number | null> };

const SIGNATURES: readonly Signature[] = [
  { mime: 'image/jpeg', at: 0, bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', at: 0, bytes: [0x89, ...ASCII('PNG'), 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/gif', at: 0, bytes: ASCII('GIF8') },
  // RIFF….WEBP — the four bytes between are the file size.
  {
    mime: 'image/webp',
    at: 0,
    bytes: [...ASCII('RIFF'), null, null, null, null, ...ASCII('WEBP')],
  },
  // ISO-BMFF: `ftyp` at 4, then the major brand. `avis` is the image-SEQUENCE brand; sharp writes `avif`, but a
  // master encoded elsewhere may carry either, and both decode as AVIF everywhere that reads AVIF at all.
  { mime: 'image/avif', at: 4, bytes: [...ASCII('ftyp'), ...ASCII('avif')] },
  { mime: 'image/avif', at: 4, bytes: [...ASCII('ftyp'), ...ASCII('avis')] },
];

/** The mime these bytes ARE, or `undefined` when this door has no answer for them. */
export function sniffImageType(head: Uint8Array): string | undefined {
  for (const { mime, at, bytes } of SIGNATURES) {
    if (head.length < at + bytes.length) continue;
    if (bytes.every((byte, index) => byte === null || head[at + index] === byte)) return mime;
  }
  return undefined;
}

/** What the bucket CLAIMED, or `undefined` when it claimed nothing usable — no header, or the placeholder. */
function statedType(upstreamType: string | null): string | undefined {
  if (upstreamType === null) return undefined;
  const mime = upstreamType.split(';')[0]?.trim().toLowerCase();
  if (mime === undefined || mime === '' || mime === UNKNOWN_CONTENT_TYPE) return undefined;
  return upstreamType;
}

/**
 * What to serve the master as: the BYTES first, the bucket's claim second, the honest placeholder last.
 *
 * The order is the whole point (see the header): the derivative door's optimizer resolves the same question in
 * exactly this order, and two doors serving one object may not disagree about what that object is. The stated
 * type keeps every case it can still win — it answers for any format this detector has no signature for, and it
 * is returned verbatim, parameters and all, because a header is not a bare mime.
 */
export function masterContentType(upstreamType: string | null, head: Uint8Array): string {
  return sniffImageType(head) ?? statedType(upstreamType) ?? UNKNOWN_CONTENT_TYPE;
}
