"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPurchaseOrderStockIssue,
  updatePurchaseOrderStatus,
} from "@/features/purchases/actions";
import { StockAlertDialog, type StockIssue } from "@/components/shared/stock-alert-dialog";
import { useLocale } from "@/i18n/locale-provider";
import type { PurchaseOrderStatus } from "@/generated/prisma/client";

const PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  "PENDING",
  "RECEIVED",
  "CANCELLED",
];

export function PurchaseOrderStatusSelect({
  purchaseOrderId,
  status,
}: {
  purchaseOrderId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [stockIssue, setStockIssue] = useState<StockIssue | null>(null);
  const [pendingStatus, setPendingStatus] = useState<PurchaseOrderStatus | null>(null);
  const { t } = useLocale();

  function applyStatus(value: PurchaseOrderStatus, allowNegativeStock = false) {
    startTransition(async () => {
      const result = await updatePurchaseOrderStatus(purchaseOrderId, value, {
        allowNegativeStock,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.purchases.statusUpdatedToast);
    });
  }

  function handleChange(value: string | null) {
    if (!value) return;
    const nextStatus = value as PurchaseOrderStatus;
    startTransition(async () => {
      if (status === "RECEIVED" && nextStatus !== "RECEIVED") {
        const issue = await getPurchaseOrderStockIssue(purchaseOrderId);
        if (issue) {
          setPendingStatus(nextStatus);
          setStockIssue(issue);
          return;
        }
      }
      applyStatus(nextStatus);
    });
  }

  return (
    <>
      <StockAlertDialog
        issue={stockIssue}
        onClose={() => {
          setStockIssue(null);
          setPendingStatus(null);
        }}
        onConfirm={() => {
          setStockIssue(null);
          if (pendingStatus) applyStatus(pendingStatus, true);
          setPendingStatus(null);
        }}
      />
      <Select value={status} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue>
            {(value: string) =>
              t.statusLabels.purchaseOrder[
                value as keyof typeof t.statusLabels.purchaseOrder
              ] ?? value
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PURCHASE_ORDER_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {t.statusLabels.purchaseOrder[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
