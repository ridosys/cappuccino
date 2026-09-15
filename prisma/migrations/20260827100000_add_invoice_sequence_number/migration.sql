-- Simple 1, 2, 3, ... counter for invoices, shown to admins (formatted as
-- 001, 002, ...) — separate from "invoiceNumber", which stays whatever it
-- already is and is what appears on the printed document.

CREATE SEQUENCE "Invoice_sequenceNumber_seq";

ALTER TABLE "Invoice" ADD COLUMN "sequenceNumber" INTEGER;

-- Backfill existing rows in chronological order (createdAt), not physical
-- row order, so invoice #1 really is the oldest one.
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS "rn"
  FROM "Invoice"
)
UPDATE "Invoice" AS i
SET "sequenceNumber" = ordered."rn"
FROM ordered
WHERE i."id" = ordered."id";

-- Advance the sequence past whatever was just backfilled, then wire it up
-- as this column's default for every future insert.
SELECT setval('"Invoice_sequenceNumber_seq"', COALESCE((SELECT MAX("sequenceNumber") FROM "Invoice"), 0));
ALTER TABLE "Invoice" ALTER COLUMN "sequenceNumber" SET DEFAULT nextval('"Invoice_sequenceNumber_seq"');
ALTER SEQUENCE "Invoice_sequenceNumber_seq" OWNED BY "Invoice"."sequenceNumber";

ALTER TABLE "Invoice" ALTER COLUMN "sequenceNumber" SET NOT NULL;
CREATE UNIQUE INDEX "Invoice_sequenceNumber_key" ON "Invoice"("sequenceNumber");
