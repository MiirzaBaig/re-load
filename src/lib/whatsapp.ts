/**
 * Public WhatsApp entry point. Meta expects digits only in wa.me URLs.
 * Override this when the production Reload number replaces the pilot number.
 */
const WHATSAPP_ENTRY_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || "15551510464";

export function getWhatsAppStartUrl(number = WHATSAPP_ENTRY_NUMBER) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent("start")}`;
}

/** Public contact channel; separate from the Meta test bot used in Integrations. */
export function getWhatsAppContactUrl() {
  return "https://wa.me/966581957715";
}
