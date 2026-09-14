// THE THREE ICONS THAT WERE REPLACED, plus the QR the pix screen draws.
//
// ★ THE ARTBOARD IS THE MANDATE, WITH TWO DECLARED EXCEPTIONS, and this file is one of them: the Pix, card
// and bag icons were rejected and reopened for a redraw. So these three are NEW, and the only constraint on
// them is that they stay coherent with the stroke of the rest.
//
// The artboard's line is unmistakable and it is what these follow: everything is drawn with a 3px stroke, no
// fills, generously rounded joins, and geometry built from a few large shapes rather than detail — the
// counter is read from a metre away by someone holding a tray. The old ones broke that in three different
// ways (the bag was a filled silhouette, the card carried a tiny magnetic stripe nobody can see at that
// distance, and the pix mark was a raster). These are one family: same stroke, same radius, same optical
// weight, all three drawn on the same 32-unit grid so they line up when set side by side.

type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 32 32',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

/**
 * PIX — the mark is a square standing on its corner, which is what the real one is: four arrowheads meeting.
 * Drawn as one rotated square with its diagonals hinted, so it reads as the pix diamond at a glance and as a
 * stroke drawing up close. Deliberately NOT the official logo: this is a simulator, and putting a payment
 * scheme's registered mark on a fake charge is the kind of thing that is fine until it is not.
 */
export function PixIcon({ size = 32, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M16 3.5 28.5 16 16 28.5 3.5 16Z" />
      <path d="M11 11 16 16l-5 5" />
      <path d="M21 11 16 16l5 5" />
    </svg>
  );
}

/**
 * CARD — the machine, not the plastic: a terminal seen face on, with its screen and its keypad. That is what
 * the customer is being pointed at ("pague na maquininha ao lado do totem"), and a rectangle with a stripe
 * pointed at the wrong object.
 */
export function CardTerminalIcon({ size = 32, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="7" y="3.5" width="18" height="25" rx="3.5" />
      <rect x="11" y="8" width="10" height="6" rx="1.5" />
      <path d="M12 19h.01M16 19h.01M20 19h.01M12 23.5h.01M16 23.5h.01M20 23.5h.01" strokeWidth={3.4} />
    </svg>
  );
}

/**
 * BAG — a paper bag with a handle, open at the top: the thing a barista hands over a counter. The old one was
 * a filled silhouette that went muddy against the dark footer.
 */
export function BagIcon({ size = 32, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6.5 10.5h19l-1.6 16a2 2 0 0 1-2 1.8H10.1a2 2 0 0 1-2-1.8Z" />
      <path d="M11.5 14V9a4.5 4.5 0 0 1 9 0v5" />
    </svg>
  );
}

/**
 * THE QR — a decorative code, drawn deterministically FROM the payment app's own payload.
 *
 * ⚠️ IT IS NOT SCANNABLE AND IT MUST NOT PRETEND TO BE. `CONTRATO-POS.md` is explicit: the `copy_paste`
 * `payment-pos` returns has the SHAPE of a BR Code and is decorative — "ninguém paga um simulador". So this
 * renders a pattern that is honest by construction: the same payload always draws the same code (it is a
 * hash of the payload, not of a random seed), a different payload draws a different one, and the caption
 * under it on the screen says what it is — "toque no QR Code para simular o pagamento".
 *
 * The three finder squares are real QR geometry, because a code without them does not read as a code at all.
 */
export function DecorativeQr({ payload, modules = 29 }: { payload: string; modules?: number }) {
  const N = modules;
  const F = N >= 21 ? 7 : 5;

  // A small, stable string hash: the same payload must always produce the same drawing, on the server and on
  // the client alike (a mismatch here is a hydration error nobody would guess the cause of).
  let seed = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    seed ^= payload.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }

  const finder = (i: number, j: number): boolean | null => {
    const box = (a: number, b: number) => i >= a && i < a + F && j >= b && j < b + F;
    if (!(box(0, 0) || box(0, N - F) || box(N - F, 0))) return null;
    const li = i < F ? i : i - (N - F);
    const lj = j < F ? j : j - (N - F);
    const ring = li === 0 || li === F - 1 || lj === 0 || lj === F - 1;
    const core = F === 7 ? li >= 2 && li <= 4 && lj >= 2 && lj <= 4 : li === 2 && lj === 2;
    return ring || core;
  };

  const cells: React.ReactElement[] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const f = finder(i, j);
      let on: boolean;
      if (f === null) {
        const x = Math.imul(seed ^ (i * 73856093) ^ (j * 19349663), 2654435761) >>> 0;
        on = x / 4294967295 > 0.47;
      } else on = f;
      if (on) cells.push(<rect key={`${i}-${j}`} x={j} y={i} width={1.02} height={1.02} />);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${N} ${N}`}
      width="100%"
      height="100%"
      shapeRendering="crispEdges"
      role="img"
      aria-label="Código QR de demonstração"
      fill="currentColor"
    >
      {cells}
    </svg>
  );
}
