// Everything this app caches in the browser (client list, calendar events, tasks, groups...) is namespaced "advisorpilot." and is wiped on logout or
// session expiry, so the next person at a shared computer cannot read the previous advisor's client data.
//
// Wiping is not enough on its own. Logout clears the browser's copy FIRST and drops the signed-in account a moment later, and the app's effects keep
// writing the cache from whatever account they last rendered with. A write landing in that gap put the advisor's client list straight back into local
// storage after logout had reported success (TEST-12 / DATA-13). So clearing also CLOSES the cache: every write goes through `writeLocal`, which refuses
// until somebody signs in again (`allowLocalData`, called whenever an account is loaded).
let open = true;

export function clearLocalData() {
  open = false;
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("advisorpilot."))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore storage errors
  }
}

/** A signed-in account exists again: the cache may be written. */
export function allowLocalData() {
  open = true;
}

/** Writes one cache entry, unless logout has closed the cache. Storage errors (quota, private mode) are swallowed: the live data still works. */
export function writeLocal(key, value) {
  if (!open) return false;
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
