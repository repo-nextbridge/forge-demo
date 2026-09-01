// The delayed-spinner proof (fake timers): a response under the threshold shows NO indicator; one that
// outlives it flips the flag at exactly the threshold; clearing `active` resets it. This is the doctrine's
// "optimistic by default, spinner only if slow" made executable.

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useDelayedFlag } from './useDelayedFlag';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('a response under the threshold never raises the flag', () => {
  const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 1000), {
    initialProps: { active: true },
  });
  // 999ms in: still optimistic, no indicator.
  act(() => void vi.advanceTimersByTime(999));
  expect(result.current).toBe(false);
  // The mutation resolves at 999ms — active clears before the timer fires.
  rerender({ active: false });
  act(() => void vi.advanceTimersByTime(1000));
  expect(result.current).toBe(false);
});

test('a response that outlives the threshold raises the flag at exactly 1000ms', () => {
  const { result } = renderHook(() => useDelayedFlag(true, 1000));
  expect(result.current).toBe(false);
  act(() => void vi.advanceTimersByTime(999));
  expect(result.current).toBe(false);
  act(() => void vi.advanceTimersByTime(1));
  expect(result.current).toBe(true);
});

test('clearing active resets the flag (next mutation starts optimistic again)', () => {
  const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 1000), {
    initialProps: { active: true },
  });
  act(() => void vi.advanceTimersByTime(1000));
  expect(result.current).toBe(true);
  rerender({ active: false });
  expect(result.current).toBe(false);
});
