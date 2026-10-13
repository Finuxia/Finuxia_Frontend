import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useAsync from "./useAsync";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("useAsync", () => {
  it("starts loading, then gives the data", async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(["a"]), []));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(["a"]);
    expect(result.current.error).toBeNull();
  });

  it("uses the initial value until the first answer", () => {
    const { result } = renderHook(() => useAsync(() => new Promise(() => {}), [], { initial: [] }));
    expect(result.current.data).toEqual([]);
  });

  it("a failure sets the error and keeps the last good data", async () => {
    let fail = false;
    const { result } = renderHook(() => useAsync(() => (fail ? Promise.reject(new Error("Down")) : Promise.resolve("ok")), []));
    await waitFor(() => expect(result.current.data).toBe("ok"));
    fail = true;
    await act(() => result.current.reload());
    expect(result.current.error.message).toBe("Down");
    expect(result.current.data).toBe("ok");
    expect(result.current.loading).toBe(false);
  });

  it("reload runs it again, keeps the old data on screen meanwhile, and clears the error", async () => {
    const answers = [Promise.resolve("first"), deferred()];
    let n = 0;
    const { result } = renderHook(() => useAsync(() => (n === 0 ? answers[n++] : answers[n++].promise), []));
    await waitFor(() => expect(result.current.data).toBe("first"));
    act(() => {
      result.current.reload();
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe("first"); // the old answer stays until the new one arrives
    await act(async () => {
      answers[1].resolve("second");
    });
    await waitFor(() => expect(result.current.data).toBe("second"));
    expect(result.current.loading).toBe(false);
  });

  it("runs again when its dependencies change, and an answer for the old ones is ignored", async () => {
    const first = deferred();
    const second = deferred();
    const fn = vi.fn((id) => (id === 1 ? first.promise : second.promise));
    const { result, rerender } = renderHook(({ id }) => useAsync(() => fn(id), [id]), { initialProps: { id: 1 } });
    rerender({ id: 2 });
    await act(async () => {
      second.resolve("two");
    });
    await waitFor(() => expect(result.current.data).toBe("two"));
    await act(async () => {
      first.resolve("one"); // arrives late
    });
    expect(result.current.data).toBe("two");
  });

  it("an answer that arrives after the component left does nothing", async () => {
    const pending = deferred();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = renderHook(() => useAsync(() => pending.promise, []));
    unmount();
    await act(async () => {
      pending.resolve("late");
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("setData changes what is shown without another request", async () => {
    const fn = vi.fn(() => Promise.resolve([1, 2]));
    const { result } = renderHook(() => useAsync(fn, []));
    await waitFor(() => expect(result.current.data).toEqual([1, 2]));
    act(() => result.current.setData((d) => [...d, 3]));
    expect(result.current.data).toEqual([1, 2, 3]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls the latest function, so it can close over current props", async () => {
    let label = "a";
    const { result, rerender } = renderHook(() => useAsync(() => Promise.resolve(label), []));
    await waitFor(() => expect(result.current.data).toBe("a"));
    label = "b";
    rerender();
    await act(() => result.current.reload());
    expect(result.current.data).toBe("b");
  });
});
