// The counter's root layout: the two typefaces of the artboard, the sheet, and the demonstration ribbon
// under it all.
//
// ★ THE FONTS ARE SELF-HOSTED, and the artboard's CDN link is the one thing here that is deliberately NOT
// copied from it. `design-base/Totem forge.co.dc.html` pulls Fraunces and Poppins from Google Fonts, which is
// right for a design tool and wrong for this box: the build would reach the network, the page would reach a
// third party at runtime, and a counter on a shop's LAN would render in Times the first morning the uplink is
// down. `next/font/local` also generates a metric-adjusted fallback, so the swap does not reflow the panel.
//
// Only the weights the artboard actually uses ship: Fraunces 400/600/700, Poppins 300/400/500/600.

import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import { DemoNotice } from '@/components/DemoNotice';
import '../styles/globals.css';

const fraunces = localFont({
  src: [
    { path: './fonts/fraunces-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/fraunces-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/fraunces-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-fraunces',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
});

const poppins = localFont({
  src: [
    { path: './fonts/poppins-latin-300-normal.woff2', weight: '300', style: 'normal' },
    { path: './fonts/poppins-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/poppins-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/poppins-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-poppins',
  display: 'swap',
  adjustFontFallback: 'Arial',
});

export const metadata = {
  title: 'Forge Café · Balcão',
  description: 'Auto atendimento do balcão.',
};

/**
 * ⚠️ NO PINCH ZOOM AND NO USER SCALING — and on a public kiosk that is an accessibility DECISION, not a
 * default. The panel is scaled to the glass by `--totem-scale`; a two-finger zoom on a fixed 1080×1920 layout
 * strands the customer in a corner of a screen with no browser chrome to escape with. The counter's own type
 * is large for the same reason (the smallest text on it is 16px of a 1080-wide panel, ~2× a phone's body
 * text), and `prefers-reduced-motion` is honoured wholesale in globals.css.
 */
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${poppins.variable}`}>
      <body>
        <DemoNotice>{children}</DemoNotice>
      </body>
    </html>
  );
}
