import { companyConfig } from "@/config/company";

export const CURRENCY_LABEL = companyConfig.currency;

// Left-to-Right Isolate / Pop Directional Isolate: without these, a space-
// grouped number ("456 583.77") sitting inside RTL Arabic text gets its
// digit groups visually reordered by the bidi algorithm (each space-
// separated run is treated independently). Wrapping the number in an LTR
// isolate pins its internal left-to-right order no matter what surrounds it.
const LRI = "⁦";
const PDI = "⁩";

/** Groups the integer part of a number with a space every 3 digits, e.g.
 * 456583.77 -> "456 583.77". Always shows at least `minDecimals`; shows up
 * to `maxDecimals`, trimming trailing zeros in between (so a 4-decimal
 * price of 3.3 renders "3.30", 3.3333 renders "3.3333"). */
function groupThousands(
  value: number,
  minDecimals: number,
  maxDecimals: number,
): string {
  const isNegative = value < 0;
  let fixed = Math.abs(value).toFixed(maxDecimals);
  if (maxDecimals > minDecimals) {
    fixed = fixed.replace(
      new RegExp(`(\\.\\d{${minDecimals}}\\d*?)0+$`),
      "$1",
    );
  }
  const [intPart, decPart] = fixed.split(".");
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const result = decPart !== undefined ? `${groupedInt}.${decPart}` : groupedInt;
  return isNegative ? `-${result}` : result;
}

export function formatCurrency(
  amount: number | string,
  lang: keyof typeof CURRENCY_LABEL = "ar",
  withoutCurrency = false,
  maxDecimals = 2,
): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  const currencyLabel = CURRENCY_LABEL[lang];
  const formatted = `${LRI}${groupThousands(value, 2, maxDecimals)}${PDI}`;
  return withoutCurrency ? formatted : `${formatted} ${currencyLabel}`;
}
