import { env, json } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { verifyWhatsAppSignature } from "../_shared/whatsapp.ts";

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const valid = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === env("WHATSAPP_VERIFY_TOKEN");
    return valid ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 }) : json({ error: "verification_failed" }, 403);
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const rawBody = await request.text();
  try {
    if (!await verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256") ?? "")) return json({ error: "invalid_signature" }, 401);
    const payload = JSON.parse(rawBody);
    const admin = adminClient();
    for (const entry of payload.entry ?? []) for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const phoneNumberId = String(value.metadata?.phone_number_id ?? "");
      for (const status of value.statuses ?? []) {
        const next = String(status.status ?? "").toUpperCase();
        if (phoneNumberId === env("WHATSAPP_PHONE_NUMBER_ID") && ["SENT", "DELIVERED", "READ", "FAILED"].includes(next)) {
          const previous = next === "READ" ? ["SENT", "DELIVERED"] : next === "DELIVERED" ? ["SENT"] : next === "FAILED" ? ["SENT"] : ["SENT"];
          const { error } = await admin.from("whatsapp_messages").update({ status: next, failure_code: status.errors?.[0]?.code ? String(status.errors[0].code) : null }).eq("external_message_id", String(status.id ?? "")).in("status", previous);
          if (error) throw error;
        }
      }
      if (phoneNumberId === env("WHATSAPP_PHONE_NUMBER_ID")) for (const message of value.messages ?? []) {
        const sender = String(message.from ?? "").replace(/\D/g, "");
        if (!sender || !message.id) continue;
        const { error } = await admin.rpc("enqueue_whatsapp_message", { p_phone: phoneNumberId, p_sender: sender, p_message: message, p_name: value.contacts?.find((contact: { wa_id?: string }) => contact.wa_id === message.from)?.profile?.name ?? null });
        if (error) throw error;
      }
      if (phoneNumberId) await admin.from("whatsapp_connections").update({ last_webhook_at: new Date().toISOString() }).eq("phone_number_id", phoneNumberId);
    }
    return json({ received: true });
  } catch (error) {
    console.error("whatsapp_webhook_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "webhook_processing_failed" }, 500);
  }
});
