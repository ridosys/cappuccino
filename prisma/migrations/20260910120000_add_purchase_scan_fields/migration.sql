-- AI purchase-invoice scanner (/dashboard/purchases/scan).
--
-- supplierInvoiceNumber / supplierInvoiceDate: the number and date printed
-- on the supplier's own invoice document, captured by the scanner and
-- editable in its review screen. Distinct from our generated "orderNumber".
--
-- scanIdempotencyKey: a one-shot token from the review screen so a
-- double-clicked / retried Confirm resolves to the same purchase order
-- instead of creating a second one (mirrors Invoice.posSaleToken).
--
-- Both new text columns are nullable and stay NULL for every hand-entered
-- purchase order.
ALTER TABLE "PurchaseOrder"
  ADD COLUMN "supplierInvoiceNumber" TEXT,
  ADD COLUMN "supplierInvoiceDate" TIMESTAMP(3),
  ADD COLUMN "scanIdempotencyKey" TEXT;

-- Hard duplicate-import guard: a supplier can't have two purchase orders
-- carrying the same (non-null) supplier invoice number. Postgres unique
-- indexes treat NULLs as distinct, so unlimited null-invoice-number orders
-- per supplier are still allowed.
CREATE UNIQUE INDEX "PurchaseOrder_supplierId_supplierInvoiceNumber_key"
  ON "PurchaseOrder"("supplierId", "supplierInvoiceNumber");

CREATE UNIQUE INDEX "PurchaseOrder_scanIdempotencyKey_key"
  ON "PurchaseOrder"("scanIdempotencyKey");
