-- Lets an admin attach a photo to a customer, shown wherever the customer
-- is picked/displayed (dashboard, La Caisse). Nullable — most customers
-- won't have one, falling back to a colored initial in the UI.
ALTER TABLE "Customer" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Customer" ADD COLUMN "imagePublicId" TEXT;
