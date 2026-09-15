import { ar } from "@/i18n/ar";
import { en } from "@/i18n/en";
import { fr } from "@/i18n/fr";
import type { Locale } from "@/i18n/config";

type DeepStringify<T> = T extends string
  ? string
  : { readonly [K in keyof T]: DeepStringify<T[K]> };

export type Dictionary = DeepStringify<typeof ar>;

// Structural check: en/fr must have the exact same shape as ar.
const _checkEn: Dictionary = en;
const _checkFr: Dictionary = fr;
void _checkEn;
void _checkFr;

export const dictionaries: Record<Locale, Dictionary> = { ar, en, fr };
