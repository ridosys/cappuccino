-- POS idempotency key. A client-generated token stamped on invoices
-- created through La Caisse so a double-submitted / retried sale resolves
-- to the same invoice instead of creating a second one (and double-
-- deducting stock). Nullable + UNIQUE: null on every non-POS invoice,
-- and multiple NULLs are allowed by Postgres unique indexes.
ALTER TABLE "Invoice" ADD COLUMN "posSaleToken" TEXT;
CREATE UNIQUE INDEX "Invoice_posSaleToken_key" ON "Invoice"("posSaleToken");
