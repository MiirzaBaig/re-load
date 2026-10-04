import { getAdminAccess, logAdminEvent } from "@/lib/admin-access";

function cell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET() {
  const access = await getAdminAccess();
  if (!access || access.role === "viewer") return Response.json({ error: "Unauthorized" }, { status: 403 });
  const { data, error } = await access.supabase.from("leads")
    .select("store_name,contact_name,email,phone,interest,status,source_type,source_label,contact_consent,marketing_consent,partner_sharing_consent,created_at,next_follow_up_at")
    .order("created_at", { ascending: false }).limit(10000);
  if (error) return Response.json({ error: "Could not export leads" }, { status: 500 });
  const columns = ["store_name", "contact_name", "email", "phone", "interest", "status", "source_type", "source_label", "contact_consent", "marketing_consent", "partner_sharing_consent", "created_at", "next_follow_up_at"] as const;
  const rows = [columns.join(","), ...(data ?? []).map((lead) => columns.map((key) => cell(lead[key])).join(","))];
  await logAdminEvent(access, "LEADS_EXPORTED", "lead");
  return new Response(`\uFEFF${rows.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reload-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
