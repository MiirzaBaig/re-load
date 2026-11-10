/** Only known verification errors restart the flow; never display provider errors. */
export async function needsReturnVerification(data: unknown, error: unknown): Promise<boolean> {
  let code = (data as { error?: unknown } | null)?.error;
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try { code = (await context.clone().json())?.error; } catch { /* Keep the normal retry message. */ }
  }
  return ["expired_return_token", "invalid_return_token", "decision_details_changed"].includes(String(code));
}
