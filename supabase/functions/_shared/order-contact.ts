/** Preserve international country codes; normalize only known Saudi local forms. */
export function normalizeOrderContact(value: string) {
  const clean = value.trim().toLowerCase();
  if (clean.includes("@")) return clean;
  let digits = clean.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^05\d{8}$/.test(digits)) digits = `966${digits.slice(1)}`;
  else if (/^5\d{8}$/.test(digits)) digits = `966${digits}`;
  return /^\d{8,15}$/.test(digits) ? digits : "";
}
