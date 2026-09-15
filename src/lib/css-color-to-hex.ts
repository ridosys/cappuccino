/**
 * Resolves an arbitrary CSS color string — oklch(), hwb(), rgb(), a named
 * color, anything — to a 6-digit hex string, using the browser's own color
 * parser rather than reimplementing one. Used only to seed the native
 * `<input type="color">` swatch next to each color field on the Appearance
 * page (that input only speaks hex); the app's color tokens themselves stay
 * "any valid CSS color" everywhere else, matching company.ts's own contract.
 *
 * Goes through a 1x1 canvas rather than `getComputedStyle` — modern
 * browsers preserve newer color-space functions like oklch()/hwb() as-is
 * from getComputedStyle per the CSS Color 4 spec, but canvas fillStyle
 * always rasterizes to concrete sRGB pixel values no matter what color
 * space the input was specified in, so it works uniformly for every format.
 *
 * Client-only (needs `document`) — during SSR this returns a neutral
 * fallback. That's fine: `<input type="color">`'s value is a controlled
 * form input, which React re-applies as a DOM property after mount rather
 * than diffing against the server-rendered attribute, so this doesn't cause
 * a hydration-mismatch warning — the swatch just resolves to the real color
 * on the client's first render, same as any other client-only computation.
 */

const HEX_RE = /^#([0-9a-f]{6})$/i;
const FALLBACK_HEX = "#888888";
const SENTINEL = "#010203"; // near-black, vanishingly unlikely as a real token color

function toHexByte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");
}

export function cssColorToHex(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return FALLBACK_HEX;

  const hexMatch = trimmed.match(HEX_RE);
  if (hexMatch) return `#${hexMatch[1].toLowerCase()}`;

  if (typeof document === "undefined") return FALLBACK_HEX;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return FALLBACK_HEX;

    // An invalid string is silently ignored by the fillStyle setter rather
    // than throwing, so seed a sentinel first and bail if it didn't change.
    ctx.fillStyle = SENTINEL;
    ctx.fillStyle = trimmed;
    if (ctx.fillStyle === SENTINEL) return FALLBACK_HEX;

    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
  } catch {
    return FALLBACK_HEX;
  }
}
