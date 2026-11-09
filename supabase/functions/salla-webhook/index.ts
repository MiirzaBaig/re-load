import { encrypt, sha256, verifySallaSignature } from "../_shared/crypto.ts";
import { handleSallaEasy } from "../_shared/salla-easy.ts";
import { env, json } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  const signature = request.headers.get("X-Salla-Signature") ?? "";

  try {
    const easy = await handleSallaEasy(request.clone(), {
      secret: env("SALLA_WEBHOOK_SECRET"),
      encrypt,
      identity: async (token) => {
        const response = await fetch(
          "https://accounts.salla.sa/oauth2/user/info",
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(10_000),
            redirect: "error",
          },
        );
        if (!response.ok) throw Error("identity_unavailable");
        const result = await response.json();
        const data = result.data ?? result;
        const merchant = data.merchant ?? data.store;
        if (!merchant?.id) throw Error("identity_unavailable");
        return {
          id: String(merchant.id),
          name: String(merchant.name ?? "Salla Store"),
        };
      },
      apply: async (event) => {
        const { error } = await adminClient().rpc("salla_easy_apply", {
          p_digest: event.digest,
          p_merchant: event.merchant,
          p_event: event.event,
          p_occurred: event.occurredAt,
          p_code_hash: event.codeHash,
          p_access: event.access,
          p_refresh: event.refresh,
          p_expires: event.expiresAt,
          p_scopes: event.scopes,
          p_name: event.name,
        });
        if (error) throw Error("event_save_failed");
      },
    });
    if (easy) return easy;
    const rawBody = await request.text();
    if (
      !await verifySallaSignature(
        rawBody,
        signature,
        env("SALLA_WEBHOOK_SECRET"),
      )
    ) {
      return json({ error: "invalid_signature" }, 401);
    }

    const payload = JSON.parse(rawBody);
    const eventType = String(payload.event ?? payload.type ?? "unknown");
    const merchantId = String(
      payload.merchant ?? payload.merchant_id ?? payload.data?.merchant_id ??
        "",
    );
    const digest = await sha256(rawBody);
    const externalEventId = String(payload.id ?? payload.event_id ?? digest);
    const admin = adminClient();
    let storeId: string | null = null;

    if (merchantId) {
      const { data: connection } = await admin
        .from("commerce_connections")
        .select("id, store_id")
        .eq("platform", "salla")
        .eq("external_store_id", merchantId)
        .maybeSingle();
      storeId = connection?.store_id ?? null;

      if (
        connection &&
        ["app.store.uninstalled", "app.uninstalled"].includes(eventType)
      ) {
        await admin.from("commerce_connections").update({
          status: "REVOKED",
          updated_at: new Date().toISOString(),
        }).eq("id", connection.id);
      }
    }

    if (storeId && /^(order|product)\./.test(eventType) && payload.data) {
      const data = payload.data;
      const resourceId = String(
        data.product_id ?? data.order_id ?? data.id ?? "",
      );
      if (resourceId) {
        const parsed = new Date(
          String(payload.created_at ?? "").replace(" ", "T"),
        );
        const changedAt = Number.isNaN(parsed.getTime())
          ? new Date().toISOString()
          : parsed.toISOString();
        const snapshot: Record<string, unknown> = { event: eventType };
        if (typeof data.name === "string") {
          snapshot.name = data.name.slice(0, 160);
        }
        if (typeof data.status === "string") snapshot.status = data.status;
        else if (typeof data.status?.slug === "string") {
          snapshot.status = data.status.slug;
        }
        if (typeof data.quantity === "number") {
          snapshot.quantity = data.quantity;
        }
        if (typeof data.price?.amount === "number") {
          snapshot.price = data.price.amount;
        }
        const applied = await admin.rpc("apply_salla_resource_event", {
          p_store: storeId,
          p_event_id: externalEventId,
          p_event: eventType,
          p_digest: digest,
          p_resource_type: eventType.startsWith("order.") ? "order" : "product",
          p_resource_id: resourceId,
          p_snapshot: snapshot,
          p_deleted: eventType.endsWith(".deleted"),
          p_changed_at: changedAt,
        });
        if (applied.error) throw applied.error;
        return json({ received: true });
      }
    }

    const { error } = await admin.from("integration_events").upsert({
      store_id: storeId,
      provider: "salla",
      external_event_id: externalEventId,
      event_type: eventType,
      payload_digest: digest,
      status: storeId ? "PROCESSED" : "IGNORED",
      attempts: 1,
      processed_at: new Date().toISOString(),
    }, { onConflict: "provider,external_event_id", ignoreDuplicates: true });
    if (error) throw error;

    return json({ received: true });
  } catch (error) {
    console.error("salla_webhook_failed");
    return json({ error: "webhook_processing_failed" }, 500);
  }
});
