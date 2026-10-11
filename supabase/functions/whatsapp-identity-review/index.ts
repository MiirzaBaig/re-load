import { corsHeaders, env, json } from "../_shared/http.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";
import { sendWhatsAppButtons, sentMessageId } from "../_shared/whatsapp.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const client = userClient(authorization);
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: "authentication_required" }, 401);
    const { reviewId, action, verifier, confirmedIdentity, reviewNote } = await request.json();
    if (typeof reviewId !== "string" || !["approve", "decline"].includes(action)) return json({ error: "invalid_request" }, 400);
    // RLS permits only owners/admins of this review's store to read it.
    const { data: review, error: reviewError } = await client.from("identity_reviews").select("*").eq("id", reviewId).maybeSingle();
    if (reviewError || !review) return json({ error: "not_authorized" }, 403);
    if (review.status !== "PENDING") return json({ error: "already_reviewed" }, 409);
    const admin = adminClient();
    let facts = null;
    if (action === "approve") {
      if (confirmedIdentity !== true || typeof verifier !== "string" || !verifier.trim() || typeof reviewNote !== "string" || reviewNote.trim().length < 5 || reviewNote.length > 500) return json({ error: "identity_confirmation_required" }, 400);
      const { data: store } = await admin.from("stores").select("return_code").eq("id", review.store_id).single();
      const key = Deno.env.get("SUPABASE_SECRET_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY");
      // Merchant supplies the contact recorded on this order after independently
      // checking the requester. Never pass the order/token back to the browser.
      const response = await fetch(`${env("SUPABASE_URL")}/functions/v1/salla-order-lookup`, {
        method: "POST", headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ returnCode: store?.return_code, orderNumber: review.order_number, verifier: verifier.trim() }),
        signal: AbortSignal.timeout(25000),
      });
      const lookup = await response.json();
      if (!response.ok || !lookup.order?.items?.length) return json({ error: "order_not_verified" }, 422);
      facts = { ...lookup.order, _verificationContact: verifier.trim() };
    }
    const { data: resolved, error } = await admin.rpc("resolve_identity_review", { p_id: review.id, p_actor: user.id, p_facts: facts, p_note: typeof reviewNote === "string" ? reviewNote.trim() : null });
    if (error) throw error;
    if (!resolved) return json({ error: "already_reviewed" }, 409);
    let notification: "sent" | "failed" | "outside_window" = "outside_window";
    const { data: conversation } = await admin.from("whatsapp_conversations").select("language,service_window_expires_at").eq("id", review.conversation_id).single();
    if (conversation && new Date(conversation.service_window_expires_at).getTime() > Date.now()) {
      const ar = conversation.language !== "en";
      const body = action === "approve"
        ? ar ? "تم التحقق من هويتك لدى المتجر ✅\nنقدر الآن نكمل طلب الإرجاع. اضغط «متابعة»." : "The store has verified your identity ✅\nWe can continue your return now. Tap Continue."
        : ar ? "المتجر ما قدر يؤكد هويتك لهذا الطلب. تواصل معه للتحقق من بيانات الطلب." : "The store couldn’t confirm your identity for this order. Please contact them to check your order details.";
      try {
        const sent = await sendWhatsAppButtons(review.requester_phone, body, [{ id: "identity_status", title: ar ? "متابعة" : "Continue" }]);
        const { error: messageError } = await admin.from("whatsapp_messages").insert({ store_id: review.store_id, conversation_id: review.conversation_id, external_message_id: sentMessageId(sent), direction: "OUTBOUND", message_type: "INTERACTIVE", body, status: "SENT" });
        if (messageError) throw messageError;
        notification = "sent";
      } catch (error) {
        notification = "failed";
        console.error("identity_notification_failed", error instanceof Error ? error.message : "unknown");
      }
    }
    return json({ resolved: true, notification });
  } catch (error) {
    console.error("identity_review_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "identity_review_unavailable" }, 503);
  }
});
