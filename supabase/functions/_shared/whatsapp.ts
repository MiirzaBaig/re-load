import { env } from "./http.ts";

const encoder = new TextEncoder();
const GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION")?.trim() || "v25.0";

export type WhatsAppSendResult = {
  messaging_product: "whatsapp";
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string; message_status?: string }>;
};

function digits(value: string) {
  return value.replace(/\D/g, "");
}

async function metaRequest(body: Record<string, unknown>) {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`,
    {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload?.error?.code ?? response.status;
    const subcode = payload?.error?.error_subcode;
    throw new Error(`whatsapp_api_${code}${subcode ? `_${subcode}` : ""}`);
  }
  return payload as WhatsAppSendResult;
}

export async function sendWhatsAppText(to: string, body: string) {
  return metaRequest({
    recipient_type: "individual",
    to: digits(to),
    type: "text",
    text: { preview_url: false, body },
  });
}

export async function sendWhatsAppTemplate(to: string, name: string, language: "ar" | "en", values: string[]) {
  return metaRequest({
    recipient_type: "individual",
    to: digits(to),
    type: "template",
    template: {
      name,
      language: { code: language === "ar" ? "ar" : "en_US" },
      components: [{
        type: "body",
        parameters: values.map((value) => ({ type: "text", text: value.slice(0, 1024) })),
      }],
    },
  });
}

export async function downloadWhatsAppImage(mediaId: string) {
  const token = env("WHATSAPP_ACCESS_TOKEN");
  const metadata = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(mediaId)}?phone_number_id=${encodeURIComponent(env("WHATSAPP_PHONE_NUMBER_ID"))}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!metadata.ok) throw new Error(`whatsapp_media_lookup_${metadata.status}`);
  const details = await metadata.json() as { url?: string; mime_type?: string; file_size?: number };
  if (!details.url || !["image/jpeg", "image/png"].includes(details.mime_type ?? "") || Number(details.file_size) > 5_242_880) {
    throw new Error("whatsapp_image_unsupported");
  }
  const url = new URL(details.url);
  if (url.protocol !== "https:" || !["facebook.com", "fbsbx.com", "fbcdn.net"].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throw new Error("whatsapp_media_url_invalid");
  }
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`whatsapp_media_download_${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 5_242_880) throw new Error("whatsapp_image_size_invalid");
  return { bytes, mimeType: details.mime_type as "image/jpeg" | "image/png" };
}

export async function sendWhatsAppButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
) {
  if (buttons.length < 1 || buttons.length > 3) throw new Error("whatsapp_buttons_invalid");
  return metaRequest({
    recipient_type: "individual",
    to: digits(to),
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.map((button) => ({
          type: "reply",
          reply: { id: button.id.slice(0, 256), title: button.title.slice(0, 20) },
        })),
      },
    },
  });
}

export async function sendWhatsAppList(
  to: string,
  body: string,
  button: string,
  rows: Array<{ id: string; title: string; description?: string }>,
) {
  if (rows.length < 1 || rows.length > 10) throw new Error("whatsapp_list_invalid");
  return metaRequest({
    recipient_type: "individual",
    to: digits(to),
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: button.slice(0, 20),
        sections: [{
          title: "Reload",
          rows: rows.map((row) => ({
            id: row.id.slice(0, 200),
            title: row.title.slice(0, 24),
            description: row.description?.slice(0, 72),
          })),
        }],
      },
    },
  });
}

export async function verifyWhatsAppSignature(rawBody: string, signatureHeader: string) {
  if (!signatureHeader.startsWith("sha256=")) return false;
  const secret = env("WHATSAPP_APP_SECRET");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody)));
  const expected = `sha256=${Array.from(signed, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  const left = encoder.encode(expected);
  const right = encoder.encode(signatureHeader.trim().toLowerCase());
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ (right[index] ?? 0);
  return mismatch === 0;
}

export function sentMessageId(result: WhatsAppSendResult) {
  const id = result.messages?.[0]?.id;
  if (!id) throw new Error("whatsapp_message_id_missing");
  return id;
}
