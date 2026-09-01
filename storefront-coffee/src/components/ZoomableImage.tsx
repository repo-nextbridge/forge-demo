'use client';
// o4-PDP #17 — the stage zoom is the prototype's DESKTOP loupe, and mobile has NONE. The old full-screen lightbox
// (a tap opened a dark overlay with the master) is gone: on a phone a tap now does nothing, exactly like the
// prototype (`if (this.state.mobile) return`). On a pointer-fine desktop, hovering magnifies the stage image in
// place — `transform: scale(2)` with the transform-origin tracking the cursor — and leaving resets it. No overlay,
// no master fetch: the loupe scales the stage image the shopper is already looking at, matching the prototype.
//
// `canZoom` is resolved on the client from `(hover: hover) and (pointer: fine)` and defaults to FALSE, so the SSR
// output (and every touch device) is the plain, no-zoom stage — the mobile requirement is the safe default.
import { useEffect, useRef, useState } from 'react';
import styles from './ZoomableImage.module.css';

export function ZoomableImage({ children }: { children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [canZoom, setCanZoom] = useState(false);

  useEffect(() => {
    // Only a device that truly hovers with a fine pointer (a mouse) gets the loupe. Phones/tablets never do.
    if (typeof window.matchMedia !== 'function') return; // no capability query → stay on the no-zoom default
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const apply = () => setCanZoom(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const move = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = innerRef.current;
    if (!el) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    el.style.transformOrigin = `${x}% ${y}%`;
    el.style.transform = 'scale(2)';
  };
  const leave = () => {
    const el = innerRef.current;
    if (el) el.style.transform = 'scale(1)';
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the hover loupe is a mouse-only visual enhancement (like the prototype), not a control — nothing to reach by keyboard/AT, the image keeps its own alt, and it is inert on touch.
    <div
      className={styles.stage}
      data-can-zoom={canZoom}
      data-testid="zoom-stage"
      onMouseMove={canZoom ? move : undefined}
      onMouseLeave={canZoom ? leave : undefined}
    >
      <div ref={innerRef} className={styles.zoomInner}>
        {children}
      </div>
    </div>
  );
}
