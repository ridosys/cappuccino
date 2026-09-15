"use client";

import { useCallback, useEffect, useState } from "react";
import type { HeldSale } from "./types";

const STORAGE_KEY = "pos:heldSales";

function read(): HeldSale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HeldSale[]) : [];
  } catch {
    return [];
  }
}

function write(sales: HeldSale[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sales));
  } catch {
    // storage unavailable (private mode / disabled) — hold is best-effort
  }
}

/** Client-only "hold sale" store. Holding never touches the server: no
 * invoice, no stock movement — just a cart parked in localStorage. */
export function useHeldSales() {
  // Starts empty so server and first client render agree; the stored list
  // is loaded a tick after mount (no hydration mismatch).
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);

  useEffect(() => {
    const id = setTimeout(() => setHeldSales(read()), 0);
    return () => clearTimeout(id);
  }, []);

  const hold = useCallback((sale: HeldSale) => {
    setHeldSales((prev) => {
      const next = [sale, ...prev.filter((s) => s.id !== sale.id)];
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setHeldSales((prev) => {
      const next = prev.filter((s) => s.id !== id);
      write(next);
      return next;
    });
  }, []);

  return { heldSales, hold, remove };
}
