import { createClient } from "@/lib/supabase/server";

/**
 * Whether the team desk requires a second factor (authenticator app) on top
 * of the password. Temporarily off at the team's request (2026-10-04): login
 * only. Turn back on before launch — and the database side too, see
 * supabase/migrations/202610040003_admin_mfa_optional.sql.
 */
export const ADMIN_REQUIRE_MFA = false;

export async function getAdminAccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: admin } = await supabase.from("platform_admins")
    .select("role").eq("user_id", user.id).maybeSingle();
  if (!admin) return null;
  if (ADMIN_REQUIRE_MFA) {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel !== "aal2") return null;
  }
  return { supabase, user, role: admin.role as "owner" | "sales" | "viewer" };
}

export async function logAdminEvent(
  access: NonNullable<Awaited<ReturnType<typeof getAdminAccess>>>,
  eventType: string,
  entityType: string,
  entityId?: string,
) {
  const { error } = await access.supabase.from("platform_admin_events").insert({
    actor_user_id: access.user.id,
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId ?? null,
  });
  if (error) throw new Error("Could not record admin access.");
}
