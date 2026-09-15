import "server-only";
import { cookies, headers } from "next/headers";
import {
  defaultLocale,
  isLocale,
  LOCALE_COOKIE,
  pickLocaleFromAcceptLanguage,
  type Locale,
} from "@/i18n/config";
import { dictionaries, type Dictionary } from "@/i18n/dictionaries";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  // An explicit choice from the language switcher always wins.
  if (isLocale(cookieLocale)) return cookieLocale;

  // No choice yet: use the browser's preferred language when it's one we
  // support, otherwise fall back to the default (French).
  const requestHeaders = await headers();
  return (
    pickLocaleFromAcceptLanguage(requestHeaders.get("accept-language")) ??
    defaultLocale
  );
}

export async function getDictionary(): Promise<Dictionary> {
  const locale = await getLocale();
  return dictionaries[locale];
}
