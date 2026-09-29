/**
 * Public WhatsApp entry point. Meta expects digits only in wa.me URLs.
 * Override this when the production Reload number replaces the pilot number.
 */
const WHATSAPP_ENTRY_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || "15551510464";

export function getWhatsAppStartUrl() {
  return `https://wa.me/${WHATSAPP_ENTRY_NUMBER}?text=${encodeURIComponent("start")}`;
}
