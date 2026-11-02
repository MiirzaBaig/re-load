import "server-only";
const BASE = "https://staging-api.tryoto.com/rest/v2";
type Path =
  | "/refreshToken"
  | "/createPickupLocation"
  | "/createOrder"
  | "/createReturnShipment"
  | "/accountInfo"
  | "/getReturnDetails"
  | "/getPickupLocationList"
  | "/checkOTODeliveryFee"
  | `/orderDetails?orderId=${string}`
  | `/shipmentTransactions?orderId=${string}&perPage=100&page=1`
  | `/creditTransactions?orderId=${string}&perPage=100&page=1`
  | `/print/${string}?printReverseShipment=true`;
async function bounded(response: Response, max: number) {
  if (Number(response.headers.get("content-length")) > max)
    throw Error("provider_response");
  const reader = response.body?.getReader();
  if (!reader) throw Error("provider_response");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > max) throw Error("provider_response");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}
export class ReturnProvider {
  private token = "";
  async connect() {
    if (
      process.env.OTO_SANDBOX_ENABLED !== "true" ||
      process.env.OTO_SANDBOX_RETURNS_ENABLED !== "true"
    )
      throw Error("disabled");
    const key = process.env.OTO_SANDBOX_REFRESH_TOKEN?.trim();
    if (!key || /[\s\r\n]/.test(key) || key.length > 4096)
      throw Error("configuration");
    const result = await this.request("/refreshToken", { refresh_token: key });
    if (
      result.success !== true ||
      typeof result.access_token !== "string" ||
      !result.access_token ||
      result.access_token.length > 16384 ||
      /[\r\n]/.test(result.access_token)
    )
      throw Error("authentication");
    this.token = result.access_token;
  }
  async request(path: Path, body?: unknown): Promise<Record<string, any>> {
    const response = await fetch(BASE + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(this.token ? { Authorization: "Bearer " + this.token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    if (!response.ok) throw Error("provider_unavailable");
    const value = JSON.parse(
      new TextDecoder().decode(await bounded(response, 1000000)),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error("provider_response");
    return value;
  }
  async label(order: string, shipment: string) {
    const result = await this.request(
      `/print/${encodeURIComponent(order)}?printReverseShipment=true`,
    );
    if (result.success !== true) throw Error("label_unavailable");
    const tracking = result.trackingNumber || result.dcTrackingNumber;
    if (tracking && String(tracking) !== shipment)
      throw Error("label_mismatch");
    const url = new URL(result.printAWBURL);
    if (
      url.origin !== "https://staging-api.tryoto.com" ||
      !["/print/awb", "/web/v1/open/print/generateAWB"].includes(
        url.pathname,
      ) ||
      url.username ||
      url.password ||
      url.hash ||
      !url.searchParams.get("enc") ||
      [...url.searchParams.keys()].some((k) => k !== "enc")
    )
      throw Error("label_unavailable");
    const response = await fetch(url, {
      headers: { Accept: "application/pdf" },
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    if (!response.ok) throw Error("label_unavailable");
    const bytes = await bounded(response, 5000000);
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-")
      throw Error("label_unavailable");
    return bytes;
  }
}
