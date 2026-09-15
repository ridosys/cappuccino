import { cn } from "@/lib/utils";

const AVATAR_TONES = [
  "bg-primary/10 text-primary",
  "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
];

/** Deterministic color per seed, so the same customer always gets the same
 * fallback tone across pages instead of a random one on every render. */
function toneFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/**
 * A customer's photo, or a colored initial when they don't have one —
 * shared between the dashboard (table, profile) and La Caisse (customer
 * picker, cart) so a customer's avatar looks the same everywhere.
 */
export function CustomerAvatar({
  name,
  imageUrl,
  seed,
  className,
}: {
  name: string;
  imageUrl?: string | null;
  /** Stable id to key the fallback color off — defaults to `name`, but a
   * customer id avoids two same-named customers sharing a color. */
  seed?: string;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL, arbitrary source size handled by object-cover
      <img
        src={imageUrl}
        alt={name}
        className={cn("size-9 shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full font-semibold",
        toneFor(seed ?? name),
        className,
      )}
    >
      {name.charAt(0).toUpperCase() || "?"}
    </span>
  );
}
