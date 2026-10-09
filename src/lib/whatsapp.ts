/**
 * Public WhatsApp entry point. Meta expects digits only in wa.me URLs.
 * The registered Reload number is used for customer returns. The public
 * contact button below reaches the team on a separate number.
 */
const WHATSAPP_ENTRY_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || "966552362631";

export function getWhatsAppStartUrl(number = WHATSAPP_ENTRY_NUMBER) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent("start")}`;
}

/** Public sales contact channel; separate from the customer-return bot. */
export function getWhatsAppContactUrl() {
  return "https://wa.me/966581957715";
}
