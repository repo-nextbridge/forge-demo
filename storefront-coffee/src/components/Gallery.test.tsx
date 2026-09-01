// CONN-MEDIA — the gallery renders the read-port-resolved `url`, and degrades to the placeholder in both gaps:
// no url (no base configured) and a url that fails to load (the object not yet in the bucket).
// S6-IMAGES — plus: the alt is the operator's per-image one (falling back to the product title), and the stage
// image opens the MASTER full screen.
// S6-PDP — and the strip is alive: a thumb puts its media on the stage, a video plays there, and the video thumb
// stays a real link (it works without JS). `media` arrives already in display order (see lib/gallery.ts).

import type { MediaRef } from '@forgecommerce/storefront-kit/read-client';
import { fireEvent, render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { Gallery } from './Gallery';

const cover: MediaRef = {
  provider_key: 'demo/x',
  kind: 'image',
  role: 'hero',
  position: 0,
  alt: null,
  url: 'https://h/media/demo/x',
};
const withUrl: MediaRef[] = [cover];
const noUrl: MediaRef[] = [
  { provider_key: 'demo/x', kind: 'image', role: 'hero', position: 0, alt: null },
];

const strip: MediaRef[] = [
  { ...cover, provider_key: 'a', role: 'cover', position: 1, url: 'https://h/a.jpg' },
  { ...cover, provider_key: 'b', role: null, position: 2, url: 'https://h/b.jpg' },
  {
    provider_key: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    kind: 'video_external',
    role: null,
    position: 3,
    alt: null,
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
];

test('renders the resolved url as the image src', () => {
  const { container } = render(<Gallery media={withUrl} alt="Tenis" optimized={false} />);
  expect(container.querySelector('img')?.getAttribute('src')).toBe('https://h/media/demo/x');
});

test('no url (base unset) → clean placeholder, no broken <img>', () => {
  const { container, getByLabelText } = render(
    <Gallery media={noUrl} alt="Tenis" optimized={false} />,
  );
  expect(container.querySelector('img')).toBeNull();
  expect(getByLabelText('no image')).toBeTruthy();
});

test('url set but the object is missing → onError falls back to the placeholder (carve-out window)', () => {
  const { container, getByLabelText } = render(
    <Gallery media={withUrl} alt="Tenis" optimized={false} />,
  );
  const img = container.querySelector('img');
  if (!img) throw new Error('expected an <img>');
  fireEvent.error(img);
  expect(container.querySelector('img')).toBeNull();
  expect(getByLabelText('no image')).toBeTruthy();
});

// S6-IMAGES — the whole point of the alt column: each image says its own thing.
test('the per-image alt wins; an image without one falls back to the product title', () => {
  const media: MediaRef[] = [
    { ...cover, alt: 'Tênis verde de lado', position: 0 },
    { ...cover, provider_key: 'demo/y', url: 'https://h/media/demo/y', alt: null, position: 1 },
  ];
  const { container } = render(<Gallery media={media} alt="Tênis Runner" optimized={false} />);
  const alts = [...container.querySelectorAll('img')].map((i) => i.getAttribute('alt'));
  expect(alts).toContain('Tênis verde de lado'); // the operator's
  expect(alts).toContain('Tênis Runner'); // the fallback
});

// o4-PDP #17 — an image stage carries the loupe wrapper (never the old lightbox): no overlay exists, and a
// pointer-fine desktop magnifies in place while mobile stays inert.
test('the image stage is wrapped in the zoom stage; no lightbox overlay exists', () => {
  const { getByTestId, queryByTestId } = render(
    <Gallery media={withUrl} alt="Tenis" optimized={false} />,
  );
  expect(getByTestId('zoom-stage')).toBeTruthy();
  expect(queryByTestId('zoom-overlay')).toBeNull(); // the full-screen lightbox is gone
  expect(queryByTestId('zoom-master')).toBeNull();
});

test('desktop hover magnifies the stage in place (transform-origin follows the cursor)', () => {
  // A pointer-fine desktop: the loupe engages.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const { getByTestId, container } = render(
    <Gallery media={withUrl} alt="Tenis" optimized={false} />,
  );
  const stage = getByTestId('zoom-stage');
  expect(stage.getAttribute('data-can-zoom')).toBe('true');
  const inner = container.querySelector('[data-testid="zoom-stage"] > div') as HTMLElement;
  expect(inner.style.transform).not.toBe('scale(2)');
  fireEvent.mouseMove(stage, { clientX: 10, clientY: 10 });
  expect(inner.style.transform).toBe('scale(2)');
  fireEvent.mouseLeave(stage);
  expect(inner.style.transform).toBe('scale(1)');
  vi.unstubAllGlobals();
});

test('mobile (no hover/fine pointer) leaves the stage inert — no zoom on tap', () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const { getByTestId, container } = render(
    <Gallery media={withUrl} alt="Tenis" optimized={false} />,
  );
  const stage = getByTestId('zoom-stage');
  expect(stage.getAttribute('data-can-zoom')).toBe('false');
  const inner = container.querySelector('[data-testid="zoom-stage"] > div') as HTMLElement;
  fireEvent.mouseMove(stage, { clientX: 10, clientY: 10 });
  expect(inner.style.transform).not.toBe('scale(2)'); // no magnify — the tap does nothing
  vi.unstubAllGlobals();
});

