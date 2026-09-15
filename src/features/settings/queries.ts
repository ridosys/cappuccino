import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { companyConfig } from "@/config/company";
import type { ColorTokens } from "./schema";

export type SystemSettingsData = {
  appName: string;
  appShortName: string;
  /** Custom logo delivery URL, or the company.ts default (which may be null). */
  logoUrl: string | null;
  colorsLight: ColorTokens;
  colorsDark: ColorTokens;
};

function mergeColors(base: ColorTokens, override: unknown): ColorTokens {
  if (!override || typeof override !== "object") return base;
  return { ...base, ...(override as Partial<ColorTokens>) };
}

/** Cached per-request — read by the root layout (theme CSS + title) and the
 * admin dashboard layout (sidebar app name) alike, so a single request only
 * hits the DB once for this singleton row. */
export const getSystemSettings = cache(async (): Promise<SystemSettingsData> => {
  const row = await prisma.systemSettings.findFirst();
  return {
    appName: row?.appName || companyConfig.name,
    appShortName: row?.appShortName || companyConfig.shortName,
    logoUrl: row?.logoUrl || companyConfig.logo,
    colorsLight: mergeColors(companyConfig.colors.light, row?.colorsLight),
    colorsDark: mergeColors(companyConfig.colors.dark, row?.colorsDark),
  };
});

export async function getSystemSettingsRow() {
  return prisma.systemSettings.findFirst();
}
