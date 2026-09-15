-- Adds file attachments (PDF, images, or other documents) on purchase
-- orders — e.g. a scanned supplier invoice or delivery note — uploaded to
-- Cloudinary the same way ProductImage is, but as a flat (unordered) list
-- with the original file's name/type/size and who uploaded it.
CREATE TABLE "PurchaseAttachment" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    -- Cloudinary resource type ("image" or "raw") the asset was uploaded
    -- under — PDFs must be uploaded as "raw", not "image", or Cloudinary
    -- blocks delivering them; needed again at delete time.
    "resourceType" TEXT NOT NULL DEFAULT 'image',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseAttachment_purchaseOrderId_idx" ON "PurchaseAttachment"("purchaseOrderId");

ALTER TABLE "PurchaseAttachment" ADD CONSTRAINT "PurchaseAttachment_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseAttachment" ADD CONSTRAINT "PurchaseAttachment_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
