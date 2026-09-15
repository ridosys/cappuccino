ALTER TABLE "InvoiceItem"
ADD COLUMN "position" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "InvoiceItem_invoiceId_position_idx"
ON "InvoiceItem"("invoiceId", "position");
