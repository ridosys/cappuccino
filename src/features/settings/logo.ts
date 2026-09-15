import "server-only";

/**
 * Server-side validation for the company logo upload.
 *
 * The file type is decided from the actual bytes (magic number), never
 * from the client-supplied MIME type or extension. SVG has no magic
 * number, so it's detected structurally and then screened for active
 * content — an SVG that could execute script is rejected rather than
 * sanitized, since an admin can always re-export a clean file.
 */

export const MAX_LOGO_BYTES = 4 * 1024 * 1024; // 4 MB

export type LogoKind = "png" | "jpeg" | "webp" | "svg";

export const LOGO_MIME: Record<LogoKind, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** Human-readable list for the file input's accept attribute. */
export const LOGO_ACCEPT = ".png,.jpg,.jpeg,.webp,.svg";

function hasPrefix(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buffer[offset + i] === b);
}

/** Returns the detected kind from the file's bytes, or null if unsupported. */
export function detectLogoKind(buffer: Buffer): LogoKind | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }
  // JPEG: FF D8 FF
  if (hasPrefix(buffer, [0xff, 0xd8, 0xff])) return "jpeg";
  // WebP: "RIFF" .... "WEBP"
  if (
    hasPrefix(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    hasPrefix(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "webp";
  }
  // SVG: XML/text that contains an <svg> root element. No magic number, so
  // this is structural — a leading BOM, whitespace, XML prolog or comment
  // is tolerated before the markup.
  const text = buffer.toString("utf8");
  const head = text.replace(/^﻿/, "").trimStart();
  if (
    (head.startsWith("<?xml") ||
      head.startsWith("<!--") ||
      head.startsWith("<svg")) &&
    /<svg[\s>]/i.test(text)
  ) {
    return "svg";
  }
  return null;
}

const UNSAFE_SVG_PATTERNS: RegExp[] = [
  /<script[\s>]/i,
  /<foreignObject[\s>]/i,
  /<iframe[\s>]/i,
  /<embed[\s>]/i,
  /<object[\s>]/i,
  /<!ENTITY/i,
  /\son[a-z]+\s*=/i, // onload=, onclick=, ...
  /(?:href|xlink:href)\s*=\s*["']\s*(?:javascript|data):/i,
  /url\(\s*["']?\s*(?:javascript|data):/i,
];

/** True when the SVG markup contains no script / active content. */
export function isSvgSafe(markup: string): boolean {
  return !UNSAFE_SVG_PATTERNS.some((re) => re.test(markup));
}
