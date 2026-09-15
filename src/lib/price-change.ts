/**
 * Compares two historical unit prices (never the product's current live
 * price — see InvoiceItem.unitPrice, which is an immutable snapshot of what
 * was actually charged at the time of each sale). Guards against the two
 * cases that produce misleading output: no prior price to compare against,
 * and a prior price of zero/negative (would divide by zero or invert sign).
 */
export type PriceChange = {
  diff: number;
  percent: number;
  direction: "up" | "down" | "flat";
};

export function computePriceChange(
  before: number | null | undefined,
  after: number,
): PriceChange | null {
  if (before === null || before === undefined || before <= 0) return null;

  const diff = after - before;
  const percent = (diff / before) * 100;
  const direction = diff > 0.005 ? "up" : diff < -0.005 ? "down" : "flat";

  return { diff, percent, direction };
}
