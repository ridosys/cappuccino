-- Product selling prices and purchase price (cost) now allow up to 4
-- decimal places, e.g. 3.3333, instead of 2. Widening precision/scale is
-- a lossless change: every existing 2-decimal value fits unchanged.
ALTER TABLE "Product" ALTER COLUMN "price1" TYPE DECIMAL(12, 4);
ALTER TABLE "Product" ALTER COLUMN "price2" TYPE DECIMAL(12, 4);
ALTER TABLE "Product" ALTER COLUMN "price3" TYPE DECIMAL(12, 4);
ALTER TABLE "Product" ALTER COLUMN "purchasePrice" TYPE DECIMAL(12, 4);

-- Mirror the change on the price-history ledger that records a product's
-- purchase price over time.
ALTER TABLE "ProductPriceHistory" ALTER COLUMN "purchasePrice" TYPE DECIMAL(12, 4);
