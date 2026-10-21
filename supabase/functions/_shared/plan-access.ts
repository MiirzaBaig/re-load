/** Shared entitlement decisions. Sandbox payments never appear in this live snapshot. */
export type AccessSnapshot = {
  enforcementEnabled?: boolean;
  trialUntil?: string | null;
  plan?: string | null;
  status?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
};

export function hasPaidPeriod(snapshot: AccessSnapshot, now = Date.now()) {
  return ["standard", "premium"].includes(snapshot.plan ?? "") &&
    ["ACTIVE", "PAST_DUE", "CANCELED"].includes(snapshot.status ?? "") &&
    Date.parse(snapshot.periodStart ?? "") <= now &&
    Date.parse(snapshot.periodEnd ?? "") > now;
}

export function planAccess(snapshot: AccessSnapshot | null, now = Date.now()) {
  const paid = snapshot ? hasPaidPeriod(snapshot, now) : false;
  return {
    support: Boolean(
      snapshot && (snapshot.enforcementEnabled === false ||
        Date.parse(snapshot.trialUntil ?? "") > now || paid),
    ),
    // Setup, pilot exceptions and sandbox billing must never enable new purchase actions.
    checkout: Boolean(paid && snapshot?.plan === "premium"),
    shipping: Boolean(paid && snapshot?.plan === "premium"),
  };
}
