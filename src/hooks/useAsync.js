import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Runs an async function when the component mounts and whenever `deps` change, and gives back what a page needs to show it:
 *
 *   const { data, loading, error, reload, setData } = useAsync(() => api.getGuides(), []);
 *
 * It replaces the effect, loading flag, error flag and "ignore the answer if we left" guard that pages kept writing out by hand:
 *  - an answer that arrives after the component left, or after `deps` changed (so a newer request is under way), is ignored;
 *  - `loading` is true from the start, so the first render never shows an empty state before the request begins;
 *  - `reload()` runs it again (the old data stays on screen until the new answer arrives); `setData` changes the shown data locally, after an edit.
 *
 * A failed call sets `error` and keeps the last good `data`. The function is read when it runs, so it may close over props and state.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {unknown[]} deps
 * @param {{ initial?: T | null }} [options]
 */
export default function useAsync(fn, deps, { initial = null } = {}) {
  const [state, setState] = useState({ data: initial, loading: true, error: null });
  const run = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const start = useCallback(async () => {
    const id = ++run.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (id === run.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (id === run.current) setState((s) => ({ ...s, loading: false, error }));
    }
  }, []);

  useEffect(() => {
    start();
    return () => {
      run.current += 1; // anything still in flight is now stale
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-runs when the caller's deps change; `start` is stable and reads the latest fn through a ref
  }, deps);

  const setData = useCallback((next) => setState((s) => ({ ...s, data: typeof next === "function" ? next(s.data) : next })), []);
  return { ...state, reload: start, setData };
}
