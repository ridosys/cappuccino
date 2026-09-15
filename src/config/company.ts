/**
 * Central branding configuration.
 *
 * Rebrand the whole app for a different company by editing the values
 * below — nothing else needs to change. Every value here is read at
 * request time (see src/config/apply-theme.ts and the places listed in
 * each section's comment), so a change here is reflected everywhere
 * immediately, no rebuild step required.
 *
 * Colors accept any valid CSS color (hex, rgb(), oklch(), ...). The
 * defaults below are the app's current design, expressed as oklch so a
 * fresh install looks pixel-identical to before this file existed.
 *
 * Why colors.light and colors.dark instead of one flat color set: a few
 * of these tokens (secondary, accent) are light gray surfaces in light
 * mode and dark gray surfaces in dark mode — they invert, they don't
 * just get lighter/darker by a fixed amount. Reusing a single value for
 * both themes would either wreck dark-mode contrast or light-mode
 * contrast depending on which value you picked. Keeping both explicit
 * means you're always in control of exactly what each theme looks like,
 * with no surprises. If you only care about one theme, you only need to
 * edit that section.
 */

export const companyConfig = {
  /** Full company name — sidebar and invoice/purchase print headers. */
  name: "cappuccino",
  /** Short form, used for the browser tab title. */
  shortName: "cpn",

  /**
   * Path to a logo image (under /public, e.g. "/images/logo.png") shown
   * instead of the default icon mark. Leave null to keep the default.
   */
  logo: null as string | null,
  /** Path to a favicon file under /public, e.g. "/favicon.ico". */
  favicon: "/favicon.ico",

  colors: {
    light: {
      primary: "oklch(0.47 0.19 264)",
      secondary: "oklch(0.96 0.012 264)",
      sidebar: "oklch(0.16 0.03 264)",
      sidebarForeground: "oklch(0.93 0.01 264)",
      header: "oklch(0.995 0.003 260)",
      background: "oklch(0.995 0.003 260)",
      text: "oklch(0.18 0.02 264)",
      button: "oklch(0.47 0.19 264)",
      accent: "oklch(0.94 0.035 264)",
    },
    dark: {
      primary: "oklch(0.72 0.15 264)",
      secondary: "oklch(0.26 0.02 264)",
      sidebar: "oklch(0.12 0.018 264)",
      sidebarForeground: "oklch(0.93 0.01 264)",
      header: "oklch(0.15 0.016 264)",
      background: "oklch(0.15 0.016 264)",
      text: "oklch(0.96 0.006 264)",
      button: "oklch(0.72 0.15 264)",
      accent: "oklch(0.28 0.035 264)",
    },
  },

  /** Currency label shown after amounts, per language (src/lib/currency.ts). */
  currency: {
    ar: "درهم",
    en: "DH",
    fr: "DH",
  },
} as const;

export type CompanyConfig = typeof companyConfig;

export default companyConfig;
