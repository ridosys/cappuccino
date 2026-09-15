export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ensureUniqueSlug(base: string, taken: Set<string>): string {
  const safeBase = base || "product";
  let candidate = safeBase;
  let suffix = 1;
  while (taken.has(candidate)) {
    candidate = `${safeBase}-${suffix}`;
    suffix++;
  }
  taken.add(candidate);
  return candidate;
}
