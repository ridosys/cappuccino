import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createInvoice } from "@/features/invoices/actions";
import { normalizeText, textScore } from "@/features/purchases/matching";
import { getProductsForVoiceMatching } from "@/features/telegram/queries";
import {
  indexProductsForVoice,
  matchSpokenProduct,
  type VoiceMatch,
} from "@/features/telegram/matching";
import type { ExtractedIntent } from "@/features/telegram/schema";
import type {
  InvoiceLanguage,
  TelegramDraftStatus,
  TelegramMatchStatus,
} from "@/generated/prisma/enums";

export const DRAFT_TTL_MINUTES = 30;

export function generateDraftToken(): string {
  return randomUUID();
}

const draftWithItemsInclude = {
  items: {
    orderBy: { position: "asc" as const },
    include: {
      matchedProduct: {
        select: { id: true, name: true, price1: true, status: true },
      },
    },
  },
  customer: { select: { id: true, name: true, phone: true, email: true } },
} as const;

export type DraftWithItems = Awaited<
  ReturnType<typeof getActiveDraftForAccount>
>;

export async function getActiveDraftForAccount(telegramAccountId: string) {
  return prisma.telegramInvoiceDraft.findFirst({
    where: {
      telegramAccountId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    include: draftWithItemsInclude,
  });
}

export async function getDraftByToken(token: string) {
  return prisma.telegramInvoiceDraft.findUnique({
    where: { token },
    include: draftWithItemsInclude,
  });
}

const MATCH_STATUS_RANK: Record<VoiceMatch["status"], number> = {
  EXACT: 3,
  STRONG: 2,
  AMBIGUOUS: 1,
  NOT_FOUND: 0,
};

/** Picks the stronger of two match attempts (e.g. the original spoken text
 * vs its other-script transliteration) — higher status tier wins, ties
 * broken by top-candidate score. */
function bestVoiceMatch(a: VoiceMatch, b: VoiceMatch | null): VoiceMatch {
  if (!b) return a;
  const rankA = MATCH_STATUS_RANK[a.status];
  const rankB = MATCH_STATUS_RANK[b.status];
  if (rankB !== rankA) return rankB > rankA ? b : a;
  const scoreA = a.candidates[0]?.score ?? 0;
  const scoreB = b.candidates[0]?.score ?? 0;
  return scoreB > scoreA ? b : a;
}

async function matchIntentItems(
  items: {
    spokenName: string | null;
    spokenNameAlt?: string | null;
    quantity: number | null;
  }[],
) {
  const products = await getProductsForVoiceMatching();
  const indexed = indexProductsForVoice(products);

  return items
    .filter((item) => item.spokenName && item.spokenName.trim())
    .map((item, index) => {
      const spokenName = item.spokenName!.trim();
      const primary = matchSpokenProduct(spokenName, indexed);
      const altText = item.spokenNameAlt?.trim();
      const alt = altText ? matchSpokenProduct(altText, indexed) : null;
      const match = bestVoiceMatch(primary, alt);
      const quantity =
        item.quantity != null && item.quantity > 0 ? item.quantity : 1;
      return {
        spokenName,
        quantity,
        matchStatus: match.status as TelegramMatchStatus,
        matchedProductId: match.matchedProductId,
        candidateProductIds: match.candidates.map((c) => c.productId),
        position: index + 1,
      };
    });
}

export async function createDraftFromIntent(
  telegramAccountId: string,
  intent: ExtractedIntent,
  rawTranscript: string,
) {
  const matched = await matchIntentItems(intent.items);

  await prisma.telegramInvoiceDraft.updateMany({
    where: { telegramAccountId, status: "PENDING" },
    data: { status: "EXPIRED" },
  });

  const draft = await prisma.telegramInvoiceDraft.create({
    data: {
      token: generateDraftToken(),
      telegramAccountId,
      rawTranscript,
      expiresAt: new Date(Date.now() + DRAFT_TTL_MINUTES * 60_000),
      items: { create: matched },
    },
    include: draftWithItemsInclude,
  });
  return draft;
}

export type ApplyIntentResult =
  | { ok: true; draft: NonNullable<DraftWithItems> }
  | { ok: false; reason: "no_active_draft" };

export async function applyIntentToActiveDraft(
  telegramAccountId: string,
  intent: ExtractedIntent,
): Promise<ApplyIntentResult> {
  const active = await getActiveDraftForAccount(telegramAccountId);
  if (!active) return { ok: false, reason: "no_active_draft" };

  if (intent.action === "ADD_ITEM") {
    const matched = await matchIntentItems(intent.items);
    for (const item of matched) {
      const existing = item.matchedProductId
        ? active.items.find((i) => i.matchedProductId === item.matchedProductId)
        : undefined;
      if (existing) {
        await prisma.telegramInvoiceDraftItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity.toNumber() + item.quantity },
        });
      } else {
        await prisma.telegramInvoiceDraftItem.create({
          data: {
            ...item,
            draftId: active.id,
            position: active.items.length + 1,
          },
        });
      }
    }
  } else if (intent.action === "REMOVE_ITEM") {
    for (const item of intent.items) {
      const target = findBestDraftItemMatch(
        active.items,
        item.spokenName,
        item.spokenNameAlt,
      );
      if (target) {
        await prisma.telegramInvoiceDraftItem.delete({
          where: { id: target.id },
        });
      }
    }
  } else if (intent.action === "SET_QUANTITY") {
    for (const item of intent.items) {
      const target = findBestDraftItemMatch(
        active.items,
        item.spokenName,
        item.spokenNameAlt,
      );
      if (target && item.quantity != null && item.quantity > 0) {
        await prisma.telegramInvoiceDraftItem.update({
          where: { id: target.id },
          data: { quantity: item.quantity },
        });
      }
    }
  }

  await prisma.telegramInvoiceDraft.update({
    where: { id: active.id },
    data: {},
  });
  const refreshed = await getDraftByToken(active.token);
  return { ok: true, draft: refreshed! };
}

