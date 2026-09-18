// What the demonstration ribbon PROMISES — the three things that are easy to break in silence: the sentence
// is there with no JavaScript, the reveal waits exactly one beat, and nothing here asks a visitor anything.

import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_HREF, DemoRibbon, RIBBON_MARK, ribbonLang } from './ribbon';

/** The observers this render created, so a test can hand one an entry and watch what follows. */
let observers: FakeIntersectionObserver[] = [];

class FakeIntersectionObserver {
  callback: IntersectionObserverCallback;
  targets: Element[] = [];
  disconnected = false;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    observers.push(this);
  }
  observe(el: Element) {
    this.targets.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

/** "It scrolled into view" — the one event this component listens for. */
function scrollIntoView() {
  for (const observer of observers) {
    act(() => {
      observer.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer as unknown as IntersectionObserver,
      );
    });
  }
}

beforeEach(() => {
  observers = [];
  vi.useFakeTimers();
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('demo ribbon', () => {
  it('★★ says it in the language the front ships in, and in PORTUGUESE for anything it does not know', () => {
    // ⚠️ The subtag, not the tag: `pt-BR` and `pt` are the same shop, and a front that sends the region would
    // otherwise fall through to the default by accident rather than by rule.
    expect(ribbonLang('pt-BR')).toBe('pt');
    expect(ribbonLang('en-GB')).toBe('en');
    expect(ribbonLang('es')).toBe('es');
    // A notice in the wrong language still warns; a missing notice does not.
    expect(ribbonLang(undefined)).toBe('pt');
    expect(ribbonLang('de')).toBe('pt');
  });

  it('★★★ with NO OBSERVER the sentence is simply there — arming is what hides it, and it never happens', () => {
    // ⛔ THE ORDER IS THE POINT, AND THIS IS THE STATE THAT PROVES IT. The server renders the bar visible; the
    // client ARMS it (which hides it) and the observer is what brings it back. So a browser with no
    // `IntersectionObserver` — and, by the same token, a page with the bundle never running at all — must end
    // VISIBLE. A component that armed first and looked for an observer second would hide this notice forever
    // on exactly those clients, and nothing on the screen would say so.
    vi.stubGlobal('IntersectionObserver', undefined);
    const { container } = render(<DemoRibbon locale="pt-BR" />);
    const bar = container.querySelector(`[data-testid="${RIBBON_MARK}"]`);
    expect(bar).toBeTruthy();
    expect(bar?.textContent).toContain('nada será cobrado ou entregue');
    expect(bar?.getAttribute('data-armed')).toBeNull();
    expect(bar?.getAttribute('data-revealed')).toBeNull();
  });

  it('★★ ONE BEAT, AND IT IS 1000 ms — measured by the clock, never by reading the source', () => {
    // ★ The owner's correction, and the reason it is asserted rather than commented: at two seconds a visitor
    // who had scrolled to the footer was no longer looking at it. A test that only checked "it reveals
    // eventually" would go green on any delay at all, which is the number this line exists to hold.
    render(<DemoRibbon locale="pt-BR" />);
    const bar = screen.getByTestId(RIBBON_MARK);
    expect(bar.getAttribute('data-armed')).toBe('true');
    expect(bar.getAttribute('data-revealed')).toBeNull();

    scrollIntoView();
    // 999 ms in: still hidden. This half is what makes the number a measurement and not a rounding.
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(bar.getAttribute('data-revealed')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(bar.getAttribute('data-revealed')).toBe('true');
  });

  it('★ the beat does not start until it SCROLLS into view — the bar sits below the fold', () => {
    render(<DemoRibbon locale="pt-BR" />);
    const bar = screen.getByTestId(RIBBON_MARK);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(bar.getAttribute('data-revealed')).toBeNull();
    expect(observers).toHaveLength(1);
  });

  it('★ it reveals ONCE — the observer is let go the first time it fires', () => {
    render(<DemoRibbon locale="en" />);
    scrollIntoView();
    expect(observers[0]?.disconnected).toBe(true);
  });

  it('⛔ it asks NOTHING and dismisses NOTHING — no cookie, no form, no way back to a gate', () => {
    // ⛔ THE WHOLE POINT OF THIS SLICE. The bar this one is descended from was a `<form>` whose submit cleared
    // a dismissal cookie and brought a full-screen interstitial back. None of that machinery came along: the
    // block is a notice, and a notice that can be dismissed is a notice a visitor never sees again.
    const { container } = render(<DemoRibbon locale="pt-BR" />);
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(document.cookie).toBe('');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe(DEMO_HREF);
    // A new tab: the sentence is about the shop the visitor is standing in, and sending them away from it to
    // read about the product is the one thing this bar must not do.
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });
});
