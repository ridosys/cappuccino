/** Formats a plain incrementing counter (Invoice.sequenceNumber) for
 * display — 1 -> "00001", 42 -> "00042", 1000000 -> "1000000" (never
 * truncated, only ever padded up to the minimum width). Matches the #####
 * segment of the invoice number (INV-YYYY-MMDD-#####-XX). */
export function formatSequenceNumber(value: number, minDigits = 5): string {
  return String(value).padStart(minDigits, "0");
}
