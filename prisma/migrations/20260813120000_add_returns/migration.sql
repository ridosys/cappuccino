ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'SALE_RETURN';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'PURCHASE_RETURN';

CREATE TYPE "ReturnStatus" AS ENUM ('CONFIRMED', 'CANCELLED');
CREATE TYPE "ReturnedItemCondition" AS ENUM ('GOOD', 'DAMAGED', 'DEFECTIVE');
CREATE TYPE "RefundMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOMER_CREDIT', 'NO_IMMEDIATE_REFUND');
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'COMPLETED', 'CREDITED', 'NOT_REQUIRED');
CREATE TYPE "PurchaseRefundMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'SUPPLIER_CREDIT', 'NO_IMMEDIATE_REFUND');

ALTER TABLE "Product" ADD COLUMN "damagedQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "defectiveQuantity" INTEGER NOT NULL DEFAULT 0;

CREATE SEQUENCE "sales_return_number_seq" START 1;
CREATE SEQUENCE "purchase_return_number_seq" START 1;

CREATE TABLE "SalesReturn" (
  "id" TEXT NOT NULL, "returnNumber" TEXT NOT NULL, "invoiceId" TEXT NOT NULL,
  "customerId" TEXT, "status" "ReturnStatus" NOT NULL DEFAULT 'CONFIRMED',
  "reason" TEXT NOT NULL, "notes" TEXT, "subtotal" DECIMAL(10,2) NOT NULL,
  "refundAmount" DECIMAL(10,2) NOT NULL, "refundMethod" "RefundMethod" NOT NULL,
  "refundStatus" "RefundStatus" NOT NULL, "refundDate" TIMESTAMP(3),
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesReturn_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SalesReturnItem" (
  "id" TEXT NOT NULL, "salesReturnId" TEXT NOT NULL, "invoiceItemId" TEXT NOT NULL,
  "productId" TEXT, "quantity" INTEGER NOT NULL, "unitPrice" DECIMAL(10,2) NOT NULL,
  "total" DECIMAL(10,2) NOT NULL, "condition" "ReturnedItemCondition" NOT NULL,
  "restock" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "SalesReturnItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PurchaseReturn" (
  "id" TEXT NOT NULL, "returnNumber" TEXT NOT NULL, "purchaseId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL, "status" "ReturnStatus" NOT NULL DEFAULT 'CONFIRMED',
  "reason" TEXT NOT NULL, "notes" TEXT, "total" DECIMAL(10,2) NOT NULL,
  "refundAmount" DECIMAL(10,2) NOT NULL, "refundMethod" "PurchaseRefundMethod" NOT NULL,
  "refundStatus" "RefundStatus" NOT NULL, "refundDate" TIMESTAMP(3),
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PurchaseReturnItem" (
  "id" TEXT NOT NULL, "purchaseReturnId" TEXT NOT NULL, "purchaseOrderItemId" TEXT NOT NULL,
  "productId" TEXT NOT NULL, "quantity" INTEGER NOT NULL, "unitCost" DECIMAL(10,2) NOT NULL,
  "total" DECIMAL(10,2) NOT NULL, "reason" TEXT,
  CONSTRAINT "PurchaseReturnItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesReturn_returnNumber_key" ON "SalesReturn"("returnNumber");
CREATE INDEX "SalesReturn_invoiceId_idx" ON "SalesReturn"("invoiceId");
CREATE INDEX "SalesReturn_customerId_idx" ON "SalesReturn"("customerId");
CREATE INDEX "SalesReturn_createdById_idx" ON "SalesReturn"("createdById");
CREATE INDEX "SalesReturn_createdAt_idx" ON "SalesReturn"("createdAt");
CREATE INDEX "SalesReturnItem_salesReturnId_idx" ON "SalesReturnItem"("salesReturnId");
CREATE INDEX "SalesReturnItem_invoiceItemId_idx" ON "SalesReturnItem"("invoiceItemId");
CREATE INDEX "SalesReturnItem_productId_idx" ON "SalesReturnItem"("productId");
CREATE UNIQUE INDEX "PurchaseReturn_returnNumber_key" ON "PurchaseReturn"("returnNumber");
CREATE INDEX "PurchaseReturn_purchaseId_idx" ON "PurchaseReturn"("purchaseId");
CREATE INDEX "PurchaseReturn_supplierId_idx" ON "PurchaseReturn"("supplierId");
CREATE INDEX "PurchaseReturn_createdById_idx" ON "PurchaseReturn"("createdById");
CREATE INDEX "PurchaseReturn_createdAt_idx" ON "PurchaseReturn"("createdAt");
CREATE INDEX "PurchaseReturnItem_purchaseReturnId_idx" ON "PurchaseReturnItem"("purchaseReturnId");
CREATE INDEX "PurchaseReturnItem_purchaseOrderItemId_idx" ON "PurchaseReturnItem"("purchaseOrderItemId");
CREATE INDEX "PurchaseReturnItem_productId_idx" ON "PurchaseReturnItem"("productId");

ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesReturnItem" ADD CONSTRAINT "SalesReturnItem_salesReturnId_fkey" FOREIGN KEY ("salesReturnId") REFERENCES "SalesReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesReturnItem" ADD CONSTRAINT "SalesReturnItem_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesReturnItem" ADD CONSTRAINT "SalesReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
