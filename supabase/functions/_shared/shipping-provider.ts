/** Staging origin only. A caller cannot supply a host or follow a bearer redirect. */
const BASE = "https://staging-api.tryoto.com/rest/v2";
export type ShippingProvider = {
  request(path: string, body?: unknown): Promise<Record<string, any>>;
  pdf(orderRef: string, shipment: string): Promise<Uint8Array>;
};
async function bytes(response: Response, max: number) {
  if (!response.ok || Number(response.headers.get("content-length")) > max) {
    throw Error("provider_unavailable");
  }
  const reader = response.body?.getReader();
  if (!reader) throw Error("provider_unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > max) throw Error("provider_unavailable");
      chunks.push(r.value);
    }
  } finally {
    await reader.cancel();
  }
  const value = new Uint8Array(size);
  let n = 0;
  for (const c of chunks) {
    value.set(c, n);
    n += c.length;
  }
  return value;
}
export async function shippingProvider(): Promise<ShippingProvider> {
  if (Deno.env.get("WHATSAPP_SHIPPING_BOOKING_SANDBOX_ENABLED") !== "true") {
    throw Error("disabled");
  }
  const refresh = Deno.env.get("OTO_SANDBOX_REFRESH_TOKEN")?.trim();
  if (!refresh || refresh.length > 4096 || /\s/.test(refresh)) {
    throw Error("provider_configuration");
  }
  let token = "";
  const request = async (path: string, body?: unknown) => {
    if (
      !/^\/(refreshToken|accountInfo|getPickupLocationList|checkOTODeliveryFee|createOrder|createReturnShipment|getReturnDetails|orderDetails|shipmentTransactions|creditTransactions)(\?|$)/
          .test(path) &&
        !/^\/print\/RLDTEST-[a-f0-9]{32}(-R\d{1,6})?\?printReverseShipment=true$/
          .test(path) || /[\r\n#]/.test(path)
    ) throw Error("provider_path");
    const r = await fetch(BASE + path, {
      method: body === undefined ? "GET" : "POST",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return JSON.parse(new TextDecoder().decode(await bytes(r, 2_000_000)));
  };
  const auth = await request("/refreshToken", { refresh_token: refresh });
  if (
    auth.success !== true || typeof auth.access_token !== "string" ||
    !auth.access_token || /[\r\n]/.test(auth.access_token)
  ) throw Error("provider_configuration");
  token = auth.access_token;
  return {
    request,
    pdf: async (orderRef: string, shipment: string) => {
      if (!/^RLDTEST-[a-f0-9]{32}(-R\d{1,6})?$/.test(orderRef)) {
        throw Error(
          "label_unavailable",
        );
      }
      const result = await request(
        `/print/${encodeURIComponent(orderRef)}?printReverseShipment=true`,
      );
      if (result.success !== true) throw Error("label_unavailable");
      const tracking = result.trackingNumber || result.dcTrackingNumber;
      if (tracking && String(tracking) !== shipment) {
        throw Error(
          "label_mismatch",
        );
      }
      const url = new URL(result.printAWBURL);
      if (
        url.origin !== "https://staging-api.tryoto.com" ||
        !["/print/awb", "/web/v1/open/print/generateAWB"].includes(
          url.pathname,
        ) || url.username || url.password || url.hash ||
        !url.searchParams.get("enc") ||
        [...url.searchParams.keys()].some((k) => k !== "enc")
      ) throw Error("label_unavailable");
      const r = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/pdf" },
      });
      const data = await bytes(r, 5_000_000);
      if (new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-") {
        throw Error(
          "label_unavailable",
        );
      }
      return data;
    },
  };
}
