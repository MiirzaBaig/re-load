import { corsHeaders, env, json } from "../_shared/http.ts";
import {
  extractKnowledge,
  knowledgeCategories,
  readKnowledgePage,
} from "../_shared/knowledge-import.ts";
import { sha256 } from "../_shared/crypto.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405);
  try {
    const client = userClient(request.headers.get("Authorization") ?? "");
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return json({ error: "authentication_required" }, 401);
    const body = await request.json();
    const { data: member } = await client
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("store_id", body.storeId)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (!member) return json({ error: "insufficient_permission" }, 403);
    const admin = adminClient();
    const now = new Date().toISOString();
    if (body.action === "knowledge_import") {
      if (
        !["URL", "TEXT"].includes(body.sourceType) ||
        typeof body.source !== "string" ||
        body.source.length > 30000 ||
        body.source.trim().length < 10
      )
        return json({ error: "invalid_source" }, 400);
      const { count, error: limitError } = await admin
        .from("audit_events")
        .select("id", { count: "exact", head: true })
        .eq("store_id", body.storeId)
        .eq("event_type", "knowledge.import.started")
        .gte("created_at", new Date(Date.now() - 3600000).toISOString());
      if (limitError) throw limitError;
      if ((count ?? 0) >= 8) return json({ error: "import_rate_limit" }, 429);
      const started = await admin
        .from("audit_events")
        .insert({
          store_id: body.storeId,
          actor_user_id: user.id,
          event_type: "knowledge.import.started",
          entity_type: "store_knowledge",
        });
      if (started.error) throw started.error;
      try {
        const source =
          body.sourceType === "URL"
            ? await readKnowledgePage(body.source)
            : { text: body.source.trim(), url: null };
        const extracted = await extractKnowledge(source.text);
        if (!extracted.entries.length)
          return json({
            created: 0,
            ids: [],
            warnings: extracted.warnings,
            empty: true,
          });
        const rows = await Promise.all(
          extracted.entries.map(async (entry) => ({
            ...entry,
            store_id: body.storeId,
            published: false,
            approved_by: null,
            source_type: body.sourceType,
            source_url: source.url,
            source_hash: await sha256(
              `${source.url ?? "pasted-text"}:${entry.language}:${entry.title}:${entry.source_excerpt}`,
            ),
          })),
        );
        const saved = await admin
          .from("store_knowledge")
          .upsert(rows, {
            onConflict: "store_id,source_hash",
            ignoreDuplicates: true,
          })
          .select("id");
        if (saved.error) throw saved.error;
        return json({
          created: saved.data.length,
          ids: saved.data.map((row) => row.id),
          warnings: extracted.warnings,
          duplicates: rows.length - saved.data.length,
        });
      } catch (error) {
        const code = error instanceof Error ? error.message : "import_failed";
        console.error("knowledge_import_failed", code);
        return json(
          {
            error: [
              "unsafe_source",
              "source_unreadable",
              "source_too_large",
              "extraction_unavailable",
              "invalid_import",
            ].includes(code)
              ? code
              : "import_failed",
          },
          422,
        );
      }
    }
    if (body.action === "knowledge_save") {
      if (
        typeof body.title !== "string" ||
        !body.title.trim() ||
        body.title.length > 160 ||
        typeof body.content !== "string" ||
        !body.content.trim() ||
        body.content.length > 6000 ||
        !knowledgeCategories.includes(body.category) ||
        !["ar", "en"].includes(body.language) ||
        typeof body.published !== "boolean"
      )
        return json({ error: "invalid_knowledge" }, 400);
      const row = {
        store_id: body.storeId,
        title: body.title.trim(),
        content: body.content.trim(),
        category: body.category,
        language: body.language,
        published: body.published,
        approved_by: body.published ? user.id : null,
        updated_at: now,
      };
      const result = body.id
        ? await admin
            .from("store_knowledge")
            .update(row)
            .eq("id", body.id)
            .eq("store_id", body.storeId)
            .select("id")
            .single()
        : await admin.from("store_knowledge").insert(row).select("id").single();
      if (result.error) throw result.error;
      await admin.from("audit_events").insert({
        store_id: body.storeId,
        actor_user_id: user.id,
        event_type: body.published ? "knowledge.published" : "knowledge.saved",
        entity_type: "store_knowledge",
        entity_id: result.data.id,
      });
      return json({ id: result.data.id });
    }
    if (body.action === "knowledge_delete") {
      const { error } = await admin
        .from("store_knowledge")
        .delete()
        .eq("id", body.id)
        .eq("store_id", body.storeId);
      if (error) throw error;
      return json({ deleted: true });
    }
    if (body.action === "ticket_status") {
      if (!["OPEN", "IN_PROGRESS", "RESOLVED"].includes(body.status))
        return json({ error: "invalid_status" }, 400);
      const { data, error } = await admin
        .from("support_tickets")
        .update({ status: body.status, updated_at: now })
        .eq("id", body.ticketId)
        .eq("store_id", body.storeId)
        .select("id")
        .single();
      if (error) throw error;
      await admin.from("audit_events").insert({
        store_id: body.storeId,
        actor_user_id: user.id,
        event_type: "support.ticket.updated",
        entity_type: "support_ticket",
        entity_id: data.id,
        metadata: { status: body.status },
      });
      return json({ updated: true });
    }
    const { data: conv } = await admin
      .from("whatsapp_conversations")
      .select("id,state")
      .eq("id", body.conversationId)
      .eq("store_id", body.storeId)
      .maybeSingle();
    if (!conv) return json({ error: "conversation_not_found" }, 404);
    if (body.action === "takeover" || body.action === "resume") {
      const { error } = await admin
        .from("whatsapp_conversations")
        .update({
          state: body.action === "takeover" ? "HANDED_TO_HUMAN" : "ANSWERED",
          updated_at: now,
        })
        .eq("id", conv.id)
        .eq("store_id", body.storeId);
      if (error) throw error;
      await admin.from("audit_events").insert({
        store_id: body.storeId,
        actor_user_id: user.id,
        event_type: `support.${body.action}`,
        entity_type: "whatsapp_conversation",
        entity_id: conv.id,
      });
      return json({ updated: true });
    }
    if (body.action === "reply") {
      if (
        typeof body.message !== "string" ||
        !body.message.trim() ||
        body.message.length > 4096 ||
        typeof body.requestId !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(body.requestId)
      )
        return json({ error: "invalid_reply" }, 400);
      const { data, error } = await admin.rpc("queue_staff_whatsapp_reply", {
        p_store: body.storeId,
        p_conversation: conv.id,
        p_id: body.requestId,
        p_actor: user.id,
        p_phone: env("WHATSAPP_PHONE_NUMBER_ID"),
        p_body: body.message,
      });
      if (error)
        return json(
          {
            error: error.message.includes("service_window_closed")
              ? "service_window_closed"
              : "reply_not_queued",
          },
          409,
        );
      return json({ queued: true, messageId: data });
    }
    return json({ error: "invalid_action" }, 400);
  } catch (error) {
    console.error(
      "customer_service_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return json({ error: "customer_service_failed" }, 500);
  }
});
