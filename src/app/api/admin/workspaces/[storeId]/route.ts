import { getAdminAccess } from "@/lib/admin-access";
import { SUPPORT_UUID } from "@/lib/support-workspace";
const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ storeId: string }> };
export async function GET(request: Request, { params }: Context) {
  const access = await getAdminAccess();
  if (!access)
    return Response.json({ error: "Access denied." }, { status: 403, headers });
  const { storeId } = await params;
  const conversation = new URL(request.url).searchParams.get("conversation");
  if (
    !SUPPORT_UUID.test(storeId) ||
    (conversation && !SUPPORT_UUID.test(conversation))
  )
    return Response.json(
      { error: "Invalid workspace." },
      { status: 400, headers },
    );
  const { data, error } = await access.supabase.rpc("staff_support_workspace", {
    p_store: storeId,
    p_conversation: conversation || null,
  });
  if (error)
    return Response.json(
      { error: "Could not load this workspace." },
      { status: 500, headers },
    );
  return Response.json(data, { headers });
}
export async function POST(request: Request, { params }: Context) {
  const access = await getAdminAccess();
  if (!access || access.role !== "owner")
    return Response.json(
      { error: "Only Reload owners can prepare drafts." },
      { status: 403, headers },
    );
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json(
      { error: "Invalid request." },
      { status: 403, headers },
    );
  const { storeId } = await params;
  if (!SUPPORT_UUID.test(storeId))
    return Response.json(
      { error: "Invalid workspace." },
      { status: 400, headers },
    );
  if (Number(request.headers.get("content-length") || 0) > 24000)
    return Response.json(
      { error: "Draft too large." },
      { status: 413, headers },
    );
  const b = await request.json().catch(() => null);
  if (
    !b ||
    typeof b.title !== "string" ||
    typeof b.content !== "string" ||
    typeof b.category !== "string" ||
    typeof b.language !== "string" ||
    !b.title.trim() ||
    b.title.length > 160 ||
    !b.content.trim() ||
    b.content.length > 6000
  )
    return Response.json(
      { error: "Check the question and answer." },
      { status: 400, headers },
    );
  const { error } = await access.supabase.rpc("staff_prepare_knowledge", {
    p_store: storeId,
    p_title: b.title,
    p_content: b.content,
    p_category: b.category,
    p_language: b.language,
  });
  if (error)
    return Response.json(
      { error: "Could not save the draft." },
      { status: 400, headers },
    );
  return Response.json({ saved: true }, { headers });
}