function findBestDraftItemMatch(
  items: NonNullable<DraftWithItems>["items"],
  spokenName: string | null,
  spokenNameAlt?: string | null,
) {
  if (items.length === 0) return null;
  // Same cross-script problem as product matching — try both the original
  // text and its other-script transliteration, keep whichever scores
  // higher per draft item.
  const queries = [spokenName, spokenNameAlt]
    .filter((s): s is string => Boolean(s && s.trim()))
    .map((s) => normalizeText(s));
  if (queries.length === 0) return null;

  let best: { item: (typeof items)[number]; score: number } | null = null;
  for (const item of items) {
    const label = normalizeText(item.matchedProduct?.name ?? item.spokenName);
    const score = Math.max(...queries.map((q) => textScore(q, label)));
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score >= 0.3 ? best.item : null;
}

export async function pickCandidateForItem(itemId: string, productId: string) {
  const item = await prisma.telegramInvoiceDraftItem.findUnique({
    where: { id: itemId },
  });
  if (!item || !item.candidateProductIds.includes(productId)) return null;
  return prisma.telegramInvoiceDraftItem.update({
    where: { id: itemId },
    data: { matchedProductId: productId, matchStatus: "STRONG" },
  });
}

/** Sets the draft's customer — guarded to a PENDING draft via the same
 * conditional-update idiom used elsewhere, so a stray callback/voice message
 * against an already-confirmed/cancelled draft is a silent no-op instead of
 * mutating a settled record. Caller is responsible for having already
 * verified `customerId` is a real `Customer` row. */
export async function setDraftCustomer(draftId: string, customerId: string) {
  const updated = await prisma.telegramInvoiceDraft.updateMany({
    where: { id: draftId, status: "PENDING" },
    data: { customerId },
  });
  return updated.count > 0;
}

export type DraftTotals = {
  total: number;
  hasUnresolvedItems: boolean;
  lines: {
    itemId: string;
    label: string;
    quantity: number;
    unitPrice: number | null;
    lineTotal: number | null;
    matchStatus: TelegramMatchStatus;
  }[];
};

export function computeDraftTotals(
  draft: NonNullable<DraftWithItems>,
): DraftTotals {
  let total = 0;
  let hasUnresolvedItems = false;
  const lines = draft.items.map((item) => {
    const product =
      item.matchedProductId && item.matchedProduct?.status === "ACTIVE"
        ? item.matchedProduct
        : null;
    const unitPrice = product ? Number(product.price1) : null;
    const quantity = item.quantity.toNumber();
    const lineTotal = unitPrice != null ? unitPrice * quantity : null;
    if (lineTotal != null) total += lineTotal;
    if (
      !product ||
      item.matchStatus === "AMBIGUOUS" ||
      item.matchStatus === "NOT_FOUND"
    ) {
      hasUnresolvedItems = true;
    }
    return {
      itemId: item.id,
      label: product?.name ?? item.spokenName,
      quantity,
      unitPrice,
      lineTotal,
      matchStatus: item.matchStatus,
    };
  });
  return { total, hasUnresolvedItems, lines };
}

export type ConfirmDraftResult =
  | { ok: true; invoiceId: string; alreadyExists?: boolean }
  | {
      ok: false;
      reason:
        | "not_pending"
        | "no_customer"
        | "unresolved_items"
        | "empty"
        | "invoice_error";
      message?: string;
    };
export async function confirmDraft(
  draftId: string,
  adminId: string,
  invoiceLanguage: InvoiceLanguage,
): Promise<ConfirmDraftResult> {
  const draft = await prisma.telegramInvoiceDraft.findUnique({
    where: { id: draftId },
    include: draftWithItemsInclude,
  });
  if (!draft) return { ok: false, reason: "not_pending" };

  if (draft.status !== "PENDING") {
    if (draft.invoiceId)
      return { ok: true, invoiceId: draft.invoiceId, alreadyExists: true };
    return { ok: false, reason: "not_pending" };
  }

  if (!draft.customerId || !draft.customer) {
    return { ok: false, reason: "no_customer" };
  }
  if (draft.items.length === 0) return { ok: false, reason: "empty" };

  const totals = computeDraftTotals(draft);
  if (totals.hasUnresolvedItems)
    return { ok: false, reason: "unresolved_items" };

  const items = totals.lines.map((line) => ({
    productId: draft.items.find((i) => i.id === line.itemId)!.matchedProductId!,
    name: line.label,
    quantity: line.quantity,
    unitPrice: line.unitPrice!,
  }));

  const result = await createInvoice(
    {
      language: invoiceLanguage,
      customerId: draft.customer.id,
      customerName: draft.customer.name,
      customerPhone: draft.customer.phone,
      customerEmail: draft.customer.email ?? "",
      items,
      payments: [],
    },
    {
      allowNegativeStock: true,
      redirect: false,
      permission: "POS_MANAGE",
      posSaleToken: draft.token,
      actingAdminId: adminId,
      createdByBot: true,
    },
  );

  if (result.error || !result.invoiceId) {
    return { ok: false, reason: "invoice_error", message: result.error };
  }

  await prisma.telegramInvoiceDraft.update({
    where: { id: draft.id },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      invoiceId: result.invoiceId,
    },
  });

  return { ok: true, invoiceId: result.invoiceId };
}

export async function cancelDraft(draftId: string) {
  return prisma.telegramInvoiceDraft.updateMany({
    where: { id: draftId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}

export type { TelegramDraftStatus };
