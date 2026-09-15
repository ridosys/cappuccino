import Image from "next/image";
import { Store } from "lucide-react";
import { companyConfig } from "@/config/company";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "size-7", icon: "size-4", px: 28 },
  md: { box: "size-8", icon: "size-4.5", px: 32 },
  lg: { box: "size-9", icon: "size-4.5", px: 36 },
  xl: { box: "size-14", icon: "size-7", px: 56 },
  "2xl": { box: "size-20", icon: "size-10", px: 80 },
} as const;

/**
 * The app's brand mark — renders the custom company logo when one is set
 * (Settings → appearance), then the logo from company.ts, and otherwise
 * the default icon badge. Shared by the sidebar, login, and cashier screens
 * so there's one place to change how the logo renders.
 *
 * `logoUrl` is the admin-uploaded logo (from `getSystemSettings()`); pass
 * it wherever the settings are already loaded. A `null`/absent value just
 * falls back to the company.ts default.
 */
export function BrandMark({
  size = "md",
  className,
  logoUrl,
}: {
  size?: keyof typeof SIZES;
  className?: string;
  logoUrl?: string | null;
}) {
  const { box, icon, px } = SIZES[size];
  const custom = logoUrl ?? null;

  if (custom) {
    // Uploaded logos are arbitrary Cloudinary URLs (including SVG), so
    // they're not covered by next/image's optimizer config — same pattern
    // as the brand-logo field elsewhere in the app.
    return (
      // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded URL, may be SVG
      <img
        src={custom}
        alt={companyConfig.name}
        width={px}
        height={px}
        className={cn(box, "shrink-0 rounded-lg object-contain", className)}
      />
    );
  }

  if (companyConfig.logo) {
    return (
      <Image
        src={companyConfig.logo}
        alt={companyConfig.name}
        width={px}
        height={px}
        className={cn(box, "shrink-0 rounded-lg object-contain", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm",
        box,
        className,
      )}
    >
      <Store className={icon} />
    </span>
  );
}
