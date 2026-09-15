"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGrid, Folder, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarcodeScanner } from "@/components/shared/barcode-scanner";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { PosCategory } from "@/features/pos/queries";

export type { PosCategory };

type Feed = { total: number; items: PosCategory[]; nextOffset: number | null };

export function CategoryRail({
  initial,
  activeId,
  onSelect,
  onBarcodeScan,
}: {
  initial: Feed;
  activeId: string;
  onSelect: (id: string, name: string) => void;
  onBarcodeScan: (barcode: string) => void;
}) {
  const { t } = useLocale();
  const [items, setItems] = useState<PosCategory[]>(initial.items);
  const [nextOffset, setNextOffset] = useState<number | null>(initial.nextOffset);
  const [loading, setLoading] = useState(false);
  const seenRef = useRef<Set<string>>(new Set(initial.items.map((c) => c.id)));
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pos/categories?offset=${offset}`);
      if (!res.ok) return;
      const data = (await res.json()) as Feed;
      const fresh = data.items.filter((c) => !seenRef.current.has(c.id));
      fresh.forEach((c) => seenRef.current.add(c.id));
      setItems((prev) => [...prev, ...fresh]);
      setNextOffset(data.nextOffset);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextOffset !== null && !loading) {
          loadMore(nextOffset);
        }
      },
      { root, rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextOffset, loading, loadMore]);

  const rows: PosCategory[] = [
    { id: "ALL", name: t.pos.allCategories, count: initial.total, image: null },
    ...items,
  ];

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {rows.map((row) => {
            const active = row.id === activeId;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onSelect(row.id, row.name)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  {row.id === "ALL" ? (
                    <LayoutGrid className="size-4 shrink-0" />
                  ) : (
                    <Folder className="size-4 shrink-0" />
                  )}
                  <span className="flex-1 truncate font-medium">{row.name}</span>
                  <span
                    className={cn(
                      "shrink-0 text-xs tabular-nums",
                      active
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground",
                    )}
                  >
                    {row.count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div ref={sentinelRef} className="h-px w-full" />

        {loading && (
          <div className="space-y-1 pt-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        )}
        {loading && (
          <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            {t.pos.loadingMoreProducts}
          </p>
        )}
      </div>
      <div className="border-t p-2">
        <BarcodeScanner onScan={onBarcodeScan} showLabel />
      </div>
    </aside>
  );
}
