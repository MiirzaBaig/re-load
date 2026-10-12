import { supabase } from "@/lib/supabase";
export function recordWorkspaceIssue(
  storeId: string,
  area:
    "workspace" | "knowledge" | "integrations" | "inbox" | "policies" | "cases",
  kind: "screen_failed" | "load_failed" | "save_failed",
) {
  // Never send error messages, URLs, form fields or customer data.
  if (supabase)
    void supabase
      .rpc("record_workspace_issue", {
        p_store: storeId,
        p_area: area,
        p_kind: kind,
      })
      .then(
        () => {},
        () => {},
      );
}
