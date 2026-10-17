import { StreamProvider } from "./stream-provider.ts";
import { type BillingInterval, providerInterval } from "./billing-contract.ts";

export function pendingMatches(
  pending: Record<string, any>,
  productId: string,
  interval: BillingInterval,
) {
  return pending.target_items?.length === 1 &&
    pending.target_items[0].product_id === productId &&
    pending.target_items[0].quantity === 1 &&
    pending.target_recurring_interval === providerInterval(interval) &&
    pending.target_recurring_interval_count === 1 &&
    pending.target_subscription_coupon_ids?.length === 0;
}
/** Stream refuses PUT while a change is pending, even if it is an identical retry. */
export async function scheduleStreamChange(
  provider: StreamProvider,
  id: string,
  productId: string,
  interval: BillingInterval,
  replace = false,
  current?: Record<string, any>,
) {
  const subscription = current ||
    await provider.request(`/subscriptions/${id}`);
  if (subscription.pending_change) {
    if (pendingMatches(subscription.pending_change, productId, interval)) {
      return subscription;
    }
    if (!replace) throw new Error("scheduled_change_requires_review");
    await provider.request(`/subscriptions/${id}/pending-change`, "DELETE");
  }
  const result = await provider.request(`/subscriptions/${id}`, "PUT", {
    items: [{ product_id: productId, quantity: 1 }],
    coupons: [],
    recurring_interval: providerInterval(interval),
    recurring_interval_count: 1,
  });
  if (
    !result.pending_change ||
    !pendingMatches(result.pending_change, productId, interval)
  ) throw new Error("scheduled_change_not_confirmed");
  return result;
}
