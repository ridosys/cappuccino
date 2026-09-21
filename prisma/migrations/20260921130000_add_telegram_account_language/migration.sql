-- Per-Telegram-user bot/invoice language, chosen via the /lang command and
-- prompted right after linking. Null until chosen — every bot chat message
-- and the invoice's own print language on confirm follow this once set.
ALTER TABLE "TelegramAccount" ADD COLUMN "language" "InvoiceLanguage";
