declare module '*.css';

// ★★★ GATE-V2 — AND WEBP, FOR THE REASON THE COFFEE FORK ALREADY WROTE DOWN ONE FLOOR UP
// (`storefront-coffee/src/global.d.ts`): Next turns an imported image into a `StaticImageData` object whose
// `.src` is the emitted `/_next/static/…` URL, and the TS resolver knows nothing about that loader.
//
// ⛔ THE IMPORT IS NOT A STYLE CHOICE HERE, IT IS THE WHOLE MECHANISM. The v2 screen first named its art as a
// RUNTIME STRING — `` `./art/card-${face.store}.webp` `` — and a string is invisible to the bundler: the file
// was never emitted into any of the four images, and the browser would have resolved a relative URL against
// whatever page the gate was covering. Two of the four cards also named a file that does not exist, because
// the store handles are `forge|outlet|cafe|balcao` and the art is `store|outlet|cafe|totem`. One line, two
// defects, and every test green — see `block/art.ts` for the shape that replaced it.
declare module '*.webp' {
  const image: { src: string; height: number; width: number; blurDataURL?: string };
  export default image;
}
