import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintErrorOn } from "@/lib/prisma-errors";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Shared generator for the user-facing document numbers shown across the app
 * (tables, search, print/PDF, exports, dialogs, related-document links).
 *
 * Format: `PREFIX-YYYY-MMDD-#####-XX`
 *   PREFIX  document-type prefix (ORD / PO / INV / SR / PR)
 *   YYYY    creation year
 *   MMDD    creation month + day
 *   #####   running count of that document type, zero-padded to 5
 *   XX      two-char check suffix (letter + digit) from a CSPRNG
 *
 * Internal database IDs (cuid) are untouched and stay the identifier for
 * every relation and operation — this only controls the human-readable
 * number stored in the existing `*Number` column.
 */

export type DocumentType =
  | "ORDER"
  | "PURCHASE_ORDER"
  | "INVOICE"
  | "SALES_RETURN"
  | "PURCHASE_RETURN";

const CONFIG: Record<DocumentType, { prefix: string; field: string }> = {
  ORDER: { prefix: "ORD", field: "orderNumber" },
  PURCHASE_ORDER: { prefix: "PO", field: "orderNumber" },
  INVOICE: { prefix: "INV", field: "invoiceNumber" },
  SALES_RETURN: { prefix: "SR", field: "returnNumber" },
  PURCHASE_RETURN: { prefix: "PR", field: "returnNumber" },
};

const MAX_ATTEMPTS = 10;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";

/** Two-char check suffix — CSPRNG only, never Math.random(). */
function randomSuffix(): string {
  return LETTERS[randomInt(LETTERS.length)] + DIGITS[randomInt(DIGITS.length)];
}

function format(prefix: string, seq: number, when: Date): string {
  const yyyy = when.getFullYear();
  const mm = String(when.getMonth() + 1).padStart(2, "0");
  const dd = String(when.getDate()).padStart(2, "0");
  // Padded to 5, never truncated (matches formatSequenceNumber).
  const n = String(Math.max(0, Math.trunc(seq))).padStart(5, "0");
  return `${prefix}-${yyyy}-${mm}${dd}-${n}-${randomSuffix()}`;
}

/**
 * Build a document number for an explicit sequence value (rather than a
 * generated one) — used by invoices, whose `#####` segment must equal the
 * DB-assigned `sequenceNumber` shown in the UI. Not collision-checked: the
 * caller's sequence source is already unique.
 */
export function formatDocumentNumber(
  type: DocumentType,
  seq: number,
  when: Date = new Date(),
): string {
  return format(CONFIG[type].prefix, seq, when);
}

// PrismaClient satisfies TransactionClient structurally, so this accepts
// both the top-level client and a `tx` handle.
type Db = Prisma.TransactionClient;

function countRows(db: Db, type: DocumentType): Promise<number> {
  switch (type) {
    case "ORDER":
      return db.order.count();
    case "PURCHASE_ORDER":
      return db.purchaseOrder.count();
    case "INVOICE":
      return db.invoice.count();
    case "SALES_RETURN":
      return db.salesReturn.count();
    case "PURCHASE_RETURN":
      return db.purchaseReturn.count();
  }
}

async function numberTaken(
  db: Db,
  type: DocumentType,
  value: string,
): Promise<boolean> {
  switch (type) {
    case "ORDER":
      return (
        (await db.order.findUnique({
          where: { orderNumber: value },
          select: { id: true },
        })) !== null
      );
    case "PURCHASE_ORDER":
      return (
        (await db.purchaseOrder.findUnique({
          where: { orderNumber: value },
          select: { id: true },
        })) !== null
      );
    case "INVOICE":
      return (
        (await db.invoice.findUnique({
          where: { invoiceNumber: value },
          select: { id: true },
        })) !== null
      );
    case "SALES_RETURN":
      return (
        (await db.salesReturn.findUnique({
          where: { returnNumber: value },
          select: { id: true },
        })) !== null
      );
    case "PURCHASE_RETURN":
      return (
        (await db.purchaseReturn.findUnique({
          where: { returnNumber: value },
          select: { id: true },
        })) !== null
      );
  }
}

/**
 * Build a fresh document number for `type`, pre-checking the matching
 * table's UNIQUE column so an already-taken value is skipped. The DB
 * constraint stays the real guard — a pre-check alone races concurrent
 * inserts, so callers must also retry on collision (use `withDocumentNumber`).
 */
export async function generateDocumentNumber(
  type: DocumentType,
  db: Db = prisma,
): Promise<string> {
  const { prefix } = CONFIG[type];
  const base = await countRows(db, type);
  const now = new Date();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = format(prefix, base + 1 + attempt, now);
    if (!(await numberTaken(db, type, candidate))) return candidate;
  }
  throw new Error(
    `Could not generate a unique ${type} document number after ${MAX_ATTEMPTS} attempts`,
  );
}

/**
 * Run `create(documentNumber)` with a freshly generated number, retrying
 * with a new one only when the insert collides on that number's UNIQUE
 * index (`meta.target` names the number column). Any other error — including
 * a collision on a different unique field, or a thrown domain error — is
 * rethrown untouched so existing handling still applies.
 */
export async function withDocumentNumber<T>(
  type: DocumentType,
  create: (documentNumber: string) => Promise<T>,
): Promise<T> {
  const { field } = CONFIG[type];
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const documentNumber = await generateDocumentNumber(type);
    try {
      return await create(documentNumber);
    } catch (error) {
      if (!isUniqueConstraintErrorOn(error, field)) throw error;
      lastError = error;
    }
  }
  throw (
    lastError ??
    new Error(`Exhausted ${type} document-number retries (${MAX_ATTEMPTS})`)
  );
}
