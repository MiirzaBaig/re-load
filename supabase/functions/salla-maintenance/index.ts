import { json } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { sallaAccessToken } from "../_shared/salla.ts";
Deno.serve(async (request) => {
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405);
  try {
    const { ticket } = await request.json();
    if (typeof ticket !== "string" || !/^[0-9a-f-]{36}$/i.test(ticket))
      return json({ error: "invalid_ticket" }, 403);
    const admin = adminClient();
    const allowed = await admin.rpc("consume_whatsapp_worker_ticket", {
      p_ticket: ticket,
    });
    if (allowed.error || !allowed.data)
      return json({ error: "invalid_ticket" }, 403);
    const { data, error } = await admin.rpc("salla_stores_due_refresh");
    if (error) throw error;
    let checked = 0;
    for (const store of data ?? []) {
      try {
        await sallaAccessToken(store.store_id);
        checked++;
      } catch (error) {
        console.error(
          "salla_renewal_failed",
          store.store_id,
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
    return json({ checked });
  } catch (error) {
    console.error(
      "salla_maintenance_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return json({ error: "maintenance_failed" }, 500);
  }
});
