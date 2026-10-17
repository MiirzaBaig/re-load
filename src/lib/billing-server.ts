import "server-only";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { StreamProvider } from "../../supabase/functions/_shared/stream-provider";
import type { BillingEnvironment } from "../../supabase/functions/_shared/billing-contract";

export function billingEnvironment(): BillingEnvironment {
  return process.env.STREAM_BILLING_ENV === "live" ? "live" : "sandbox";
}
export function billingAdmin() {
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !url) throw new Error("billing_not_configured");
  return createAdmin(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function streamProvider() {
  const sandbox = billingEnvironment() === "sandbox";
  if (!sandbox && process.env.STREAM_LIVE_BILLING_ENABLED !== "true")
    throw new Error("live_billing_not_enabled");
  return new StreamProvider(
    sandbox
      ? process.env.STREAM_SANDBOX_X_API_KEY || ""
      : process.env.STREAM_X_API_KEY || "",
  );
}
export async function billingMember(storeId: unknown, write = false) {
  if (typeof storeId !== "string" || !/^[0-9a-f-]{36}$/i.test(storeId))
    return null;
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client
    .from("memberships")
    .select("role")
    .eq("store_id", storeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data || (write && !["owner", "admin"].includes(data.role)))
    return null;
  return { client, user, role: data.role as string, storeId };
}
export function billingOrigin(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") !== origin)
    throw new Error("invalid_origin");
}
