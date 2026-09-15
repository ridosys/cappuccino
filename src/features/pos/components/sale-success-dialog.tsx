"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Printer, Plus, Trash2, Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { updatePosSaleLanguage } from "@/features/pos/actions";
import { deletePosSale } from "@/features/invoices/actions";
import type { SaleResult } from "./types";

const LANGS: SaleResult["language"][] = ["AR", "FR", "EN"];
const LANG_LABEL: Record<SaleResult["language"], string> = {
  AR: "العربية",
  FR: "Français",
  EN: "English",
};

export function SaleSuccessDialog({
  sale,
  onNewSale,
  onEdit,
}: {
  sale: SaleResult | null;
  onNewSale: () => void;
  /** Reverse the just-created invoice and drop back into the cart with the
   * same customer + lines still loaded, so the cashier can change anything
   * and pay again as a fresh sale. */
  onEdit: () => void;
}) {
  const { locale, t } = useLocale();
  const [lang, setLang] = useState<SaleResult["language"]>(sale?.language ?? "AR");
  const [, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const [isReopening, startReopen] = useTransition();
  const busy = isDeleting || isReopening;

  if (!sale) return null;

  const printHref = `/caisse/invoices/${sale.invoiceId}/print?lang=${lang.toLowerCase()}`;

  function pickLang(next: SaleResult["language"]) {
    setLang(next);
    startTransition(() => {
      updatePosSaleLanguage(sale!.invoiceId, next);
    });
  }

  function cancelSale() {
    startDelete(async () => {
      const result = await deletePosSale(sale!.invoiceId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.pos.saleCancelledToast);
      setConfirmCancel(false);
      onNewSale();
    });
  }

  function editSale() {
    startReopen(async () => {
      const result = await deletePosSale(sale!.invoiceId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.pos.saleReopenedToast);
      onEdit();
    });
  }

  return (
    <>
    <Dialog open onOpenChange={(open) => !open && !busy && onNewSale()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="size-5" />
            {t.pos.saleCompletedTitle}
          </DialogTitle>
        </DialogHeader>

        <dl className="space-y-1.5 rounded-lg border p-3 text-sm">
          <Row label={t.pos.invoiceNumberLabel}>
            <span dir="ltr">{sale.invoiceNumber}</span>
          </Row>
          <Row label={t.pos.customerLabel}>{sale.customerName}</Row>
          <Row label={t.pos.totalLabel}>
            {formatCurrency(sale.total, locale)}
          </Row>
          <Row label={t.pos.paidLabel}>{formatCurrency(sale.paid, locale)}</Row>
          {sale.method === "CASH" && sale.change > 0 && (
            <Row label={t.pos.changeLabel}>
              {formatCurrency(sale.change, locale)}
            </Row>
          )}
          {sale.credited > 0 && (
            <Row label={t.pos.creditedToBalanceLabel}>
              {formatCurrency(sale.credited, locale)}
            </Row>
          )}
        </dl>

        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">
            {t.pos.invoiceLanguageLabel}
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {LANGS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => pickLang(option)}
                className={cn(
                  "rounded-lg border py-1.5 text-xs font-medium transition-colors",
                  lang === option
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted",
                )}
              >
                {LANG_LABEL[option]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => window.open(printHref, "_blank")}
          >
            <Printer className="size-4" />
            {t.pos.printInvoice}
          </Button>
          <Button type="button" disabled={busy} onClick={onNewSale}>
            <Plus className="size-4" />
            {t.pos.newSale}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={editSale}
          >
            {isReopening ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Pencil className="size-4" />
            )}
            {t.pos.editSale}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmCancel(true)}
          >
            <Trash2 className="size-4" />
            {t.pos.cancelSale}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

      <AlertDialog
        open={confirmCancel}
        onOpenChange={(open) => !open && !busy && setConfirmCancel(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.pos.cancelSale}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.pos.cancelSaleConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={cancelSale}
            >
              {isDeleting && <Loader2 className="size-4 animate-spin" />}
              {t.pos.confirmCancelSale}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
