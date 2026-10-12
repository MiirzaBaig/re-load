/** Names are presentation data, never routing or identity evidence. */
export function customerFirstName(value?: string): string {
  const word =
    value
      ?.normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
      .trim()
      .split(/\s+/)[0] ?? "";
  return /^[\p{L}\p{M}][\p{L}\p{M}'’-]{0,39}$/u.test(word) ? word : "";
}
export function merchantDisplayName(
  workspace: string,
  connected?: string | null,
): string {
  const clean = (value: string) =>
    value
      .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
      .trim()
      .slice(0, 120);
  const own = clean(workspace);
  return own && !/^(my store|store|متجري|المتجر)$/i.test(own)
    ? own
    : clean(connected ?? "") || "Reload";
}
