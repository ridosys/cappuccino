-- Records every actual change to Product.purchasePrice (from a direct
-- product edit or a purchase order's "update product price" checkbox), so
-- historical inventory valuation can look up the price that was actually
-- in effect as of a given date instead of assuming today's price always
-- applied. Nullable createdById, same convention as InventoryMovement and
-- the other *_createdById columns: existing history has no recorded
-- creator to backfill, new rows get it from the acting admin.

CREATE TABLE "ProductPriceHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchasePrice" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "reference" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductPriceHistory_productId_idx" ON "ProductPriceHistory"("productId");

CREATE INDEX "ProductPriceHistory_createdById_idx" ON "ProductPriceHistory"("createdById");

ALTER TABLE "ProductPriceHistory" ADD CONSTRAINT "ProductPriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductPriceHistory" ADD CONSTRAINT "ProductPriceHistory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
