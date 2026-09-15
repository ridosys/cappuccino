-- Converts every stock-quantity column from INTEGER to DECIMAL(12,3), so
-- inventory can track fractional units (e.g. 1.5 kg, 2.75 m, 0.5 L).
-- "USING <col>::numeric" is an exact, lossless conversion for existing
-- integer data — every whole number already fits DECIMAL(12,3) precisely,
-- nothing here can lose or round existing values.

ALTER TABLE "Product" ALTER COLUMN "quantity" TYPE DECIMAL(12,3) USING "quantity"::numeric;
ALTER TABLE "Product" ALTER COLUMN "quantity" SET DEFAULT 0;
ALTER TABLE "Product" ALTER COLUMN "minStockLevel" TYPE DECIMAL(12,3) USING "minStockLevel"::numeric;
ALTER TABLE "Product" ALTER COLUMN "minStockLevel" SET DEFAULT 0;
ALTER TABLE "Product" ALTER COLUMN "damagedQuantity" TYPE DECIMAL(12,3) USING "damagedQuantity"::numeric;
ALTER TABLE "Product" ALTER COLUMN "damagedQuantity" SET DEFAULT 0;
ALTER TABLE "Product" ALTER COLUMN "defectiveQuantity" TYPE DECIMAL(12,3) USING "defectiveQuantity"::numeric;
ALTER TABLE "Product" ALTER COLUMN "defectiveQuantity" SET DEFAULT 0;

ALTER TABLE "OrderItem" ALTER COLUMN "quantity" TYPE DECIMAL(12,3) USING "quantity"::numeric;

ALTER TABLE "InventoryMovement" ALTER COLUMN "quantity" TYPE DECIMAL(12,3) USING "quantity"::numeric;

ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "quantity" TYPE DECIMAL(12,3) USING "quantity"::numeric;

ALTER TABLE "InvoiceItem" ALTER COLUMN "quantity" TYPE DECIMAL(12,3) USING "quantity"::numeric;

ALTER TABLE "SalesReturnItem" ALTER COLUMN "quantity" TYPE DECIMAL(12,3) USING "quantity"::numeric;

ALTER TABLE "PurchaseReturnItem" ALTER COLUMN "quantity" TYPE DECIMAL(12,3) USING "quantity"::numeric;
