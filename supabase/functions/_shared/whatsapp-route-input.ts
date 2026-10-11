/** Explicit route attempts never fall back to a previous merchant on malformed input. */
export function whatsappRouteInput(input: string): string | null {
  const match = /^return(?:\s+([\s\S]*))?$/i.exec(input.trim());
  if (!match) return null;
  const code = (match[1] ?? "").trim();
  return /^(RL-[0-9A-F]{10}|[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})$/i.test(
    code,
  )
    ? code.toUpperCase()
    : "INVALID";
}
