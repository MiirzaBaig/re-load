import { corsHeaders, json } from "../_shared/http.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";
import { sendWhatsAppText } from "../_shared/whatsapp.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const client = userClient(request.headers.get("Authorization") ?? "");
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: "authentication_required" }, 401);
    const { reportId, status } = await request.json();
    if (typeof reportId !== "string" || !["REVIEWING", "PLANNED", "RESOLVED", "CLOSED"].includes(status)) return json({ error: "invalid_update" }, 400);
    const { data: report } = await client.from("product_reports").select("id,store_id,conversation_id,report_type,status").eq("id", reportId).maybeSingle();
    if (!report) return json({ error: "report_not_found" }, 404);
    const { data: membership } = await client.from("memberships").select("role").eq("store_id", report.store_id).eq("user_id", user.id).in("role", ["owner", "admin"]).maybeSingle();
    if (!membership) return json({ error: "insufficient_permission" }, 403);
    const admin = adminClient();
    const { error } = await admin.from("product_reports").update({ status, updated_at: new Date().toISOString(), resolved_at: status === "RESOLVED" ? new Date().toISOString() : null }).eq("id", reportId);
    if (error) throw error;
    let notified = false;
    if (status === "RESOLVED" && report.status !== "RESOLVED" && report.conversation_id) {
      const { data: conversation } = await admin.from("whatsapp_conversations").select("language,whatsapp_contacts!inner(wa_id)").eq("id", report.conversation_id).maybeSingle();
      const contact = Array.isArray(conversation?.whatsapp_contacts) ? conversation.whatsapp_contacts[0] : conversation?.whatsapp_contacts;
      if (contact?.wa_id) {
        const ref = `RL-${report.id.slice(0, 8).toUpperCase()}`;
        await sendWhatsAppText(contact.wa_id, conversation?.language === "en" ? `Update on ${ref}: the Reload team has marked this ${report.report_type === "BUG" ? "problem" : "feedback item"} as resolved. Thank you for helping us improve.` : `تحديث على ${ref}: تم حل ${report.report_type === "BUG" ? "المشكلة" : "الملاحظة"} من فريق ريلود. شكرًا لأنك ساعدتنا نطوّر التجربة.`);
        notified = true;
      }
    }
    return json({ status, notified });
  } catch (error) {
    console.error("product_report_update_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "report_update_failed" }, 500);
  }
});
