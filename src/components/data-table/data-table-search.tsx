"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n/locale-provider";

export function DataTableSearch({ placeholder }: { placeholder?: string }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timeout = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (value === current) return;

      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      params.delete("page");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full max-w-sm">
      {isPending ? (
        <Loader2 className="pointer-events-none absolute inset-e-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <Search className="pointer-events-none absolute inset-e-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder ?? t.common.search}
        className="pe-9"
      />
    </div>
  );
}
