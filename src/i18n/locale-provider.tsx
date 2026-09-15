"use client";

import * as React from "react";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { toast } from "sonner";

type LocaleContextValue = {
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
  isPending: boolean;
};

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const [isPending, startTransition] = React.useTransition();

  const setLocale = React.useCallback(
    (next: Locale) => {
      if (!isLocale(next) || next === locale) return;
      startTransition(() => {
        try {
          // This preference cookie is intentionally browser-readable. A Server
          // Action would also rerender the current tree before the reload,
          // introducing an unnecessary intermediate render/error boundary.
          document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
          const saved = document.cookie.split(";").some(
            (cookie) => cookie.trim() === `${LOCALE_COOKIE}=${next}`,
          );
          if (!saved) {
            toast.error(dictionary.common.genericErrorToast);
            return;
          }
          // One navigation updates server content and the root lang/dir.
          window.location.reload();
        } catch {
          toast.error(dictionary.common.genericErrorToast);
        }
      });
    },
    [locale, dictionary],
  );

  const value = React.useMemo<LocaleContextValue>(
    () => ({ locale, t: dictionary, setLocale, isPending }),
    [locale, dictionary, setLocale, isPending],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = React.useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return ctx;
}

export function useT() {
  return useLocale().t;
}
