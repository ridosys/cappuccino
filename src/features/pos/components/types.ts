import type { PosProduct, PosCustomer } from "@/features/pos/queries";
import type { PAYMENT_LINE_METHODS } from "@/features/pos/schema";

export type PosPaymentMethod = (typeof PAYMENT_LINE_METHODS)[number];

export type CartLine = {
  product: PosProduct;
  quantity: number;
};

export type SaleResult = {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  total: number;
  paid: number;
  change: number;
  credited: number;
  method: PosPaymentMethod;
  language: "AR" | "EN" | "FR";
};

export type HeldSale = {
  id: string;
  customer: PosCustomer;
  lines: CartLine[];
  createdAt: number;
};
