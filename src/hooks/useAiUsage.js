import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

/**
 * The advisor's AI usage for the current billing period. `refresh()` after an AI call to update it. The usage view is a courtesy to the page that
 * embeds it, so a failure to load it is reported in `error` and never thrown: the page keeps working without it.
 */
export default function useAiUsage() {
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await api.getAiUsage();
      if (!mounted.current) return;
      setUsage(next);
      setError(false);
    } catch {
      if (mounted.current) setError(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { usage, error, refresh };
}
