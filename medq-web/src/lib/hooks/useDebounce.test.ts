/**
 * @file useDebounce.test.ts
 * @description Tests for useDebouncedValue and useDebouncedCallback hooks.
 */

import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue, useDebouncedCallback } from "./useDebounce";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("does not update immediately on value change", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "a", delay: 300 } }
    );

    rerender({ value: "b", delay: 300 });
    // Should still be old value before delay
    expect(result.current).toBe("a");
  });

  it("updates after delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "a", delay: 300 } }
    );

    rerender({ value: "b", delay: 300 });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe("b");
  });

  it("resets timer on rapid changes, only fires last", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "a", delay: 200 } }
    );

    rerender({ value: "b", delay: 200 });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: "c", delay: 200 });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Not enough time for "c" to resolve yet
    expect(result.current).toBe("a");

    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Now 200ms after "c" was set
    expect(result.current).toBe("c");
  });

  it("works with numbers", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 0, delay: 100 } }
    );

    rerender({ value: 42, delay: 100 });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current).toBe(42);
  });

  it("works with objects", () => {
    const obj1 = { x: 1 };
    const obj2 = { x: 2 };

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: obj1, delay: 100 } }
    );

    rerender({ value: obj2, delay: 100 });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current).toBe(obj2);
  });
});

describe("useDebouncedCallback", () => {
  it("does not fire immediately", () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 200));

    act(() => {
      result.current("arg");
    });

    expect(fn).not.toHaveBeenCalled();
  });

  it("fires after delay", () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 200));

    act(() => {
      result.current("arg");
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("arg");
  });

  it("only fires last invocation on rapid calls", () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 200));

    act(() => {
      result.current("a");
      result.current("b");
      result.current("c");
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("cleans up timer on unmount", () => {
    const fn = jest.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(fn, 200));

    act(() => {
      result.current("arg");
    });

    unmount();

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(fn).not.toHaveBeenCalled();
  });

  it("uses latest callback reference", () => {
    let latestValue = 0;
    const fn1 = jest.fn(() => latestValue);

    const { result, rerender } = renderHook(
      ({ cb, delay }) => useDebouncedCallback(cb, delay),
      { initialProps: { cb: fn1, delay: 200 } }
    );

    const fn2 = jest.fn(() => 999);
    rerender({ cb: fn2, delay: 200 });

    act(() => {
      result.current();
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Should use the latest callback (fn2)
    expect(fn2).toHaveBeenCalledTimes(1);
    expect(fn1).not.toHaveBeenCalled();
  });
});
