// Harakat/tanwin/sukun/shadda (U+064B-U+0652) plus superscript alef (U+0670)
const DIACRITICS = /[ً-ْٰ]/g;
const TATWEEL = /ـ/g;
// أ إ آ ٱ -> ا
const ALEF_VARIANTS = /[أإآٱ]/g;
// ى -> ي
const ALEF_MAKSURA = /ى/g;

export function normalizeArabicName(name: string): string {
  return name
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(ALEF_VARIANTS, "ا")
    .replace(ALEF_MAKSURA, "ي")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Requires at least a first and last name (two whitespace-separated parts). */
export function isFullName(name: string): boolean {
  return name.trim().split(/\s+/).filter(Boolean).length >= 2;
}
