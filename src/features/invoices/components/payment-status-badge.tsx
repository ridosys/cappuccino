"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/i18n/locale-provider";
import type { PaymentStatus } from "@/generated/prisma/client";

const VARIANT_BY_STATUS: Record<
  PaymentStatus,
  "default" | "secondary" | "destructive"
> = {
  PAID: "default",
  PARTIALLY_PAID: "secondary",
  UNPAID: "destructive",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const t = useT();
  return (
    <Badge variant={VARIANT_BY_STATUS[status]}>
      {t.statusLabels.paymentStatus[status]}
    </Badge>
  );
}
