import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions";
import { createUploadSignature } from "@/lib/cloudinary";

export async function POST() {
  const access = await requireApiPermission("PURCHASES_MANAGE");
  if (!access.ok) return access.response;

  const folder = "inventory-system/purchase-attachments";
  const { timestamp, signature } = createUploadSignature({ folder });

  return NextResponse.json({
    timestamp,
    signature,
    folder,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
}
