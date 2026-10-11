import { json } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { handleMessage } from "../_shared/whatsapp-journey.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const { ticket } = await request.json();
    if (typeof ticket !== "string" || !/^[0-9a-f-]{36}$/i.test(ticket)) return json({ error: "invalid_ticket" }, 403);
    const admin = adminClient();
    const { data: allowed, error: ticketError } = await admin.rpc("consume_whatsapp_worker_ticket", { p_ticket: ticket });
    if (ticketError || !allowed) return json({ error: "invalid_ticket" }, 403);
    let processed = 0;
    for (let index = 0; index < 3; index++) {
      const { data, error } = await admin.rpc("claim_whatsapp_inbox");
      if (error) throw error;
      const job = data?.[0];
      if (!job) break;
      try {
        await handleMessage(job.phone_id, job.message, job.profile_name ?? undefined, job.reply ?? undefined, job.accepted_result ?? undefined);
        const finished = await admin.rpc("finish_whatsapp_inbox", { p_id: job.id });
        if (finished.error) throw finished.error;
        processed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown";
        // A timeout/transport failure could happen after Meta accepted a send.
        // Retrying those automatically risks duplicate customer messages.
        const uncertain = message === "send_receipt_unknown";
        const failed = await admin.rpc("finish_whatsapp_inbox", { p_id: job.id, p_error: message.slice(0, 180), p_uncertain: uncertain });
        if (failed.error) throw failed.error;
        await admin.from("integration_events").update({ status: "FAILED", last_error: message.slice(0, 180) }).eq("provider", "whatsapp").eq("external_event_id", job.id);
        console.error("whatsapp_inbox_failed", job.id, message);
      }
    }
    return json({ processed });
  } catch (error) {
    console.error("whatsapp_inbox_worker_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "worker_failed" }, 500);
  }
});