// S6-PDP — the strip drives the stage.
test('the first item opens the stage; clicking a thumb swaps it', () => {
  const { container, getByLabelText } = render(
    <Gallery media={strip} alt="Tenis" optimized={false} />,
  );
  const stage = () => container.querySelector('.main img'); // CSS modules are non-scoped in tests
  expect(stage()?.getAttribute('src')).toBe('https://h/a.jpg');

  fireEvent.click(getByLabelText('Tenis, foto 2'));
  expect(stage()?.getAttribute('src')).toBe('https://h/b.jpg');
});

test('the swapped-in image stays inside the zoom stage (the loupe follows the stage)', () => {
  const { getByLabelText, getByTestId, container } = render(
    <Gallery media={strip} alt="Tenis" optimized={false} />,
  );
  fireEvent.click(getByLabelText('Tenis, foto 2'));
  expect(getByTestId('zoom-stage')).toBeTruthy();
  expect(container.querySelector('.main img')?.getAttribute('src')).toBe('https://h/b.jpg');
});

// L4 #6 — the mobile requirement: a swipe on the stage changes the photo (the same stage serves the product and
// the sku galleries). A decisive horizontal drag steps active±1; a vertical drag is left to the page scroll.
test('a horizontal swipe on the stage steps the photo; a vertical drag does not', () => {
  const { getByTestId, container } = render(
    <Gallery media={strip} alt="Tenis" optimized={false} />,
  );
  const stage = getByTestId('gallery-stage');
  const src = () => container.querySelector('.main img')?.getAttribute('src');
  expect(src()).toBe('https://h/a.jpg');

  // swipe left → next photo
  fireEvent.touchStart(stage, { touches: [{ clientX: 200, clientY: 100 }] });
  fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 120, clientY: 108 }] });
  expect(src()).toBe('https://h/b.jpg');

  // swipe right → previous photo
  fireEvent.touchStart(stage, { touches: [{ clientX: 120, clientY: 100 }] });
  fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 210, clientY: 96 }] });
  expect(src()).toBe('https://h/a.jpg');

  // a mostly-vertical drag does not change the photo (the page keeps its scroll)
  fireEvent.touchStart(stage, { touches: [{ clientX: 150, clientY: 60 }] });
  fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 158, clientY: 200 }] });
  expect(src()).toBe('https://h/a.jpg');
});

test('a swipe at the first/last photo is clamped (no wrap-around)', () => {
  const { getByTestId, container } = render(
    <Gallery media={strip} alt="Tenis" optimized={false} />,
  );
  const stage = getByTestId('gallery-stage');
  const src = () => container.querySelector('.main img')?.getAttribute('src');
  // already at the first: swipe right stays put
  fireEvent.touchStart(stage, { touches: [{ clientX: 100, clientY: 100 }] });
  fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 200, clientY: 100 }] });
  expect(src()).toBe('https://h/a.jpg');
});

test('the video is a thumb: a real <a> to the video (no-JS), that plays on the stage when clicked', () => {
  const { getByTestId, queryByTestId } = render(
    <Gallery media={strip} alt="Tenis" optimized={false} />,
  );
  const thumb = getByTestId('gallery-video-thumb');
  expect(thumb.getAttribute('href')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  expect(queryByTestId('gallery-video')).toBeNull(); // not on the stage until asked

  fireEvent.click(thumb);
  const iframe = getByTestId('gallery-video').querySelector('iframe');
  expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  expect(queryByTestId('zoom-stage')).toBeNull(); // a video is not zoomable (VideoStage, no loupe wrapper)
});
