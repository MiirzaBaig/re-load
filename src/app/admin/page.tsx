import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { parseDeskState, type DeskQuery } from "@/components/admin/desk-state";
import { AdminMfaGate } from "@/components/admin-mfa-gate";
import { AdminNoAccess } from "@/components/admin/no-access";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_REQUIRE_MFA } from "@/lib/admin-access";

export const metadata: Metadata = {
  title: "Reload · Team desk",
  robots: { index: false, follow: false },
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  let { data: access } = await supabase.from("platform_admins")
    .select("role").eq("user_id", user.id).maybeSingle();
  if (!access) {
    // First sign-in of an invited teammate: turn their invite into access.
    const { data: claimed } = await supabase.rpc("claim_platform_invite");
    if (claimed) access = { role: claimed as string };
  }
  if (!access) return <AdminNoAccess email={user.email ?? ""} />;

  if (ADMIN_REQUIRE_MFA) {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel !== "aal2") return <AdminMfaGate />;
  }

  const [team, leads, stores, memberships, policies, commerce, whatsapp, decisions, cases, messages, events, reports, merchantAudit, adminAudit] = await Promise.all([
    supabase.rpc("list_platform_team"),
    supabase.from("leads").select("id,store_name,contact_name,store_platform,interest,status,source_type,source_label,created_at,next_follow_up_at,owner_user_id,store_id").order("created_at", { ascending: false }).limit(500),
    supabase.from("stores").select("id,name,created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("memberships").select("store_id,user_id,role").limit(1000),
    supabase.from("policy_versions").select("store_id,published_at").order("published_at", { ascending: false }).limit(1000),
    supabase.from("commerce_connections").select("store_id,platform,status,external_store_name,last_synced_at,last_error_code,connected_at").limit(500),
    supabase.from("whatsapp_connections").select("store_id,status,last_webhook_at,connected_at").limit(500),
    supabase.from("eligibility_decisions").select("store_id,outcome,reason_codes,evaluated_at").order("evaluated_at", { ascending: false }).limit(1000),
    supabase.from("return_cases").select("store_id,status,created_at").order("created_at", { ascending: false }).limit(1000),
    supabase.from("whatsapp_messages").select("store_id,status,failure_code,occurred_at").eq("status", "FAILED").order("occurred_at", { ascending: false }).limit(100),
    supabase.from("integration_events").select("store_id,provider,event_type,status,last_error,received_at").eq("status", "FAILED").order("received_at", { ascending: false }).limit(100),
    supabase.from("product_reports").select("id,store_id,report_type,status,message,source_channel,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("audit_events").select("id,store_id,event_type,entity_type,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("platform_admin_events").select("id,actor_user_id,event_type,entity_type,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const results = [team, leads, stores, memberships, policies, commerce, whatsapp, decisions, cases, messages, events, reports, merchantAudit, adminAudit];
  if (results.some((result) => result.error)) {
    console.error("admin_dashboard_load_failed", results.filter((result) => result.error).map((result) => result.error?.code));
    throw new Error("Could not load the team desk.");
  }

  const { error: auditError } = await supabase.from("platform_admin_events").insert({
    actor_user_id: user.id, event_type: "DASHBOARD_VIEWED", entity_type: "admin",
  });
  if (auditError) throw new Error("Could not record admin access.");

  // Read the view from the URL on the server, so the first paint is the right
  // view (refresh and shared links land where they should, with no flash).
  const query = Object.fromEntries(Object.entries(await searchParams).filter(([, value]) => typeof value === "string")) as DeskQuery;

  const teamIds = new Set((team.data ?? []).map((member: { user_id: string }) => member.user_id));

  return <AdminShell
    initial={parseDeskState(query)}
    role={access.role}
    currentUserId={user.id}
    leads={leads.data ?? []}
    // Team members' own accounts come with a store (every sign-up used to get
    // one); they're Reload staff, not merchants, so keep them out of the counts.
    stores={(stores.data ?? []).filter((store) => !(memberships.data ?? []).some((m) => m.store_id === store.id && teamIds.has(m.user_id)))}
    memberships={memberships.data ?? []}
    policies={policies.data ?? []}
    commerce={commerce.data ?? []}
    whatsapp={whatsapp.data ?? []}
    decisions={decisions.data ?? []}
    cases={cases.data ?? []}
    failedMessages={messages.data ?? []}
    failedEvents={events.data ?? []}
    reports={reports.data ?? []}
    merchantAudit={merchantAudit.data ?? []}
    adminAudit={adminAudit.data ?? []}
    team={team.data ?? []}
  />;
}
