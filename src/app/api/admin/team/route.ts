import { getAdminAccess, logAdminEvent } from "@/lib/admin-access";

/*
 * Team management for owners: invite by email, change a role, remove someone,
 * cancel an invite. The database enforces the same rules (owner-only RLS, and
 * a trigger that always keeps one owner); these checks give clear errors.
 */

const ROLES = new Set(["owner", "sales", "viewer"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function owner() {
  const access = await getAdminAccess();
  return access?.role === "owner" ? access : null;
}

/** Pending invites (owners only; members come with the page). */
export async function GET() {
  const access = await owner();
  if (!access) return Response.json({ error: "Unauthorized" }, { status: 403 });
  const { data, error } = await access.supabase.from("platform_admin_invites").select("email,role,created_at").order("created_at", { ascending: false });
  if (error) return Response.json({ error: "Could not load invites" }, { status: 500 });
  return Response.json({ invites: data ?? [] });
}

/** Invite: { email, role } */
export async function POST(request: Request) {
  const access = await owner();
  if (!access) return Response.json({ error: "Only owners can invite." }, { status: 403 });
  const body = await request.json().catch(() => null) as { email?: unknown; role?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body?.role === "string" ? body.role : "";
  if (!EMAIL.test(email) || email.length > 254) return Response.json({ error: "Enter a valid email." }, { status: 400 });
  if (!ROLES.has(role)) return Response.json({ error: "Pick a role." }, { status: 400 });
  const { data: team } = await access.supabase.rpc("list_platform_team");
  if ((team ?? []).some((member: { email: string }) => member.email?.toLowerCase() === email)) return Response.json({ error: "They're already on the team." }, { status: 409 });
  // Re-inviting replaces the earlier invite (e.g. with a different role).
  // Delete + insert rather than upsert: invites are never updated in place.
  await access.supabase.from("platform_admin_invites").delete().eq("email", email);
  const { error } = await access.supabase.from("platform_admin_invites").insert({ email, role, invited_by: access.user.id });
  if (error) return Response.json({ error: "Could not save the invite." }, { status: 500 });
  await logAdminEvent(access, "TEAM_INVITED", "admin");
  return Response.json({ ok: true });
}

/** Change a member's role: { userId, role } */
export async function PATCH(request: Request) {
  const access = await owner();
  if (!access) return Response.json({ error: "Only owners can change roles." }, { status: 403 });
  const body = await request.json().catch(() => null) as { userId?: unknown; role?: unknown } | null;
  if (typeof body?.userId !== "string" || !UUID.test(body.userId) || typeof body.role !== "string" || !ROLES.has(body.role)) return Response.json({ error: "Invalid change." }, { status: 400 });
  const { data, error } = await access.supabase.from("platform_admins").update({ role: body.role }).eq("user_id", body.userId).select("user_id").maybeSingle();
  if (error) return Response.json({ error: error.message.includes("at least one owner") ? "The team needs at least one owner." : "Could not change the role." }, { status: error.message.includes("at least one owner") ? 409 : 500 });
  if (!data) return Response.json({ error: "Member not found." }, { status: 404 });
  await logAdminEvent(access, "TEAM_ROLE_CHANGED", "admin", body.userId);
  return Response.json({ ok: true });
}

/** Remove a member { userId } or cancel an invite { email }. */
export async function DELETE(request: Request) {
  const access = await owner();
  if (!access) return Response.json({ error: "Only owners can remove access." }, { status: 403 });
  const body = await request.json().catch(() => null) as { userId?: unknown; email?: unknown } | null;
  if (typeof body?.email === "string") {
    const { error } = await access.supabase.from("platform_admin_invites").delete().eq("email", body.email.trim().toLowerCase());
    if (error) return Response.json({ error: "Could not cancel the invite." }, { status: 500 });
    await logAdminEvent(access, "TEAM_INVITE_CANCELLED", "admin");
    return Response.json({ ok: true });
  }
  if (typeof body?.userId !== "string" || !UUID.test(body.userId)) return Response.json({ error: "Invalid request." }, { status: 400 });
  if (body.userId === access.user.id) return Response.json({ error: "You can't remove yourself." }, { status: 400 });
  const { data, error } = await access.supabase.from("platform_admins").delete().eq("user_id", body.userId).select("user_id").maybeSingle();
  if (error) return Response.json({ error: error.message.includes("at least one owner") ? "The team needs at least one owner." : "Could not remove access." }, { status: error.message.includes("at least one owner") ? 409 : 500 });
  if (!data) return Response.json({ error: "Member not found." }, { status: 404 });
  await logAdminEvent(access, "TEAM_MEMBER_REMOVED", "admin", body.userId);
  return Response.json({ ok: true });
}
