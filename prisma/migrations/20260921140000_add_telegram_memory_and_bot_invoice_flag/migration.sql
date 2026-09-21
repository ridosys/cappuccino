-- Invoice.createdByBot: true only for invoices confirmDraft() (Telegram AI
-- Voice Invoice) created from a chat draft. Every other invoice creation
-- path leaves this at its default.
ALTER TABLE "Invoice" ADD COLUMN "createdByBot" BOOLEAN NOT NULL DEFAULT false;

-- Rolling conversation memory for the Telegram bot — a short running
-- summary refreshed every 5 user messages, so the AI keeps light continuity
-- across a long chat without resending full history on every call.
ALTER TABLE "TelegramAccount" ADD COLUMN "conversationSummary" TEXT;
ALTER TABLE "TelegramAccount" ADD COLUMN "messagesSinceSummary" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "TelegramChatMessage" (
    "id" TEXT NOT NULL,
    "telegramAccountId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelegramChatMessage_telegramAccountId_createdAt_idx" ON "TelegramChatMessage"("telegramAccountId", "createdAt");

ALTER TABLE "TelegramChatMessage"
  ADD CONSTRAINT "TelegramChatMessage_telegramAccountId_fkey"
  FOREIGN KEY ("telegramAccountId") REFERENCES "TelegramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
