import "server-only";
import { prisma } from "@/lib/prisma";
import type { ResolvedRange } from "@/features/dashboard/date-range";

function bounds(range: ResolvedRange) {
  return { from: range.from ?? new Date(0), to: range.to };
}

export type CustomerProductAnalysis = {
  key: string;
  name: string;
  quantity: number;
  purchases: number;
  totalSpent: number;
  avgPrice: number;
  purchasedPrice: number;
  purchasedDate: Date;
  purchasedQuantity: number;
  currentPrice: number | null;
};

type CustomerProductRow = {
  key: string;
  name: string;
  quantity: string;
  purchases: bigint;
  totalSpent: string;
  purchasedPrice: string;
  purchasedDate: Date;
  purchasedQuantity: string;
  currentPrice: string | null;
};

export async function getCustomerProductAnalysis(
  customerId: string,
  range: ResolvedRange,
): Promise<CustomerProductAnalysis[]> {
  const { from, to } = bounds(range);

  const rows = await prisma.$queryRaw<CustomerProductRow[]>`
    WITH in_period AS (
      SELECT
        COALESCE(ii."productId", ii.name) AS key,
        ii."productId",
        ii.name,
        ii.quantity,
        ii."unitPrice",
        i."createdAt",
        i.id AS "invoiceId"
      FROM public."InvoiceItem" AS ii
      JOIN public."Invoice" AS i
        ON i.id = ii."invoiceId"
      WHERE
        i."customerId" = ${customerId}
        AND i."createdAt" BETWEEN ${from} AND ${to}
    ),

    agg AS (
      SELECT
        key,
        MIN(name) AS name,
        MIN("productId") AS "productId",
        SUM(quantity)::numeric AS quantity,
        COUNT(DISTINCT "invoiceId")::bigint AS purchases,
        SUM(quantity * "unitPrice")::numeric AS "totalSpent"
      FROM in_period
      GROUP BY key
    ),

    ranked AS (
      SELECT
        key,
        "unitPrice",
        "createdAt",
        quantity,
        ROW_NUMBER() OVER (
          PARTITION BY key
          ORDER BY "createdAt" DESC
        ) AS rn
      FROM in_period
    )

    SELECT
      agg.key,
      agg.name,
      agg.quantity,
      agg.purchases,
      agg."totalSpent",

      latest."unitPrice" AS "purchasedPrice",
      latest."createdAt" AS "purchasedDate",
      latest.quantity AS "purchasedQuantity",

      p.price1 AS "currentPrice"

    FROM agg

    JOIN ranked AS latest
      ON latest.key = agg.key
      AND latest.rn = 1

    LEFT JOIN public."Product" AS p
      ON p.id = agg."productId"

    ORDER BY agg."totalSpent" DESC
  `;

  return rows.map((row) => {
    const quantity = Number(row.quantity);
    const totalSpent = Number(row.totalSpent);
    return {
      key: row.key,
      name: row.name,
      quantity,
      purchases: Number(row.purchases),
      totalSpent,
      avgPrice: quantity > 0 ? totalSpent / quantity : 0,
      purchasedPrice: Number(row.purchasedPrice),
      purchasedDate: row.purchasedDate,
      purchasedQuantity: Number(row.purchasedQuantity),
      currentPrice: row.currentPrice !== null ? Number(row.currentPrice) : null,
    };
  });
}
