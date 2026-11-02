import "server-only";
import {
  courierRates,
  quoteInput,
  type QuoteInput,
  type SandboxConnection,
  type SandboxQuotes,
} from "./contracts";

const BASE = "https://staging-api.tryoto.com/rest/v2";
export class OtoError extends Error {
  constructor(
    public code:
      | "disabled"
      | "configuration"
      | "authentication"
      | "provider_unavailable"
      | "provider_response"
      | "invalid_input",
    public status: number = 503,
  ) {
    super(code);
  }
}
function configuration() {
  if (process.env.OTO_SANDBOX_ENABLED !== "true")
    throw new OtoError("disabled");
  const key = process.env.OTO_SANDBOX_REFRESH_TOKEN?.trim();
  if (!key || key.length > 4096 || /[\s\r\n]/.test(key))
    throw new OtoError("configuration");
  return key;
}
// No configurable origin, redirects, production fallback or provider write endpoints.
async function request(
  path:
    "/refreshToken" | "/healthCheck" | "/accountInfo" | "/checkOTODeliveryFee",
  token?: string,
  body?: unknown,
) {
  let response: Response;
  try {
    response = await fetch(BASE + path, {
      method: body ? "POST" : "GET",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok)
      throw new OtoError(
        response.status === 401 || response.status === 403
          ? "authentication"
          : "provider_unavailable",
      );
    const text = await response.text();
    if (text.length > 1_000_000) throw new OtoError("provider_response");
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new OtoError("provider_response");
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof OtoError) throw error;
    throw new OtoError("provider_unavailable");
  }
}
async function accessToken() {
  const result = await request("/refreshToken", undefined, {
    refresh_token: configuration(),
  });
  if (
    result.success !== true ||
    typeof result.access_token !== "string" ||
    !result.access_token ||
    result.access_token.length > 16384 ||
    /[\r\n]/.test(result.access_token)
  )
    throw new OtoError("authentication");
  return result.access_token;
}
export async function sandboxConnection(): Promise<SandboxConnection> {
  const token = await accessToken();
  const health = await request("/healthCheck", token);
  const account = await request("/accountInfo", token);
  if (health.status !== "OK" && health.status !== "ok")
    throw new OtoError("provider_unavailable");
  if (
    typeof account.packageName !== "string" ||
    account.packageName.length > 80 ||
    !/^[a-zA-Z0-9 _-]+$/.test(account.packageName)
  )
    throw new OtoError("provider_response");
  return {
    environment: "sandbox",
    healthy: true,
    plan: account.packageName,
    checkedAt: new Date().toISOString(),
  };
}
export async function sandboxQuotes(
  input: QuoteInput,
  reverseOnly = false,
): Promise<SandboxQuotes> {
  let validated: QuoteInput;
  try {
    validated = quoteInput(input);
  } catch {
    throw new OtoError("invalid_input", 400);
  }
  const token = await accessToken();
  const result = await request("/checkOTODeliveryFee", token, {
    ...validated,
    originCountry: "SA",
    destinationCountry: "SA",
    currency: "SAR",
    packageCount: 1,
    totalDue: 0,
    ...(reverseOnly ? { forReverseShipment: true } : {}),
  });
  let rates;
  try {
    rates = courierRates(result);
  } catch {
    throw new OtoError("provider_response");
  }
  return {
    environment: "sandbox",
    input: validated,
    rates,
    checkedAt: new Date().toISOString(),
  };
}
