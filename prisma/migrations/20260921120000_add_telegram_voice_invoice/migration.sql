-- Telegram AI Voice Invoice.
--
-- TelegramAccount: links a Telegram user 1:1 to an existing Admin. Created
-- only by consuming a TelegramLinkToken from that Admin's own dashboard
-- session — a Telegram username/first name is never treated as identity.
--
-- TelegramInvoiceDraft / TelegramInvoiceDraftItem: the temporary, editable
-- record built from a voice/text message before any invoice exists.
-- TelegramInvoiceDraft.token doubles as the Invoice.posSaleToken passed into
-- the existing createInvoice() on confirm, reusing that idempotency
-- mechanism instead of adding a parallel one.

CREATE TYPE "TelegramDraftStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "TelegramMatchStatus" AS ENUM ('EXACT', 'STRONG', 'AMBIGUOUS', 'NOT_FOUND');

CREATE TABLE "TelegramAccount" (
    "id" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "adminId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramAccount_telegramUserId_key" ON "TelegramAccount"("telegramUserId");
CREATE UNIQUE INDEX "TelegramAccount_adminId_key" ON "TelegramAccount"("adminId");

ALTER TABLE "TelegramAccount"
  ADD CONSTRAINT "TelegramAccount_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TelegramLinkToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLinkToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramLinkToken_token_key" ON "TelegramLinkToken"("token");
CREATE INDEX "TelegramLinkToken_adminId_idx" ON "TelegramLinkToken"("adminId");

ALTER TABLE "TelegramLinkToken"
  ADD CONSTRAINT "TelegramLinkToken_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TelegramInvoiceDraft" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "telegramAccountId" TEXT NOT NULL,
    "status" "TelegramDraftStatus" NOT NULL DEFAULT 'PENDING',
    "rawTranscript" TEXT,
    "customerId" TEXT,
    "invoiceId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramInvoiceDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramInvoiceDraft_token_key" ON "TelegramInvoiceDraft"("token");
CREATE UNIQUE INDEX "TelegramInvoiceDraft_invoiceId_key" ON "TelegramInvoiceDraft"("invoiceId");
CREATE INDEX "TelegramInvoiceDraft_telegramAccountId_status_idx" ON "TelegramInvoiceDraft"("telegramAccountId", "status");

ALTER TABLE "TelegramInvoiceDraft"
  ADD CONSTRAINT "TelegramInvoiceDraft_telegramAccountId_fkey"
  FOREIGN KEY ("telegramAccountId") REFERENCES "TelegramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramInvoiceDraft"
  ADD CONSTRAINT "TelegramInvoiceDraft_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelegramInvoiceDraft"
  ADD CONSTRAINT "TelegramInvoiceDraft_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TelegramInvoiceDraftItem" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "spokenName" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "matchStatus" "TelegramMatchStatus" NOT NULL,
    "matchedProductId" TEXT,
    "candidateProductIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TelegramInvoiceDraftItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelegramInvoiceDraftItem_draftId_idx" ON "TelegramInvoiceDraftItem"("draftId");
CREATE INDEX "TelegramInvoiceDraftItem_matchedProductId_idx" ON "TelegramInvoiceDraftItem"("matchedProductId");

ALTER TABLE "TelegramInvoiceDraftItem"
  ADD CONSTRAINT "TelegramInvoiceDraftItem_draftId_fkey"
  FOREIGN KEY ("draftId") REFERENCES "TelegramInvoiceDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramInvoiceDraftItem"
  ADD CONSTRAINT "TelegramInvoiceDraftItem_matchedProductId_fkey"
  FOREIGN KEY ("matchedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
