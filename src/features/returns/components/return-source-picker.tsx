"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchReturnSources } from "@/features/returns/actions";
import { useT } from "@/i18n/locale-provider";

type Source = {
  id: string;
  number: string;
  party: string;
};

export function ReturnSourcePicker({
  kind,
  selectedId,
  queryKey,
  placeholder,
}: {
  kind: "sales" | "purchase";
  selectedId?: string;
  queryKey: "invoiceId" | "purchaseId";
  placeholder: string;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim();
  const [results, setResults] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!normalizedQuery) {
      return;
    }
    let active = true;
    const timeout = window.setTimeout(async () => {
      const rows = await searchReturnSources(kind, normalizedQuery);
      if (active) {
        setResults(rows);
        setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [kind, normalizedQuery]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setLoading(Boolean(value.trim()));
            if (!value.trim()) {
              setResults([]);
              setLoading(false);
            }
          }}
          placeholder={placeholder}
          className="ps-9"
          autoComplete="off"
        />
        {loading && <Loader2 className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {normalizedQuery && (
        <div className="max-h-72 max-w-xl overflow-y-auto rounded-md border">
          {!loading && results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {t.returns.noInvoiceMatch}
            </p>
          ) : !loading ? (
            results.map((source) => (
              <Link
                key={source.id}
                href={`?${queryKey}=${source.id}`}
                className={`block border-b px-4 py-3 text-sm last:border-b-0 hover:bg-muted ${
                  selectedId === source.id ? "bg-primary/10" : ""
                }`}
              >
                <span className="font-semibold">{source.number}</span>
                <span className="text-muted-foreground"> — {source.party}</span>
              </Link>
            ))
          ) : null}
        </div>
      )}

      {!normalizedQuery && (
        <p className="text-xs text-muted-foreground">
          {t.returns.searchHint}
        </p>
      )}
    </div>
  );
}
