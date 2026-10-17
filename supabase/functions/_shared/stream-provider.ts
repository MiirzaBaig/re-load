import { safeStreamUrl } from "./billing-contract.ts";

export class StreamProvider {
  constructor(private key: string) {
    if (!key) throw new Error("billing_not_configured");
  }
  async request(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<Record<string, any>> {
    if (
      !/^\/[a-z_]+(?:\/[a-zA-Z0-9_-]+)*(?:\?[a-zA-Z0-9_.%=&-]+)?$/.test(path)
    ) throw new Error("invalid_provider_path");
    const response = await fetch(
      `https://stream-app-service.streampay.sa/api/v2${path}`,
      {
        method,
        headers: {
          "x-api-key": this.key,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Reload/1.0",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      },
    );
    if (!response.ok) throw new Error(`stream_${response.status}`);
    if (response.status === 204) return {};
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }
  async portal(consumerId: string) {
    const result = await this.request("/consumer_portal/sessions", "POST", {
      organization_consumer_id: consumerId,
    });
    return safeStreamUrl(result.url);
  }
}
