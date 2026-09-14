// Product gallery — a STAGE with a strip of thumbnails below it (the design's arrangement). Media carries an
// OPTIONAL `url` resolved by the read port (CONN-MEDIA); MediaImage renders it, degrading to the placeholder
// when the url is absent (no base configured) or fails to load.
//
// S6-IMAGES — the images go through the optimizer (webp/avif + a responsive srcset), the alt is the per-image
// one the operator wrote (falling back to the product title), and the stage image opens the MASTER full screen
// (the zoom never loads a derivative).
//
// S6-PDP — the strip is interactive and carries the product's external videos too: clicking a thumb puts it on
// the stage (a video plays there, as a player embed — a video is not zoomable). `media` arrives in DISPLAY
// ORDER (the caller uses `orderGalleryItems`: cover first, videos last) — the gallery does not re-sort it.
//
// Progressive enhancement, the house pattern: without JS the stage still shows the first item (the cover), and
// the video thumb is a real <a> to the external video — nothing becomes unreachable. With JS the anchor is
// intercepted and the video plays right here.
//
// PRE-S7-STOREFRONT-DEBT — `optimized` is a PROP, and this component may not compute it. It answers "can the
// same-origin media door serve these images?", which only the server knows (it is a server-only env). Reading it
// here — as this file used to, via `mediaSrc()` — gave the server one answer and the browser another, and the
// two <img>s disagreed on `src`/`srcset`/`sizes` at hydration. Props cross the boundary; the env does not.
'use client';

import { MediaImage } from '@forgecommerce/storefront-kit/MediaImage';
import { altOf, mediaSrcOf } from '@forgecommerce/storefront-kit/media/src';
import type { MediaRef } from '@forgecommerce/storefront-kit/read-client';
import { useRef, useState } from 'react';
import { embedSrc, isVideo } from '@/lib/gallery';
import styles from './Gallery.module.css';
import { ZoomableImage } from './ZoomableImage';

/** The play glyph on a video thumb. `currentColor` only — literal hex is barred from the theme's components. */
function PlayBadge() {
  return (
    <span className={styles.playBadge}>
      <svg viewBox="0 0 24 24" width="18" height="18" focusable="false" aria-hidden="true">
        <path d="M8 5v14l11-7z" fill="currentColor" />
      </svg>
    </span>
  );
}

/** A video on the stage: the player embed (or a plain link when we don't know the provider). */
function VideoStage({ item, alt }: { item: MediaRef; alt: string }) {
  const url = item.url ?? item.provider_key;
  const src = embedSrc(url);
  if (!src) {
    return (
      <a href={url} className={styles.videoLink} target="_blank" rel="noreferrer">
        Assistir ao vídeo
      </a>
    );
  }
  return (
    <div className={styles.videoFrame} data-testid="gallery-video">
      <iframe
        src={src}
        title={`${alt}, vídeo`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

export function Gallery({
  media,
  alt,
  optimized,
}: {
  media: MediaRef[];
  alt: string;
  /** Resolved by the SERVER (see the header): whether these images go through the optimizer. */
  optimized: boolean;
}) {
  const [active, setActive] = useState(0);
  const item = media[active] ?? media[0];
  const stage = mediaSrcOf(item, optimized);

  // L4 #6 — swipe the stage to change the photo on touch (mobile: product AND sku galleries, same stage). The
  // desktop loupe (ZoomableImage) never binds touch, so it wasn't swallowing the gesture — there simply was no
  // swipe handler. A horizontal swipe past the threshold steps active±1 (clamped); a mostly-vertical drag is left
  // to the page scroll. Harmless on a mouse desktop (touch events never fire), so the desktop stays intact.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || media.length < 2) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return; // not a decisive horizontal swipe
    const dir = dx < 0 ? 1 : -1; // swipe left → next photo
    setActive((i) => Math.min(media.length - 1, Math.max(0, i + dir)));
  };

  return (
    <div className={styles.gallery} data-testid="gallery">
      <div
        className={styles.main}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        data-testid="gallery-stage"
      >
        {item && isVideo(item) ? (
          <VideoStage item={item} alt={alt} />
        ) : (
          <ZoomableImage>
            <MediaImage
              src={stage.url}
              providerKey={stage.providerKey}
              alt={altOf(item, alt)}
              fill
              // The desktop stage carries a 2× LOUPE (ZoomableImage: transform: scale(2)). Requesting only the
              // ~688px display width made the optimizer serve a 688px derivative, so the loupe upscaled it and read
              // blurry (the master is 1920×1440, plenty). We ask for ~1280px on desktop so the magnified
              // view has real pixels (retina pulls up to the 1920 master); the unzoomed stage just downscales it,
              // crisp. Mobile has no loupe → stays 100vw. Trade a heavier hero for a sharp zoom (the demo's point).
              sizes="(max-width: 768px) 100vw, 1280px"
              priority
              className={styles.mainImg}
              placeholderClassName={styles.placeholder}
            />
          </ZoomableImage>
        )}
      </div>
      {media.length > 1 ? (
        <div className={styles.thumbs}>
          {media.map((m, i) => {
            if (isVideo(m)) {
              return (
                <a
                  key={`${m.provider_key}-${m.position}`}
                  href={m.url ?? m.provider_key}
                  className={styles.videoThumb}
                  data-active={i === active}
                  data-testid="gallery-video-thumb"
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    setActive(i);
                  }}
                >
                  <PlayBadge />
                </a>
              );
            }
            const s = mediaSrcOf(m, optimized);
            return (
              <button
                type="button"
                key={`${m.provider_key}-${m.position}`}
                className={styles.thumb}
                data-active={i === active}
                aria-current={i === active}
                aria-label={`${alt}, foto ${i + 1}`}
                onClick={() => setActive(i)}
              >
                <MediaImage
                  src={s.url}
                  providerKey={s.providerKey}
                  alt={altOf(m, alt)}
                  fill
                  sizes="64px"
                  className={styles.thumbImg}
                  placeholderClassName={styles.thumbImg}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
