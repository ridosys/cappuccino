/**
 * Rewrites a Cloudinary delivery URL to force a browser download (via the
 * `fl_attachment` flag) instead of opening inline in a new tab. Cloudinary
 * sends back the file's original uploaded name in the Content-Disposition
 * header by default, so this needs no extra filename encoding — client-safe
 * (no Cloudinary SDK/credentials involved), unlike `@/lib/cloudinary.ts`.
 */
export function toCloudinaryDownloadUrl(secureUrl: string): string {
  return secureUrl.includes("/upload/")
    ? secureUrl.replace("/upload/", "/upload/fl_attachment/")
    : secureUrl;
}
