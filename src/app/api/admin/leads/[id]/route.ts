import { getAdminAccess, logAdminEvent } from "@/lib/admin-access";

type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["new", "contacted", "interested", "demo_booked", "customer", "not_interested"]);

export async function GET(_request: Request, context: Context) {
  const access = await getAdminAccess();
  if (!access) return Response.json({ error: "Unauthorized" }, { status: 403 });
  const { id } = await context.params;
  if (!UUID.test(id)) return Response.json({ error: "Invalid lead" }, { status: 400 });
  const { data: lead, error } = await access.supabase.from("leads")
    .select("*,financing_requests(monthly_returns,average_order_value,processing_minutes,resolution_days,hourly_cost,tied_up_amount,operating_cost,monthly_sales,monthly_orders,return_rate,average_refund_amount,monthly_refund_volume,refund_processing_days,desired_financing_days),lead_notes(id,body,created_at,author_user_id)")
    .eq("id", id).maybeSingle();
  if (error) return Response.json({ error: "Could not load lead" }, { status: 500 });
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
  await logAdminEvent(access, "LEAD_VIEWED", "lead", id);
  lead.lead_notes?.sort((a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at));
  return Response.json({ lead });
}

export async function PATCH(request: Request, context: Context) {
  const access = await getAdminAccess();
  if (!access || access.role === "viewer") return Response.json({ error: "Unauthorized" }, { status: 403 });
  const { id } = await context.params;
  if (!UUID.test(id)) return Response.json({ error: "Invalid lead" }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !["status", "next_follow_up_at", "owner_user_id"].includes(key))) return Response.json({ error: "Invalid fields" }, { status: 400 });
  if (body.status !== undefined && (typeof body.status !== "string" || !STATUSES.has(body.status))) return Response.json({ error: "Invalid status" }, { status: 400 });
  if (body.owner_user_id !== undefined && body.owner_user_id !== null && body.owner_user_id !== access.user.id) return Response.json({ error: "Invalid owner" }, { status: 400 });
  if (body.next_follow_up_at !== undefined && body.next_follow_up_at !== null && (typeof body.next_follow_up_at !== "string" || !Number.isFinite(Date.parse(body.next_follow_up_at)))) return Response.json({ error: "Invalid date" }, { status: 400 });
  const { data, error } = await access.supabase.from("leads").update(body).eq("id", id).select("id").maybeSingle();
  if (error) return Response.json({ error: "Could not update lead" }, { status: 500 });
  if (!data) return Response.json({ error: "Lead not found" }, { status: 404 });
  await logAdminEvent(access, "LEAD_UPDATED", "lead", id);
  return Response.json({ ok: true });
}
