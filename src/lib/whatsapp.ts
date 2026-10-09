/** Registered Reload Cloud API number. Meta expects digits only in wa.me URLs. */
export const RELOAD_WHATSAPP_NUMBER = "966552362631";

export function getWhatsAppStartUrl(number = RELOAD_WHATSAPP_NUMBER) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent("start")}`;
}

/** Public website entry, kept separate from a pilot merchant's return flow. */
export function getWhatsAppPublicUrl() {
  return `https://wa.me/${RELOAD_WHATSAPP_NUMBER}?text=${encodeURIComponent("reload")}`;
}
