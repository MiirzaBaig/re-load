/** Accept JSON or one complete Markdown JSON wrapper, never surrounding prose. */
export function modelJsonObject(content: unknown): Record<string, unknown> {
  if (typeof content !== "string" || content.length > 100_000) {
    throw new Error("invalid_model_json");
  }
  const text = content.trim();
  const fenced = /^```(?:json)?[\t ]*\r?\n([\s\S]*?)\r?\n```$/i.exec(text);
  const value = JSON.parse(fenced ? fenced[1] : text);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_model_json");
  }
  return value;
}
