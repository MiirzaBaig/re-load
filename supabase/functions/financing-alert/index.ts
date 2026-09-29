import { sha256 } from "../_shared/crypto.ts";
import { json } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { sendWhatsAppText, sentMessageId } from "../_shared/whatsapp.ts";

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)
    : "—";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let eventId: string | null = null;
  try {
    const body = await request.json();
    const requestId = typeof body?.requestId === "string"
      ? body.requestId
      : typeof body?.record?.id === "string"
      ? body.record.id
      : "";
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(requestId)) return json({ error: "invalid_request" }, 400);

    const admin = adminClient();
    const externalEventId = `financing-alert:${requestId}`;
    const { data: claimed, error: claimError } = await admin.from("integration_events").insert({
      provider: "whatsapp",
      external_event_id: externalEventId,
      event_type: "FINANCING_REQUEST_ALERT",
      payload_digest: await sha256(requestId),
      status: "PROCESSING",
      attempts: 1,
    }).select("id").maybeSingle();
    if (claimError?.code === "23505") return json({ received: true, duplicate: true });
    if (claimError || !claimed) throw claimError ?? new Error("alert_claim_failed");
    eventId = claimed.id;

    const { data: lead, error: leadError } = await admin.from("financing_requests")
      .select("store_name, contact_name, email, phone, tied_up_amount, operating_cost")
      .eq("id", requestId).maybeSingle();
    if (leadError || !lead) throw leadError ?? new Error("financing_request_not_found");

    const message = [
      "New Reload financing request",
      "",
      `Store: ${lead.store_name}`,
      `Contact: ${lead.contact_name}`,
      `Email: ${lead.email}`,
      `Phone: ${lead.phone || "Not provided"}`,
      `Tied-up value: SAR ${money(lead.tied_up_amount)}`,
      `Operating cost: SAR ${money(lead.operating_cost)} / month`,
    ].join("\n");

    const result = await sendWhatsAppText(Deno.env.get("WHATSAPP_ALERT_RECIPIENT") ?? "", message);
    await admin.from("integration_events").update({
      status: "PROCESSED",
      processed_at: new Date().toISOString(),
      last_error: null,
    }).eq("id", eventId);
    return json({ sent: true, messageId: sentMessageId(result) });
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 180) : "unknown";
    console.error("financing_whatsapp_alert_failed", reason);
    if (eventId) {
      await adminClient().from("integration_events").update({
        status: "FAILED",
        last_error: reason,
        processed_at: new Date().toISOString(),
      }).eq("id", eventId);
    }
    // The database trigger is asynchronous, so this response can never roll
    // back the financing request. A non-2xx response still makes failure clear
    // in function logs and pg_net response history.
    return json({ error: "alert_delivery_failed" }, 502);
  }
});
