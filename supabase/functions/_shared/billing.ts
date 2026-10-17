import { AsyncLocalStorage } from "node:async_hooks";
import { adminClient } from "./supabase.ts";

type Scope = {
  storeId: string;
  messageKey: string;
  category?: string;
  reservation?: string;
};
const scope = new AsyncLocalStorage<Scope>();
export function withBilling<T>(value: Scope, work: () => Promise<T>) {
  return scope.run(value, work);
}
export async function reserveBilling(storeId: string, messageKey: string) {
  const { data, error } = await adminClient().rpc("billing_reserve_message", {
    p_store: storeId,
    p_key: messageKey,
  });
  if (error) {
    throw new Error(
      ["subscription_required", "upgrade_required", "message_limit_reached"]
        .find((code) => error.message.includes(code)) || "billing_check_failed",
    );
  }
  return String(data);
}
export async function paidStoreAllowed(storeId: string) {
  const { data, error } = await adminClient().rpc("billing_snapshot", {
    p_store: storeId,
    p_environment: "live",
  });
  if (error) throw new Error("billing_check_failed");
  return !data.enforcementEnabled ||
    (data.trialUntil && Date.parse(data.trialUntil) > Date.now()) ||
    (["ACTIVE", "PAST_DUE", "CANCELED"].includes(data.status) &&
      Date.parse(data.periodStart) <= Date.now() &&
      Date.parse(data.periodEnd) > Date.now());
}
export function billingStoreId() {
  return scope.getStore()?.storeId;
}
export async function recordScopedAiUsage(
  operation: string,
  model: string,
  response: Record<string, any>,
) {
  const id = billingStoreId();
  if (id) await recordAiUsage(id, operation, model, response);
}
export async function supportAllowed(storeId: string, admin = adminClient()) {
  const { data, error } = await admin.rpc("billing_snapshot", {
    p_store: storeId,
    p_environment: "live",
  });
  if (error) throw new Error("billing_check_failed");
  if (
    !data.enforcementEnabled ||
    (data.trialUntil && Date.parse(data.trialUntil) > Date.now())
  ) return true;
  return data.plan === "premium" &&
    Date.parse(data.periodStart) <= Date.now() &&
    ["ACTIVE", "PAST_DUE", "CANCELED"].includes(data.status) &&
    Date.parse(data.periodEnd) > Date.now();
}
export async function sendWithBilling<
  T extends { messages?: Array<{ id?: string }> },
>(send: () => Promise<T>): Promise<T> {
  const context = scope.getStore();
  if (!context) return send(); // Public Reload greeting and internal team alerts have no merchant allowance.
  const admin = adminClient();
  const reservation = context.reservation ||
    await reserveBilling(context.storeId, context.messageKey);
  const before = await admin.from("billing_message_usage").select(
    "external_message_id,state",
  ).eq("id", reservation).single();
  if (before.error) throw new Error("billing_check_failed");
  if (before.data.external_message_id) throw new Error("send_receipt_unknown");
  try {
    const result = await send();
    const external = result.messages?.[0]?.id;
    if (!external) throw new Error("send_receipt_unknown");
    const saved = await admin.from("billing_message_usage").update({
      external_message_id: external,
      category: context.category || "service",
    }).eq("id", reservation);
    if (saved.error) throw new Error("send_receipt_unknown");
    // Status callbacks can race ahead of receipt persistence; reconcile saved message status too.
    const { data: message } = await admin.from("whatsapp_messages").select(
      "status",
    ).eq("external_message_id", external).maybeSingle();
    if (message?.status) {
      await admin.rpc("billing_settle_message", {
        p_external: external,
        p_status: message.status,
      });
    }
    return result;
  } catch (error) {
    // A definite Graph rejection is safe to release; network/transport ambiguity must stay reserved.
    if (error instanceof Error && /^whatsapp_api_\d/.test(error.message)) {
      await admin.from("billing_message_usage").update({ state: "FAILED" }).eq(
        "id",
        reservation,
      ).is("external_message_id", null);
    }
    throw error;
  }
}
export async function recordAiUsage(
  storeId: string,
  operation: string,
  model: string,
  response: Record<string, any>,
) {
  const input = Number(response.prompt_eval_count || 0),
    output = Number(response.eval_count || 0);
  if (
    !Number.isSafeInteger(input) || !Number.isSafeInteger(output) ||
    input < 0 || output < 0
  ) return;
  const { error } = await adminClient().from("billing_cost_events").insert({
    store_id: storeId,
    provider: "ollama",
    operation,
    model,
    input_tokens: input,
    output_tokens: output,
    cost_basis: "UNPRICED",
  });
  if (error) console.error("billing_ai_usage_record_failed");
}
