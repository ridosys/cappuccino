"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";
import type { BalanceConfirmRequest } from "@/features/invoices/balance-resolution";

export function BalanceConfirmDialog({
  request,
  onCancel,
  onUseAvailable,
  onGoNegative,
  onUseBalance,
  onDecline,
  onAddExcessToBalance,
  onDiscardExcess,
}: {
  request: BalanceConfirmRequest | null;
  onCancel: () => void;
  onUseAvailable: () => void;
  onGoNegative: () => void;
  onUseBalance: () => void;
  onDecline: () => void;
  /** Only needed by callers that can produce an "excess-payment" request. */
  onAddExcessToBalance?: () => void;
  onDiscardExcess?: () => void;
}) {
  const { t, locale } = useLocale();

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        {request?.kind === "insufficient" && (
          <>
            <DialogHeader>
              <DialogTitle>{t.invoices.insufficientBalanceTitle}</DialogTitle>
              <DialogDescription>
                {formatMessage(t.invoices.insufficientBalanceDescription, {
                  available: formatCurrency(request.availableBalance, locale),
                  needed: formatCurrency(request.amountNeeded, locale),
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Button className="cursor-pointer" onClick={onUseAvailable}>
                {t.invoices.insufficientBalanceUseAvailable}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t.invoices.insufficientBalanceUseAvailableHint}
              </p>
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={onGoNegative}
              >
                {t.invoices.insufficientBalanceGoNegative}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t.invoices.insufficientBalanceGoNegativeHint}
              </p>
            </div>
          </>
        )}
        {request?.kind === "offer-balance" && (
          <>
            <DialogHeader>
              <DialogTitle>{t.invoices.offerBalanceTitle}</DialogTitle>
              <DialogDescription>
                {formatMessage(t.invoices.offerBalanceDescription, {
                  available: formatCurrency(request.availableBalance, locale),
                  remaining: formatCurrency(request.remaining, locale),
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Button className="flex-1 cursor-pointer" onClick={onUseBalance}>
                {t.invoices.offerBalanceYes}
              </Button>
              <Button
                variant="outline"
                className="flex-1 cursor-pointer"
                onClick={onDecline}
              >
                {t.invoices.offerBalanceNo}
              </Button>
            </div>
          </>
        )}
        {request?.kind === "excess-payment" && (
          <>
            <DialogHeader>
              <DialogTitle>{t.invoices.excessPaymentTitle}</DialogTitle>
              <DialogDescription>
                {formatMessage(t.invoices.excessPaymentDescription, {
                  excess: formatCurrency(request.excessAmount, locale),
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Button
                className="flex-1 cursor-pointer"
                onClick={onAddExcessToBalance}
              >
                {t.invoices.excessPaymentAddToBalance}
              </Button>
              <Button
                variant="outline"
                className="flex-1 cursor-pointer"
                onClick={onDiscardExcess}
              >
                {t.invoices.excessPaymentDiscard}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
