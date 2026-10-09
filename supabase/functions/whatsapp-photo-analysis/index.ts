import { json } from "../_shared/http.ts";
import { assessReturnPhoto } from "../_shared/return-photo.ts";
import { adminClient } from "../_shared/supabase.ts";

// Queued by pg_net after evidence is stored. A photo can suggest what is
// visible; it never changes the policy decision or approves a refund.
Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await request.json();
    const evidenceId = typeof body?.evidenceId === "string" ? body.evidenceId : "";
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(evidenceId)) return json({ error: "invalid_request" }, 400);
    const admin = adminClient();
    const { data: evidence, error } = await admin.from("return_evidence")
      .select("id,storage_path,assessment")
      .eq("id", evidenceId).maybeSingle();
    if (error) throw error;
    if (!evidence) return json({ error: "not_found" }, 404);
    if (evidence.assessment?.state !== "pending") return json({ received: true, duplicate: true });

    // Claim the pending row so concurrent queue deliveries cannot call the
    // model twice. A timed-out model leaves a merchant-review fallback.
    const { data: claimed, error: claimError } = await admin.from("return_evidence")
      .update({ assessment: { ...evidence.assessment, state: "processing" } })
      .eq("id", evidenceId).eq("assessment->>state", "pending")
      .select("id").maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return json({ received: true, duplicate: true });

    let assessment: Awaited<ReturnType<typeof assessReturnPhoto>> = {
      state: "unavailable", visibleItem: false, clarity: "unclear", visibleDamage: "unclear",
      note: "Image review was unavailable; the merchant should check the photo.", reviewRequired: true,
    };
    try {
      const downloaded = await admin.storage.from("return-evidence").download(evidence.storage_path);
      if (downloaded.error || !downloaded.data) throw downloaded.error ?? new Error("photo_download_failed");
      const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      assessment = await assessReturnPhoto(
        bytes,
        String(evidence.assessment?.itemName ?? "item"),
        String(evidence.assessment?.statedCondition ?? "not stated"),
      );
    } catch (photoError) {
      console.error("return_photo_analysis_unavailable", photoError instanceof Error ? photoError.message : "unknown");
    }
    const { error: saveError } = await admin.from("return_evidence")
      .update({ assessment, review_required: assessment.reviewRequired }).eq("id", evidenceId);
    if (saveError) throw saveError;
    return json({ reviewed: assessment.state === "reviewed", reviewRequired: assessment.reviewRequired });
  } catch (error) {
    console.error("return_photo_analysis_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "photo_analysis_failed" }, 500);
  }
});
