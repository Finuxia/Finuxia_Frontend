import { useEffect, useState } from "react";

/** Seconds left of a wait that started now (null/0 = nothing to wait for); ticks once a second and stops at 0. */
export default function useCountdown(seconds) {
  const [left, setLeft] = useState(seconds || 0);
  useEffect(() => {
    setLeft(seconds || 0);
    if (!seconds) return undefined;
    const started = Date.now();
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil(seconds - (Date.now() - started) / 1000));
      setLeft(remaining);
      if (remaining === 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [seconds]);
  return left;
}
