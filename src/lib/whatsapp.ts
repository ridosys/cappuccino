export function buildWhatsAppUrl(phone: string, message: string) {
  const digitsOnly = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}
