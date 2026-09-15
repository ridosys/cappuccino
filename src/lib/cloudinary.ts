import "server-only";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export function createUploadSignature(paramsToSign: Record<string, string | number>) {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { ...paramsToSign, timestamp },
    process.env.CLOUDINARY_API_SECRET as string,
  );
  return { timestamp, signature };
}

/**
 * Server-side upload of an already-validated asset (a data URI or remote
 * URL). Used where the file must be checked on the server first — e.g. the
 * company logo — instead of the signed browser-direct upload flow. Always
 * uploaded as an image resource.
 */
export async function uploadCloudinaryAsset(
  data: string,
  options: { folder: string; publicId?: string },
): Promise<{ publicId: string; secureUrl: string }> {
  const result = await cloudinary.uploader.upload(data, {
    folder: options.folder,
    public_id: options.publicId,
    overwrite: true,
    resource_type: "image",
  });
  return { publicId: result.public_id, secureUrl: result.secure_url };
}

export async function destroyCloudinaryAsset(
  publicId: string,
  resourceType: "image" | "raw" | "video" = "image",
) {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

export { cloudinary };
