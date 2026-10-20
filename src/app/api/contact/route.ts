import { createClient as createAdmin } from "@supabase/supabase-js";

/*
 * The homepage "Talk to us" form: name, mobile and store link only. The anon
 * insert policy on leads only accepts event sign-ups, so this route checks the
 * input itself and saves the lead with the server key. It never reads leads
 * back and never returns anything but ok / error.
 */

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** "https://www.mystore.sa/ar" -> "mystore.sa"; plain text is kept as typed. */
function storeNameFrom(link: string) {
  try {
    const url = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`);
    if (url.hostname.includes(".")) return url.hostname.replace(/^www\./i, "");
  } catch {}
  return link;
}

export async function POST(request: Request) {
  // Same-site posts only; this is not a public API.
  const origin = request.headers.get("origin");
  try {
    if (origin && new URL(origin).origin !== new URL(request.url).origin)
      return Response.json({ error: "forbidden" }, { status: 403 });
  } catch {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 8192)
    return Response.json({ error: "invalid" }, { status: 413 });

  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); }
  catch { return Response.json({ error: "invalid" }, { status: 400 }); }

  if (!body || typeof body !== "object" || Array.isArray(body))
    return Response.json({ error: "invalid" }, { status: 400 });

  // Hidden field a person never fills in: quietly accept and drop bot posts.
  if (text(body.company, 200)) return Response.json({ ok: true });

  const name = text(body.name, 120);
  const phone = text(body.phone, 25);
  const store = text(body.store, 200);
  const digits = phone.replace(/\D/g, "");
  if (!name || !store || !/^[+\d\s()-]+$/.test(phone) || digits.length < 7 || digits.length > 15)
    return Response.json({ error: "invalid" }, { status: 400 });

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !url) return Response.json({ error: "unavailable" }, { status: 503 });

  const db = createAdmin(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.from("leads").insert({
    store_name: storeNameFrom(store).slice(0, 120),
    contact_name: name,
    phone,
    website: store,
    preferred_contact: "whatsapp",
    source_type: "website",
    source_label: "Homepage contact",
    contact_consent: true,
    marketing_consent: false,
    partner_sharing_consent: false,
  });
  if (error) return Response.json({ error: "save_failed" }, { status: 500 });
  return Response.json({ ok: true });
}
