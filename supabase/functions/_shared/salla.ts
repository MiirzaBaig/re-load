import { decrypt, encrypt } from "./crypto.ts";
import { env } from "./http.ts";
import { adminClient } from "./supabase.ts";

type StoredCredential = {
  connection_id: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_expires_at: string | null;
  refresh_started_at: string | null;
};

async function credential(storeId: string): Promise<StoredCredential> {
  const { data, error } = await adminClient().rpc("get_salla_credential", { p_store_id: storeId });
  if (error || !data?.[0]) throw new Error("salla_connection_not_found");
  return data[0] as StoredCredential;
}

export async function sallaAccessToken(storeId: string) {
  let stored = await credential(storeId);
  const expiresAt = stored.token_expires_at ? new Date(stored.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 172_800_000) return decrypt(stored.access_token_ciphertext);
  if (!stored.refresh_token_ciphertext) throw new Error("salla_reauthorization_required");

  const admin = adminClient();
  const { data: claimed, error: claimError } = await admin.rpc("claim_salla_refresh", {
    p_connection_id: stored.connection_id,
  });
  if (claimError) throw claimError;
  if (!claimed) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    stored = await credential(storeId);
    const refreshedExpiry = stored.token_expires_at ? new Date(stored.token_expires_at).getTime() : 0;
    if (refreshedExpiry <= Date.now() + 30_000) throw new Error("salla_refresh_in_progress");
    return decrypt(stored.access_token_ciphertext);
  }

  const response = await fetch("https://accounts.salla.sa/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: await decrypt(stored.refresh_token_ciphertext),
      client_id: env("SALLA_CLIENT_ID"),
      client_secret: env("SALLA_CLIENT_SECRET"),
    }),
  });
  if (!response.ok) {
    await admin.from("commerce_connections").update({
      status: "EXPIRED", refresh_started_at: null,
      last_error_code: `SALLA_REFRESH_${response.status}`, updated_at: new Date().toISOString(),
    }).eq("id", stored.connection_id);
    throw new Error("salla_reauthorization_required");
  }

  const token = await response.json();
  if (typeof token.access_token !== "string" || typeof token.refresh_token !== "string") {
    throw new Error("salla_refresh_response_invalid");
  }
  const nextExpiry = new Date(Date.now() + Number(token.expires_in ?? 1_209_600) * 1000).toISOString();
  const { error: rotateError } = await admin.rpc("rotate_salla_credential", {
    p_connection_id: stored.connection_id,
    p_access_token_ciphertext: await encrypt(token.access_token),
    p_refresh_token_ciphertext: await encrypt(token.refresh_token),
    p_token_expires_at: nextExpiry,
  });
  if (rotateError) throw rotateError;
  return token.access_token as string;
}

export async function sallaGet(storeId: string, path: string) {
  const token = await sallaAccessToken(storeId);
  const response = await fetch(`https://api.salla.dev/admin/v2${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`salla_api_${response.status}`);
  return response.json();
}
