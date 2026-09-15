-- Purchase order lines get an explicit sort order the admin can reorder in
-- the form (drag & drop), same as invoice lines. Existing rows are numbered
-- by their id (cuids are roughly creation-ordered) per order so their
-- current arrangement is preserved.
ALTER TABLE "PurchaseOrderItem"
ADD COLUMN "position" INTEGER NOT NULL DEFAULT 1;

WITH ordered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "purchaseOrderId" ORDER BY "id") AS rn
  FROM "PurchaseOrderItem"
)
UPDATE "PurchaseOrderItem" p
SET "position" = ordered.rn
FROM ordered
WHERE ordered."id" = p."id";

CREATE INDEX "PurchaseOrderItem_purchaseOrderId_position_idx"
ON "PurchaseOrderItem"("purchaseOrderId", "position");
