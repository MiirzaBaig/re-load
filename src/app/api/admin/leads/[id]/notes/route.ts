import { getAdminAccess, logAdminEvent } from "@/lib/admin-access";

type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: Context) {
  const access = await getAdminAccess();
  if (!access || access.role === "viewer") return Response.json({ error: "Unauthorized" }, { status: 403 });
  const { id } = await context.params;
  if (!UUID.test(id)) return Response.json({ error: "Invalid lead" }, { status: 400 });
  let body: { body?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const note = typeof body.body === "string" ? body.body.trim() : "";
  if (!note || note.length > 2000) return Response.json({ error: "Invalid note" }, { status: 400 });
  const { data, error } = await access.supabase.from("lead_notes").insert({ lead_id: id, author_user_id: access.user.id, body: note }).select("id").single();
  if (error) return Response.json({ error: "Could not add note" }, { status: 500 });
  await logAdminEvent(access, "LEAD_NOTE_ADDED", "lead", id);
  return Response.json({ id: data.id });
}
