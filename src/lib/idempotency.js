// One Idempotency-Key per purchase ATTEMPT, reused when that attempt is retried.
//
// The server remembers a key for 24 hours and answers a repeat with the original response, so a
// double click or a retry after a slow reply can't create a second pending payment. A key must
// therefore be kept while the outcome of an attempt is unknown (network error, 5xx, "still in
// progress") and dropped once it is settled, so the next purchase is a new attempt.

export function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Very old browsers: 128 random bits as hex is just as unguessable.
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** True when the outcome of the request is unknown, i.e. the same key should be used to retry. */
export function isRetryable(error) {
  const status = error?.status;
  return status === undefined || status === 0 || status === 409 || status >= 500;
}

/**
 * Keeps one key per attempt id (e.g. a plan id). `keyFor(id)` returns the attempt's existing key
 * or mints one; `settle(id)` forgets it.
 */
export function createAttemptKeys() {
  const keys = new Map();
  return {
    keyFor(id) {
      if (!keys.has(id)) keys.set(id, newIdempotencyKey());
      return keys.get(id);
    },
    settle(id) {
      keys.delete(id);
    },
  };
}
