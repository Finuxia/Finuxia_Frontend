/**
 * Whether to offer "I don't plan to continue": only while the account has a plan and access that is running and has an end to speak of.
 * An account whose access does not end has nothing to decide; after the end the way back is to buy again; staff are never cut off by an
 * end, so for them a lapsed state is not offered either. The server decides all of it (`billing.access`, from GET /api/billing/me); each
 * condition stands on its own.
 * @param {{ plan?: object | null, access?: { valid?: boolean, endsAt?: string | null, status?: string } | null } | null | undefined} billing
 */
export function canStateIntent(billing) {
  const access = billing?.access;
  return Boolean(billing?.plan && access && access.valid && access.endsAt && (access.status === "valid" || access.status === "lapsing"));
}
