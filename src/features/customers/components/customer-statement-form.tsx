"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/locale-provider";

export function CustomerStatementForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const t = useT();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function openStatement() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    router.push(
      `/dashboard/customers/${customerId}/statement${query ? `?${query}` : ""}`,
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t.customers.statementDescription}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="statement-from">{t.customers.fromDateLabel}</Label>
          <Input
            id="statement-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="statement-to">{t.customers.toDateLabel}</Label>
          <Input
            id="statement-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>
      <Button type="button" className="w-full" onClick={openStatement}>
        <FileDown className="size-4" />
        {t.customers.generateStatementButton}
      </Button>
    </div>
  );
}
