"use client";

import type { PosCustomer } from "@/features/pos/queries";
import type { CartLine, SaleResult } from "./types";

const KEY = "pos:session";

/** In-progress sale, mirrored to sessionStorage so a full-page reload
 * (changing the UI language triggers one) never drops the selected
 * customer, the cart, or an open success dialog. */
export type PosSession = {
  step: "customer" | "sell";
  customer: PosCustomer | null;
  lines: CartLine[];
  saleToken: string;
  resumedHeldId: string | null;
  activeCategory: string;
  activeCategoryName: string;
  sale: SaleResult | null;
};

export function readPosSession(): Partial<PosSession> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<PosSession>) : null;
  } catch {
    return null;
  }
}

export function writePosSession(session: PosSession) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // storage unavailable — persistence is best-effort
  }
}

export function clearPosSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
