-- A purchase order line's unit cost (تكلفة الوحدة) now allows up to 4
-- decimal places, e.g. 3.3333, instead of 2 — matching Product.purchasePrice.
-- Widening precision/scale is lossless: every existing 2-decimal value fits
-- unchanged. The purchase-return line carries the same cost, so widen it too.
ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "unitCost" TYPE DECIMAL(12, 4);
ALTER TABLE "PurchaseReturnItem" ALTER COLUMN "unitCost" TYPE DECIMAL(12, 4);
