"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import {
  destroyCloudinaryAsset,
  uploadCloudinaryAsset,
} from "@/lib/cloudinary";
import { systemSettingsSchema } from "./schema";
import { getSystemSettingsRow } from "./queries";
import {
  detectLogoKind,
  isSvgSafe,
  LOGO_MIME,
  MAX_LOGO_BYTES,
} from "./logo";
import { getDictionary } from "@/i18n/server";

type ActionResult = { error?: string; success?: boolean };

const LOGO_FOLDER = "inventory-system/branding";

export async function updateSystemSettings(
  input: unknown,
): Promise<ActionResult> {
  const access = await requirePermission("SETTINGS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const parsed = systemSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: t.settings.validationError };

  const data = {
    appName: parsed.data.appName,
    appShortName: parsed.data.appShortName,
    colorsLight: parsed.data.colorsLight,
    colorsDark: parsed.data.colorsDark,
  };

  const existing = await getSystemSettingsRow();
  if (existing) {
    await prisma.systemSettings.update({ where: { id: existing.id }, data });
  } else {
    await prisma.systemSettings.create({ data });
  }

  // Layout-wide revalidation: the theme CSS and app name are rendered in
  // the root layout, so every route needs to pick up the new values.
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Upload (or replace) the custom company logo. The file is validated on
 * the server — real byte signature, size limit, and an SVG active-content
 * screen — then stored in Cloudinary; only the URL + public id are saved
 * on the settings row. Any previously stored logo asset is destroyed.
 */
export async function updateCompanyLogo(
  formData: FormData,
): Promise<ActionResult> {
  const access = await requirePermission("SETTINGS_MANAGE");
  if (!access.ok) return { error: access.error };
  const t = await getDictionary();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: t.settings.logo.errorNoFile };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: t.settings.logo.errorTooLarge };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = detectLogoKind(buffer);
  if (!kind) return { error: t.settings.logo.errorType };
  if (kind === "svg" && !isSvgSafe(buffer.toString("utf8"))) {
    return { error: t.settings.logo.errorUnsafeSvg };
  }

  const dataUri = `data:${LOGO_MIME[kind]};base64,${buffer.toString("base64")}`;
  let uploaded: { publicId: string; secureUrl: string };
  try {
    uploaded = await uploadCloudinaryAsset(dataUri, { folder: LOGO_FOLDER });
  } catch {
    return { error: t.settings.logo.errorUpload };
  }

  const existing = await getSystemSettingsRow();
  const previousPublicId = existing?.logoPublicId ?? null;

  if (existing) {
    await prisma.systemSettings.update({
      where: { id: existing.id },
      data: { logoUrl: uploaded.secureUrl, logoPublicId: uploaded.publicId },
    });
  } else {
    await prisma.systemSettings.create({
      data: { logoUrl: uploaded.secureUrl, logoPublicId: uploaded.publicId },
    });
  }

  if (previousPublicId && previousPublicId !== uploaded.publicId) {
    try {
      await destroyCloudinaryAsset(previousPublicId);
    } catch {
      // Best effort — the settings row already points at the new asset.
    }
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/** Remove the custom company logo and revert to the default brand mark. */
export async function removeCompanyLogo(): Promise<ActionResult> {
  const access = await requirePermission("SETTINGS_MANAGE");
  if (!access.ok) return { error: access.error };

  const existing = await getSystemSettingsRow();
  if (!existing?.logoUrl && !existing?.logoPublicId) return { success: true };

  if (existing.logoPublicId) {
    try {
      await destroyCloudinaryAsset(existing.logoPublicId);
    } catch {
      // Best effort — still clear the reference below.
    }
  }

  await prisma.systemSettings.update({
    where: { id: existing.id },
    data: { logoUrl: null, logoPublicId: null },
  });

  revalidatePath("/", "layout");
  return { success: true };
}
