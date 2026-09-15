"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { createSalesReturn, createPurchaseReturn } from "../actions";
import { formatCurrency } from "@/lib/currency";
import { useLocale } from "@/i18n/locale-provider";

type Row = { id: string; productName: string; sku: string; barcode: string | null; original: number; returned: number; unitAmount: number; stock?: number };

export function ReturnForm({ kind, sourceId, rows }: { kind: "sales" | "purchase"; sourceId: string; rows: Row[] }) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [conditions, setConditions] = useState<Record<string, "GOOD" | "DAMAGED" | "DEFECTIVE">>({});
  const [reason, setReason] = useState(""); const [notes, setNotes] = useState("");
  const [refundMethod, setRefundMethod] = useState(kind === "sales" ? "CASH" : "SUPPLIER_CREDIT");
  const [refundAmount, setRefundAmount] = useState(0); const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const total = useMemo(() => rows.reduce((sum, row) => selected[row.id] ? sum + (quantities[row.id] || 0) * row.unitAmount : sum, 0), [rows, selected, quantities]);
  const methodLabels: Record<string, string> = {
    CASH: t.returns.cash,
    CARD: t.returns.card,
    BANK_TRANSFER: t.returns.bankTransfer,
    CUSTOMER_CREDIT: t.returns.customerCredit,
    SUPPLIER_CREDIT: t.returns.supplierCredit,
    NO_IMMEDIATE_REFUND: t.returns.noImmediateRefund,
  };

  function submit() {
    setError(undefined);
    const chosen = rows.filter((r) => selected[r.id] && (quantities[r.id] || 0) > 0);
    startTransition(async () => {
      const result = kind === "sales"
        ? await createSalesReturn({ invoiceId: sourceId, reason, notes, refundMethod, refundAmount, items: chosen.map((row) => ({ invoiceItemId: row.id, quantity: quantities[row.id], condition: conditions[row.id] || "GOOD" })) })
        : await createPurchaseReturn({ purchaseId: sourceId, reason, notes, refundMethod, refundAmount, items: chosen.map((row) => ({ purchaseOrderItemId: row.id, quantity: quantities[row.id], reason })) });
      if (result.error) return setError(result.error);
      router.push(`/dashboard/${kind === "sales" ? "sales-returns" : "purchase-returns"}/${result.id}`);
    });
  }

  return <div className="space-y-6">
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm"><thead className="bg-muted/50"><tr>{["", t.returns.product, t.returns.skuBarcode, kind === "sales" ? t.returns.sold : t.returns.purchased, t.returns.returnedBefore, t.returns.available, t.returns.quantity, kind === "sales" ? t.returns.condition : t.returns.stock, t.returns.price, t.returns.total].map((h) => <th key={h} className="p-3 text-start font-medium">{h}</th>)}</tr></thead>
      <tbody>{rows.map((row) => { const available = row.original - row.returned; const qty = quantities[row.id] || 0; return <tr key={row.id} className="border-t">
        <td className="p-3"><Checkbox checked={Boolean(selected[row.id])} disabled={available <= 0} onCheckedChange={(v) => setSelected((s) => ({ ...s, [row.id]: Boolean(v) }))} /></td>
        <td className="p-3 font-medium">{row.productName}</td><td className="p-3 text-muted-foreground"><div>{row.sku}</div><div>{row.barcode || "—"}</div></td>
        <td className="p-3">{row.original}</td><td className="p-3">{row.returned}</td><td className="p-3 font-medium">{available}</td>
        <td className="p-3"><Input type="number" min={0.001} step="0.001" max={available} className="w-20" disabled={!selected[row.id]} value={qty || ""} onChange={(e) => setQuantities((q) => ({ ...q, [row.id]: Number(e.target.value) }))} /></td>
        <td className="p-3">{kind === "sales" ? <Select value={conditions[row.id] || "GOOD"} disabled={!selected[row.id]} onValueChange={(v) => v && setConditions((c) => ({ ...c, [row.id]: v as typeof c[string] }))}><SelectTrigger className="w-32"><SelectValue>{(value: string) => ({GOOD:t.returns.good,DAMAGED:t.returns.damaged,DEFECTIVE:t.returns.defective})[value]}</SelectValue></SelectTrigger><SelectContent><SelectItem value="GOOD">{t.returns.good}</SelectItem><SelectItem value="DAMAGED">{t.returns.damaged}</SelectItem><SelectItem value="DEFECTIVE">{t.returns.defective}</SelectItem></SelectContent></Select> : row.stock}</td>
        <td className="p-3">{formatCurrency(row.unitAmount, locale, false, 4)}</td><td className="p-3 font-medium">{qty > 0 ? formatCurrency(qty * row.unitAmount, locale) : "—"}</td>
      </tr>; })}</tbody></table>
    </div>
    <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
      <div className="space-y-2"><Label>{t.returns.reason} <span className="text-destructive">*</span></Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} required /></div>
      <div className="space-y-2"><Label>{t.returns.notes}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="space-y-2"><Label>{t.returns.refundMethod}</Label><Select value={refundMethod} onValueChange={(v) => v && setRefundMethod(v)}><SelectTrigger><SelectValue>{(value: string) => methodLabels[value]}</SelectValue></SelectTrigger><SelectContent>{(kind === "sales" ? ["CASH","CARD","BANK_TRANSFER","CUSTOMER_CREDIT","NO_IMMEDIATE_REFUND"] : ["CASH","BANK_TRANSFER","SUPPLIER_CREDIT","NO_IMMEDIATE_REFUND"]).map((value) => <SelectItem key={value} value={value}>{methodLabels[value]}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>{t.returns.refundAmount}</Label><Input type="number" min={0} max={total} step="0.01" value={refundAmount || ""} placeholder="0" onChange={(e) => setRefundAmount(Number(e.target.value))} /></div>
    </div>
    {error && <p className="text-sm text-destructive">{error}</p>}
    <div className="flex items-center justify-between">{total > 0 ? <p className="text-lg font-semibold">{t.returns.productsTotal}: {formatCurrency(total, locale)}</p> : <span />}<Button onClick={submit} disabled={pending || !reason.trim() || total <= 0 || refundAmount > total + 0.005}>{pending && <Loader2 className="size-4 animate-spin" />}{t.returns.confirm}</Button></div>
  </div>;
}
