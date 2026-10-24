import { getAdminAccess } from "@/lib/admin-access";
import { checkoutMonitor } from "@/lib/checkout-monitor";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
export async function GET() {
  const access = await getAdminAccess();
  if (!access || access.role !== "owner")
    return Response.json({ error: "Access denied." }, { status: 403, headers });
  const { data, error } = await access.supabase.rpc("staff_checkout_monitor");
  if (error?.code === "42501")
    return Response.json({ error: "Access denied." }, { status: 403, headers });
  if (error)
    return Response.json(
      { error: "Could not load journey records." },
      { status: 503, headers },
    );
  try {
    return Response.json(checkoutMonitor(data), { headers });
  } catch {
    return Response.json(
      { error: "Could not load journey records." },
      { status: 503, headers },
    );
  }
}
