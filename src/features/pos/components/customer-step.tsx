"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, ChevronDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { useLocale } from "@/i18n/locale-provider";
import { searchPosCustomersAction } from "@/features/pos/actions";
import type { PosCustomer } from "@/features/pos/queries";

export function CustomerStep({
  initialCustomers,
  onSelect,
}: {
  initialCustomers: { items: PosCustomer[]; hasMore: boolean };
  onSelect: (customer: PosCustomer) => void;
}) {
  const { t } = useLocale();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PosCustomer[]>(initialCustomers.items);
  const [hasMore, setHasMore] = useState(initialCustomers.hasMore);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Belt-and-suspenders against duplicate rows across pages (e.g. two
  // customers created in the same instant sorting unstably between
  // requests): every id we've already rendered, so an appended page never
  // reintroduces one and trips React's duplicate-key warning.
  const seenRef = useRef<Set<string>>(new Set(initialCustomers.items.map((c) => c.id)));

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const timeout = setTimeout(async () => {
      setSearching(true);
      const data = await searchPosCustomersAction(query, 0);
      if (requestId !== requestIdRef.current) return;
      seenRef.current = new Set(data.items.map((c) => c.id));
      setResults(data.items);
      setHasMore(data.hasMore);
      setSearching(false);
      scrollRef.current?.scrollTo({ top: 0 });
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const offset = results.length;
  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    const data = await searchPosCustomersAction(query, offset);
    const fresh = data.items.filter((c) => !seenRef.current.has(c.id));
    fresh.forEach((c) => seenRef.current.add(c.id));
    setResults((prev) => [...prev, ...fresh]);
    setHasMore(data.hasMore);
    setLoadingMore(false);
  }, [query, offset]);

  // Infinite scroll: load the next page when the sentinel enters the
  // results viewport.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) loadMore();
      },
      { root, rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  return (
    <div
      ref={scrollRef}
      className="flex w-full flex-1 flex-col gap-6 overflow-y-auto p-6"
    >
      <Stepper t={t} />

      <div className="flex w-full flex-1 flex-col rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">
          {t.pos.selectCustomerTitle}
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.pos.customerSearchPlaceholder}
            className="ps-9"
          />
        </div>

        <div className="mt-4">
          {searching && results.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto size-5 animate-spin" />
            </p>
          ) : results.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t.pos.noCustomersFound}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {results.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  onClick={() => onSelect(customer)}
                />
              ))}
            </div>
          )}

          <div ref={sentinelRef} className="h-px w-full" />

          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="flex w-full items-center justify-center gap-1.5 py-3 text-sm font-medium text-primary"
            >
              {loadingMore ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ChevronDown className="size-4" />
              )}
              {t.pos.viewMoreCustomers}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomerCard({
  customer,
  onClick,
}: {
  customer: PosCustomer;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2.5 rounded-xl border bg-background p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:translate-y-0 active:shadow-none"
    >
      <CustomerAvatar
        name={customer.name}
        imageUrl={customer.imageUrl}
        seed={customer.id}
        className="size-14 text-lg transition-colors group-hover:ring-2 group-hover:ring-primary"
      />
      <span className="line-clamp-2 text-sm font-semibold">
        {customer.name}
      </span>
    </button>
  );
}

function Stepper({ t }: { t: ReturnType<typeof useLocale>["t"] }) {
  return (
    <div className="flex items-center justify-center gap-3 text-sm">
      <span className="flex items-center gap-2 font-semibold text-primary">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          1
        </span>
        {t.pos.stepCustomer}
      </span>
      <span className="h-px w-10 bg-border" />
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className="flex size-6 items-center justify-center rounded-full border text-xs">
          2
        </span>
        {t.pos.stepSelling}
      </span>
    </div>
  );
}
