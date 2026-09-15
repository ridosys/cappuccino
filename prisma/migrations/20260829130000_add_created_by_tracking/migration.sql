-- Adds "who created this" tracking to every major record type that didn't
-- already have it (SalesReturn/PurchaseReturn already tracked this).
-- Nullable everywhere: existing rows genuinely have no recorded creator
-- (that information was never captured before now), so they stay NULL
-- rather than being backfilled to a guessed value. New rows going forward
-- get it populated by the admin performing the create action.
--
-- ON DELETE SET NULL (not RESTRICT like the returns relations) — this is
-- plain attribution, not the accountability trail returns need, so
-- deleting an admin must never be blocked just because they once created
-- a product/invoice/etc.

ALTER TABLE "Invoice" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Order" ADD COLUMN "createdById" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Customer" ADD COLUMN "createdById" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Product" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Brand" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Category" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Expense" ADD COLUMN "createdById" TEXT;

CREATE INDEX "Invoice_createdById_idx" ON "Invoice"("createdById");
CREATE INDEX "Order_createdById_idx" ON "Order"("createdById");
CREATE INDEX "PurchaseOrder_createdById_idx" ON "PurchaseOrder"("createdById");
CREATE INDEX "Supplier_createdById_idx" ON "Supplier"("createdById");
CREATE INDEX "Customer_createdById_idx" ON "Customer"("createdById");
CREATE INDEX "InventoryMovement_createdById_idx" ON "InventoryMovement"("createdById");
CREATE INDEX "Product_createdById_idx" ON "Product"("createdById");
CREATE INDEX "Brand_createdById_idx" ON "Brand"("createdById");
CREATE INDEX "Category_createdById_idx" ON "Category"("createdById");
CREATE INDEX "Expense_createdById_idx" ON "Expense"("createdById");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
