"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Plus,
  Minus,
  PackageX,
  Loader2,
  ImageOff,
  ArrowDownUp,
  PackageCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { PosProduct, PosProductSort } from "@/features/pos/queries";

type Feed = { items: PosProduct[]; total: number; nextOffset: number | null };

const BASE_SORT_KEYS: PosProductSort[] = [
  "best",
  "newest",
  "name",
  "priceAsc",
  "priceDesc",
  "stockDesc",
];

export function ProductGrid({
  initial,
  categoryId,
  query,
  categoryName,
  customerId,
  cartQuantities,
  onAddProduct,
  onIncrement,
  onDecrement,
}: {
  initial: Feed;
  categoryId: string;
  query: string;
  categoryName: string;
  /** The selected customer — enables the "most bought by this customer" sort. */
  customerId?: string | null;
  cartQuantities: Record<string, number>;
  onAddProduct: (product: PosProduct) => void;
  onIncrement: (product: PosProduct) => void;
  onDecrement: (product: PosProduct) => void;
}) {
  const { locale, t } = useLocale();
  const [items, setItems] = useState<PosProduct[]>(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [nextOffset, setNextOffset] = useState<number | null>(initial.nextOffset);
  const [loading, setLoading] = useState(false);
  // With a customer selected, default to their own purchase history.
  const [sort, setSort] = useState<PosProductSort>(
    customerId ? "customerFrequent" : "best",
  );
  const [inStockOnly, setInStockOnly] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef<Set<string>>(new Set(initial.items.map((p) => p.id)));
  const requestIdRef = useRef(0);
  const didMountRef = useRef(false);

  const sortKeys: PosProductSort[] = customerId
    ? ["customerFrequent", ...BASE_SORT_KEYS]
    : BASE_SORT_KEYS;

  const sortLabels: Record<PosProductSort, string> = {
    best: t.pos.sortBest,
    customerFrequent: t.pos.sortCustomerFrequent,
    newest: t.pos.sortNewest,
    name: t.pos.sortName,
    priceAsc: t.pos.sortPriceAsc,
    priceDesc: t.pos.sortPriceDesc,
    stockDesc: t.pos.sortStockDesc,
  };

  const fetchPage = useCallback(
    async (reset: boolean, offset: number) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryId && categoryId !== "ALL") params.set("categoryId", categoryId);
      if (query.trim()) params.set("q", query.trim());
      if (sort !== "best") params.set("sort", sort);
      if (sort === "customerFrequent" && customerId) {
        params.set("customerId", customerId);
      }
      if (inStockOnly) params.set("inStock", "1");
      if (offset > 0) params.set("offset", String(offset));

      try {
        const res = await fetch(`/api/pos/products?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as Feed;
        if (requestId !== requestIdRef.current) return; // stale response

        if (reset) {
          seenRef.current = new Set(data.items.map((p) => p.id));
          setItems(data.items);
          scrollRef.current?.scrollTo({ top: 0 });
        } else {
          const fresh = data.items.filter((p) => !seenRef.current.has(p.id));
          fresh.forEach((p) => seenRef.current.add(p.id));
          setItems((prev) => [...prev, ...fresh]);
        }
        setTotal(data.total);
        setNextOffset(data.nextOffset);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [categoryId, query, sort, inStockOnly, customerId],
  );

  // Reset + reload whenever the category, search, sort, filter or customer
  // changes. On the very first run the server-rendered feed already matches
  // the default view (best-sorted, no filters), so skip the refetch then —
  // but a non-default starting state (e.g. the customer-history sort) still
  // needs its first load.
  useEffect(() => {
    const firstRun = !didMountRef.current;
    didMountRef.current = true;
    if (firstRun && sort === "best" && !inStockOnly) return;
    fetchPage(true, 0);
  }, [categoryId, query, sort, inStockOnly, fetchPage]);

  // Infinite scroll: load the next page when the sentinel enters view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextOffset !== null && !loading) {
          fetchPage(false, nextOffset);
        }
      },
      { root, rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextOffset, loading, fetchPage]);

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <h2 className="mr-auto truncate text-sm font-semibold">{categoryName}</h2>
        <span className="text-xs text-muted-foreground">
          {formatMessage(t.pos.productsCountTemplate, { count: total })}
        </span>
        <Button
          type="button"
          size="sm"
          variant={inStockOnly ? "default" : "outline"}
          onClick={() => setInStockOnly((v) => !v)}
        >
          <PackageCheck className="size-3.5" />
          {t.pos.inStockOnly}
        </Button>
        <Select
          value={sort}
          onValueChange={(value) => setSort(value as PosProductSort)}
        >
          <SelectTrigger size="sm" icon={ArrowDownUp} aria-label={t.pos.sortLabel}>
            <SelectValue>
              {(value: string) =>
                sortLabels[value as PosProductSort] ?? value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {sortKeys.map((key) => (
              <SelectItem key={key} value={key}>
                {sortLabels[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3">
        {items.length === 0 && !loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <PackageX className="size-8" />
            <p className="text-sm">{t.pos.noProductsFound}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                quantity={cartQuantities[product.id] ?? 0}
                locale={locale}
                onAdd={() => onAddProduct(product)}
                onIncrement={() => onIncrement(product)}
                onDecrement={() => onDecrement(product)}
                addLabel={t.pos.addToCart}
                stockLabel={t.pos.stockLabel}
              />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-px w-full" />

        {loading && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        )}

        {loading && items.length > 0 && (
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {t.pos.loadingMoreProducts}
          </p>
        )}
        {!loading && nextOffset !== null && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {t.pos.scrollToLoadMore}
          </p>
        )}
      </div>
    </section>
  );
}

function ProductCard({
  product,
  quantity,
  locale,
  onAdd,
  onIncrement,
  onDecrement,
  addLabel,
  stockLabel,
}: {
  product: PosProduct;
  quantity: number;
  locale: "ar" | "en" | "fr";
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  addLabel: string;
  stockLabel: string;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-background">
      <button
        type="button"
        onClick={onAdd}
        className="relative aspect-square w-full bg-muted"
      >
        {product.image ? (
          <>
            {!imgLoaded && <Skeleton className="absolute inset-0" />}
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="160px"
              onLoad={() => setImgLoaded(true)}
              className={cn(
                "object-contain p-2 transition-opacity",
                imgLoaded ? "opacity-100" : "opacity-0",
              )}
            />
          </>
        ) : (
          <span className="flex h-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-6" />
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <p className="line-clamp-2 text-xs font-medium" title={product.name}>
          {product.name}
        </p>
        <p className="text-sm font-semibold">
          {formatCurrency(product.price, locale)}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span
            className={cn(
              "text-[11px] tabular-nums",
              product.stock <= 0 ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {stockLabel}: {product.stock}
          </span>
          {quantity > 0 ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon-xs"
                variant="outline"
                onClick={onDecrement}
                aria-label="-"
              >
                <Minus />
              </Button>
              <span className="min-w-6 text-center text-xs font-semibold tabular-nums">
                {quantity}
              </span>
              <Button
                type="button"
                size="icon-xs"
                variant="outline"
                onClick={onIncrement}
                aria-label="+"
              >
                <Plus />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="icon-xs"
              onClick={onAdd}
              aria-label={addLabel}
            >
              <Plus />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
