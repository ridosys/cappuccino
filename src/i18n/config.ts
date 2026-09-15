export const locales = ["ar", "en", "fr"] as const;
export type Locale = (typeof locales)[number];
/** Used when the visitor has made no choice and their browser asks for no
 * language we support. */
export const defaultLocale: Locale = "fr";

export const localeDirection: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
  fr: "ltr",
};

export const localeLabels: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
  fr: "Français",
};

/** Short code shown in the language-switcher badge. */
export const localeCodes: Record<Locale, string> = {
  ar: "AR",
  en: "EN",
  fr: "FR",
};

export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/**
 * Best supported locale from an `Accept-Language` header value, honoring the
 * browser's quality (`q=`) ordering. Returns null when the browser asks for
 * nothing we support (the caller then falls back to `defaultLocale`).
 */
export function pickLocaleFromAcceptLanguage(
  header: string | null | undefined,
): Locale | null {
  if (!header) return null;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const q = qParam ? Number(qParam.slice(2)) : 1;
      return {
        base: tag.trim().toLowerCase().split("-")[0],
        q: Number.isFinite(q) ? q : 0,
      };
    })
    .filter((entry) => entry.base)
    .sort((a, b) => b.q - a.q);

  for (const { base } of ranked) {
    if (isLocale(base)) return base;
  }
  return null;
}
