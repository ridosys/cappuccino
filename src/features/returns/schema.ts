import { z } from "zod";

const quantity = z.number().positive();

export const salesReturnSchema = z.object({
  invoiceId: z.string().min(1),
  reason: z.string().trim().min(2).max(500),
  notes: z.string().trim().max(1000).optional(),
  refundMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER", "CUSTOMER_CREDIT", "NO_IMMEDIATE_REFUND"]),
  refundAmount: z.number().min(0),
  items: z.array(z.object({
    invoiceItemId: z.string().min(1),
    quantity,
    condition: z.enum(["GOOD", "DAMAGED", "DEFECTIVE"]),
  })).min(1),
});

export const purchaseReturnSchema = z.object({
  purchaseId: z.string().min(1),
  reason: z.string().trim().min(2).max(500),
  notes: z.string().trim().max(1000).optional(),
  refundMethod: z.enum(["CASH", "BANK_TRANSFER", "SUPPLIER_CREDIT", "NO_IMMEDIATE_REFUND"]),
  refundAmount: z.number().min(0),
  items: z.array(z.object({
    purchaseOrderItemId: z.string().min(1),
    quantity,
    reason: z.string().trim().max(500).optional(),
  })).min(1),
});
