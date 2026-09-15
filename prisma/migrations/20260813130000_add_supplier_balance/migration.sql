CREATE TYPE "SupplierBalanceChangeReason" AS ENUM ('PURCHASE_RETURN_CREDIT', 'PURCHASE_PAYMENT', 'PAYMENT_DELETED', 'MANUAL_ADJUSTMENT');

ALTER TABLE "Supplier" ADD COLUMN "balance" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE "SupplierBalanceHistory" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "purchaseOrderId" TEXT,
  "reference" TEXT,
  "previousBalance" DECIMAL(10,2) NOT NULL,
  "change" DECIMAL(10,2) NOT NULL,
  "newBalance" DECIMAL(10,2) NOT NULL,
  "reason" "SupplierBalanceChangeReason" NOT NULL,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierBalanceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierBalanceHistory_supplierId_idx" ON "SupplierBalanceHistory"("supplierId");
CREATE INDEX "SupplierBalanceHistory_purchaseOrderId_idx" ON "SupplierBalanceHistory"("purchaseOrderId");
CREATE INDEX "SupplierBalanceHistory_createdAt_idx" ON "SupplierBalanceHistory"("createdAt");

ALTER TABLE "SupplierBalanceHistory" ADD CONSTRAINT "SupplierBalanceHistory_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
