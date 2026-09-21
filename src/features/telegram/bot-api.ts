import "server-only";

/**
 * Thin fetch wrapper for the Telegram Bot API — no SDK dependency, matching
 * this project's house style (raw `fetch` for every third-party integration,
 * see `src/features/purchases/deepseek.ts`).
 */

export type TelegramApiErrorCode = "config" | "api";

export class TelegramApiError extends Error {
  code: TelegramApiErrorCode;
  constructor(code: TelegramApiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** `sendMessage`/`editMessageText` always send `parse_mode: "HTML"` — any
 * text that isn't a hand-written literal we control (e.g. an AI-generated
 * chat reply) must be escaped first, or a stray `<`/`&` breaks Telegram's
 * parser and the whole send fails. */
export function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramApiError("config", "TELEGRAM_BOT_TOKEN is not set");
  return token;
}

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = botToken();
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new TelegramApiError(
      "api",
      error instanceof Error ? error.message : "request failed",
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { ok: boolean; result?: T; description?: string }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new TelegramApiError(
      "api",
      `Telegram ${method} failed: ${payload?.description ?? response.status}`,
    );
  }
  return payload.result as T;
}

export type InlineKeyboardButton =
  | { text: string; callback_data: string }
  | { text: string; web_app: { url: string } };

export type InlineKeyboard = { inline_keyboard: InlineKeyboardButton[][] };

export async function sendMessage(params: {
  chatId: number | string;
  text: string;
  replyMarkup?: InlineKeyboard;
}): Promise<{ message_id: number }> {
  return call("sendMessage", {
    chat_id: params.chatId,
    text: params.text,
    parse_mode: "HTML",
    reply_markup: params.replyMarkup,
  });
}

export async function editMessageText(params: {
  chatId: number | string;
  messageId: number;
  text: string;
  replyMarkup?: InlineKeyboard;
}): Promise<unknown> {
  return call("editMessageText", {
    chat_id: params.chatId,
    message_id: params.messageId,
    text: params.text,
    parse_mode: "HTML",
    reply_markup: params.replyMarkup,
  });
}

export async function answerCallbackQuery(params: {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}): Promise<unknown> {
  return call("answerCallbackQuery", {
    callback_query_id: params.callbackQueryId,
    text: params.text,
    show_alert: params.showAlert ?? false,
  });
}

type TelegramFile = { file_id: string; file_path?: string; file_size?: number };

/** Downloads a Telegram-hosted file (voice message, photo, …) — resolves the
 * file path via getFile, then fetches it from the file-storage host. Caller
 * enforces its own size cap before/while reading the body. */
export async function downloadTelegramFile(fileId: string): Promise<{
  buffer: Buffer;
  fileSize: number | null;
}> {
  const token = botToken();
  const file = await call<TelegramFile>("getFile", { file_id: fileId });
  if (!file.file_path) {
    throw new TelegramApiError("api", "Telegram file has no file_path");
  }
  const response = await fetch(
    `https://api.telegram.org/file/bot${token}/${file.file_path}`,
  );
  if (!response.ok) {
    throw new TelegramApiError("api", `file download failed: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, fileSize: file.file_size ?? null };
}
