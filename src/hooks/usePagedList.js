import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

/**
 * A long list shown a page at a time: the first page when it mounts, and `loadMore()` for the next, so opening the page does not wait for
 * everything the account has.
 *
 *   const { items, loading, loadingMore, hasMore, loadMore, error, reload, setItems } = usePagedList("/api/tickets");
 *   {hasMore && <button onClick={loadMore} disabled={loadingMore}>Load more</button>}
 *
 * - `params` (filters, sort) are part of the request; when they change the list starts again from the first page.
 * - An answer that arrives after the component left, or after the params changed, is ignored.
 * - A failed `loadMore` keeps what is already shown and reports the error; calling it again retries that page.
 * - `setItems` changes the shown items locally (after an edit) without another request.
 */
export default function usePagedList(path, params = {}) {
  const [state, setState] = useState({ items: [], cursor: null, hasMore: false, loading: true, loadingMore: false, error: null });
  const run = useRef(0);
  const stateRef = useRef(state);
  const fetching = useRef(false);
  stateRef.current = state;
  const paramsKey = JSON.stringify(params);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const loadFirst = useCallback(async () => {
    const id = ++run.current;
    fetching.current = false;
    setState((s) => ({ ...s, loading: true, loadingMore: false, error: null }));
    try {
      const { results, nextCursor } = await api.getPage(path, paramsRef.current);
      if (id === run.current)
        setState({ items: results, cursor: nextCursor, hasMore: Boolean(nextCursor), loading: false, loadingMore: false, error: null });
    } catch (error) {
      if (id === run.current) setState((s) => ({ ...s, loading: false, error }));
    }
  }, [path]);

  useEffect(() => {
    loadFirst();
    return () => {
      run.current += 1;
    };
  }, [loadFirst, paramsKey]); // a change of params (compared by value) starts the list again; loadFirst reads the latest params from a ref

  const loadMore = useCallback(async () => {
    const { cursor, hasMore } = stateRef.current;
    if (!hasMore || !cursor || fetching.current) return;
    const id = run.current;
    fetching.current = true;
    setState((s) => ({ ...s, loadingMore: true, error: null }));
    try {
      const { results, nextCursor } = await api.getPage(path, { ...paramsRef.current, cursor });
      if (id !== run.current) return;
      setState((s) => ({ ...s, items: [...s.items, ...results], cursor: nextCursor, hasMore: Boolean(nextCursor), loadingMore: false }));
    } catch (error) {
      if (id === run.current) setState((s) => ({ ...s, loadingMore: false, error }));
    } finally {
      fetching.current = false;
    }
  }, [path]);

  const setItems = useCallback((next) => setState((s) => ({ ...s, items: typeof next === "function" ? next(s.items) : next })), []);

  return { ...state, loadMore, reload: loadFirst, setItems };
}
