import { getAdminAccess, logAdminEvent } from "@/lib/admin-access";
import { platformOf } from "@/lib/platforms";

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || !field) quoted = !quoted;
      else throw new Error("Invalid CSV quoting");
    } else if (char === "," && !quoted) { row.push(field.trim()); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (!access || access.role === "viewer") return Response.json({ error: "Unauthorized" }, { status: 403 });
  let body: { csv?: unknown; sourceLabel?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.csv !== "string" || body.csv.length > 300_000 || typeof body.sourceLabel !== "string" || !body.sourceLabel.trim() || body.sourceLabel.trim().length > 120) return Response.json({ error: "Invalid file or source" }, { status: 400 });
  let rows: string[][];
  try { rows = parseCsv(body.csv.replace(/^\uFEFF/, "")); } catch { return Response.json({ error: "Invalid CSV" }, { status: 400 }); }
  if (rows.length < 2 || rows.length > 501) return Response.json({ error: "CSV must contain 1–500 contacts" }, { status: 400 });
  const header = rows[0].map((value) => value.toLowerCase().replace(/[\s-]+/g, "_"));
  const column = (name: string) => header.indexOf(name);
  if (column("store_name") < 0 || column("contact_name") < 0 || (column("email") < 0 && column("phone") < 0)) return Response.json({ error: "Required columns: store_name, contact_name, email or phone" }, { status: 400 });
  const { data: existing, error: lookupError } = await access.supabase.from("leads").select("email,phone").limit(10000);
  if (lookupError) return Response.json({ error: "Could not check duplicates" }, { status: 500 });
  const known = new Set((existing ?? []).flatMap((lead) => [lead.email?.trim().toLowerCase(), lead.phone?.replace(/\D/g, "")].filter(Boolean)));
  const incoming: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const get = (name: string) => (row[column(name)] ?? "").trim();
    const store = get("store_name").slice(0, 120);
    const contact = get("contact_name").slice(0, 120);
    const email = get("email").toLowerCase();
    const phone = get("phone");
    const normalizedPhone = phone.replace(/\D/g, "");
    if (!store || !contact || (!email && !normalizedPhone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || (phone && normalizedPhone.length < 7)) { skipped++; continue; }
    if ((email && known.has(email)) || (normalizedPhone && known.has(normalizedPhone))) { skipped++; continue; }
    if (email) known.add(email);
    if (normalizedPhone) known.add(normalizedPhone);
    // "platform" or "store_platform" column: any spelling ("zid", "سلة") is
    // stored as one of the desk's four platforms.
    const platform = platformOf(get("platform") || get("store_platform"));
    incoming.push({ store_name: store, contact_name: contact, email: email || null, phone: phone || null, store_platform: platform, source_type: "event", source_label: body.sourceLabel.trim(), contact_consent: false, marketing_consent: false, partner_sharing_consent: false });
  }
  if (incoming.length) {
    const { error } = await access.supabase.from("leads").insert(incoming);
    if (error) return Response.json({ error: "Could not import contacts" }, { status: 500 });
  }
  await logAdminEvent(access, "LEADS_IMPORTED", "lead");
  return Response.json({ imported: incoming.length, skipped });
}
