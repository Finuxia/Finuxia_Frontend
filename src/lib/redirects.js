/**
 * Where to send someone after they log in: the page ProtectedRoute bounced them from (`location.state.from`),
 * with its query string and hash, or the dashboard. Only an in-app path is accepted.
 */
export function destinationAfterLogin(location, fallback = "/dashboard") {
  const from = location?.state?.from;
  const path = from?.pathname;
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path === "/login") return fallback;
  return `${path}${from.search || ""}${from.hash || ""}`;
}
