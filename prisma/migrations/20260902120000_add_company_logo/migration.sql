-- Company logo customization. Stores only a reference to the uploaded
-- logo image on the SystemSettings singleton:
--   logoUrl       Cloudinary secure delivery URL (rendered by the app)
--   logoPublicId  Cloudinary public id (needed to replace / destroy it)
-- Both nullable — a null pair means no custom logo, and the app falls
-- back to the default brand mark. Additive only: no constraints, no
-- data backfill, no changes to existing columns or rows.
ALTER TABLE "SystemSettings" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "SystemSettings" ADD COLUMN "logoPublicId" TEXT;
