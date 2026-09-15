import { Prisma } from "@/generated/prisma/client";

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * A P2002 unique-constraint violation that involves `field` — the pg adapter
 * reports `meta.target` as either the column list (["orderNumber"]) or the
 * index name ("Order_orderNumber_key"), so both shapes are checked.
 */
export function isUniqueConstraintErrorOn(
  error: unknown,
  field: string,
): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  if (Array.isArray(target)) return target.includes(field);
  if (typeof target === "string") return target.includes(field);
  return false;
}

export function isForeignKeyConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2003" || error.code === "P2014")
  );
}
