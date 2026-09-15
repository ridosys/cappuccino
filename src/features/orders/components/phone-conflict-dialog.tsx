"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ConflictCustomer } from "@/features/orders/actions";
import type { CustomerInput } from "@/features/customers/schema";
import { useT } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

export function PhoneConflictDialog({
  existing,
  incoming,
  onUpdateExisting,
  onKeepExisting,
  onCreateNew,
  onCancel,
}: {
  existing: ConflictCustomer;
  incoming: CustomerInput;
  onUpdateExisting: () => void;
  onKeepExisting: () => void;
  onCreateNew: () => void;
  onCancel: () => void;
}) {
  const t = useT();

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.customers.phoneConflictTitle}</DialogTitle>
          <DialogDescription>
            {formatMessage(t.customers.phoneConflictDescription, {
              phone: existing.phone,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t.customers.existingCustomerLabel}
            </p>
            <p className="font-medium">{existing.name}</p>
            {existing.email && (
              <p className="text-xs text-muted-foreground" dir="ltr">
                {existing.email}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t.customers.enteredDataLabel}
            </p>
            <p className="font-medium">{incoming.name}</p>
            {incoming.email && (
              <p className="text-xs text-muted-foreground" dir="ltr">
                {incoming.email}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button className="cursor-pointer" onClick={onUpdateExisting}>
            {t.customers.updateExistingButton}
          </Button>
          <p className="text-xs text-muted-foreground">
            {formatMessage(t.customers.updateExistingHint, {
              name: existing.name,
            })}
          </p>

          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={onKeepExisting}
          >
            {t.customers.keepExistingButton}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t.customers.keepExistingHint}
          </p>

          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={onCreateNew}
          >
            {t.customers.createSeparateButton}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t.customers.createSeparateHint}
          </p>

          <Button variant="ghost" className="cursor-pointer" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
