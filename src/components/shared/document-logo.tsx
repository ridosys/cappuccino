import { companyConfig } from "@/config/company";

/**
 * Company brand mark for printed / PDF documents (invoices, purchase
 * orders, returns, statements).
 *
 * - When a logo is configured (admin upload, or the company.ts default),
 *   the image is shown on its own.
 * - Otherwise the system name is shown as text.
 *
 * A plain <img> — not next/image — so it renders identically under
 * `print:` and when html2canvas-pro rasterises the node for PDF export;
 * `crossOrigin="anonymous"` keeps the Cloudinary image from tainting that
 * canvas.
 */
export function DocumentLogo({
  logoUrl,
  name,
  imgClassName = "h-12 w-auto max-w-[200px] object-contain print:h-10",
  nameClassName = "text-2xl font-bold print:text-lg",
}: {
  logoUrl: string | null;
  /** System name, shown as text when there is no logo. */
  name: string;
  imgClassName?: string;
  nameClassName?: string;
}) {
  const src = logoUrl ?? companyConfig.logo;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded URL, may be SVG
      <img
        src={src}
        alt={name}
        crossOrigin="anonymous"
        className={imgClassName}
      />
    );
  }

  return <span className={nameClassName}>{name}</span>;
}
