import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions } from "@/lib/permissions";
import {
  sendMessage,
  answerCallbackQuery,
  downloadTelegramFile,
  escapeTelegramHtml,
  type InlineKeyboard,
} from "@/features/telegram/bot-api";
import { transcribeVoice, GroqError } from "@/features/telegram/groq";
import { extractInvoiceIntent } from "@/features/telegram/intent";
import { recordMessageAndMaybeSummarize } from "@/features/telegram/conversation-memory";
import { DeepSeekError } from "@/features/purchases/deepseek";
import { searchPosCustomers } from "@/features/pos/queries";
import { getSystemSettings } from "@/features/settings/queries";
import {
  createDraftFromIntent,
  applyIntentToActiveDraft,
  getActiveDraftForAccount,
  getDraftByToken,
  computeDraftTotals,
  confirmDraft,
  cancelDraft,
  pickCandidateForItem,
  setDraftCustomer,
  type DraftWithItems,
} from "@/features/telegram/draft";
import type { ExtractedIntent } from "@/features/telegram/schema";
import {
  getBotText,
  BOT_LANGUAGE_LABELS,
  BOT_LANGUAGES,
  type BotText,
} from "@/features/telegram/bot-text";
import type { InvoiceLanguage } from "@/generated/prisma/enums";

export const runtime = "nodejs";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Minimal typed subset of the Telegram Update payload — only the fields this
// bot actually reads.
// ---------------------------------------------------------------------------

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number };
    chat: { id: number };
    text?: string;
    voice?: { file_id: string; mime_type?: string; file_size?: number };
  };
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { chat: { id: number }; message_id: number };
    data?: string;
  };
};

type LinkedAccount = {
  id: string;
  adminId: string;
  language: InvoiceLanguage | null;
  conversationSummary: string | null;
};

function miniAppUrl(token: string): string | null {
  const base = process.env.APP_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/telegram-app/${token}`;
}

// ---------------------------------------------------------------------------
// /lang — every linked user picks their own bot/invoice language; button
// labels are language names in their own language, so they're legible
// regardless of which language the surrounding prompt is shown in.
// ---------------------------------------------------------------------------

function languagePickerKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      BOT_LANGUAGES.map((code) => ({
        text: BOT_LANGUAGE_LABELS[code],
        callback_data: `setlang:${code}`,
      })),
    ],
  };
}

async function sendLanguagePicker(
  chatId: number,
  lang: InvoiceLanguage | null,
) {
  await sendMessage({
    chatId,
    text: getBotText(lang).chooseLanguagePrompt,
    replyMarkup: languagePickerKeyboard(),
  });
}

function draftPreviewMessage(
  draft: NonNullable<DraftWithItems>,
  t: BotText,
): { text: string; replyMarkup: InlineKeyboard } {
  const totals = computeDraftTotals(draft);
  const lines = totals.lines.map((line) => {
    if (line.matchStatus === "NOT_FOUND") {
      return `${line.quantity} × ${line.label}  ${t.notFoundSuffix}`;
    }
    if (line.matchStatus === "AMBIGUOUS") {
      return `${line.quantity} × ${line.label}  ${t.ambiguousSuffix}`;
    }
    return `${line.quantity} × ${line.label}   ${line.lineTotal?.toFixed(2)} DH`;
  });

  const text = [
    t.draftHeader,
    "",
    ...lines,
    "",
    `${t.totalLabel}: ${totals.total.toFixed(2)} DH`,
    !draft.customerId ? `\n${t.needsCustomerNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const url = miniAppUrl(draft.token);
  const buttons: InlineKeyboard["inline_keyboard"] = [];
  if (url) {
    buttons.push([{ text: t.reviewEditButton, web_app: { url } }]);
  }
  buttons.push([
    { text: t.createInvoiceButton, callback_data: `confirm:${draft.token}` },
    { text: t.cancelButtonLabel, callback_data: `cancel:${draft.token}` },
  ]);

  return { text, replyMarkup: { inline_keyboard: buttons } };
}

async function sendAmbiguousPickers(
  chatId: number,
  draft: NonNullable<DraftWithItems>,
  t: BotText,
) {
  for (const item of draft.items) {
    if (
      item.matchStatus !== "AMBIGUOUS" ||
      item.candidateProductIds.length === 0
    )
      continue;
    const candidates = await prisma.product.findMany({
      where: { id: { in: item.candidateProductIds } },
      select: { id: true, name: true },
    });
    if (candidates.length === 0) continue;
    await sendMessage({
      chatId,
      text: `${t.ambiguousPickPromptPrefix} "${item.spokenName}"؟`,
      replyMarkup: {
        inline_keyboard: candidates.map((c) => [
          { text: c.name, callback_data: `pick:${item.id}:${c.id}` },
        ]),
      },
    });
  }
}

async function replyDraft(
  chatId: number,
  draft: NonNullable<DraftWithItems> | null,
  t: BotText,
) {
  if (!draft) {
    await sendMessage({ chatId, text: t.noActiveDraftMessage });
    return;
  }
  const { text, replyMarkup } = draftPreviewMessage(draft, t);
  await sendMessage({ chatId, text, replyMarkup });
  await sendAmbiguousPickers(chatId, draft, t);
}

async function handleStartCommand(
  chatId: number,
  telegramUserId: bigint,
  text: string,
) {
  const t = getBotText(null);
  const token = text.split(/\s+/)[1]?.trim();
  if (!token) {
    await sendMessage({ chatId, text: t.startNoToken });
    return;
  }

  const linkToken = await prisma.telegramLinkToken.findUnique({
    where: { token },
  });
  if (!linkToken || linkToken.consumedAt || linkToken.expiresAt < new Date()) {
    await sendMessage({ chatId, text: t.startTokenExpired });
    return;
  }

  try {
    await prisma.$transaction([
      prisma.telegramAccount.deleteMany({
        where: { adminId: linkToken.adminId },
      }),
      prisma.telegramAccount.create({
        data: { telegramUserId, adminId: linkToken.adminId },
      }),
      prisma.telegramLinkToken.update({
        where: { id: linkToken.id },
        data: { consumedAt: new Date() },
      }),
    ]);
  } catch {
    await sendMessage({ chatId, text: t.startAlreadyLinkedToOther });
    return;
  }

  await sendMessage({ chatId, text: t.startLinkedGreeting });
  await sendLanguagePicker(chatId, null);
}

// ---------------------------------------------------------------------------
// Voice/text intent handling for an already-linked, language-set account.
// ---------------------------------------------------------------------------

async function handleIntentMessage(
  chatId: number,
  adminId: string,
  telegramAccountId: string,
  intent: ExtractedIntent,
  rawTranscript: string,
  lang: InvoiceLanguage,
) {
  const t = getBotText(lang);

  if (intent.action === "CREATE_INVOICE") {
    const draft = await createDraftFromIntent(
      telegramAccountId,
      intent,
      rawTranscript,
    );
    await replyDraft(chatId, draft, t);
    return;
  }

  if (intent.action === "CONFIRM") {
    const active = await getActiveDraftForAccount(telegramAccountId);
    if (!active) {
      await sendMessage({ chatId, text: t.noActiveDraftToConfirm });
      return;
    }
    await confirmActiveDraft(chatId, active.id, adminId, lang);
    return;
  }

  if (intent.action === "CANCEL") {
    const active = await getActiveDraftForAccount(telegramAccountId);
    if (!active) {
      await sendMessage({ chatId, text: t.noActiveDraftToCancel });
      return;
    }
    await cancelDraft(active.id);
    await sendMessage({ chatId, text: t.draftCancelled });
    return;
  }

  if (intent.action === "SET_CUSTOMER") {
    await handleSetCustomer(
      chatId,
      telegramAccountId,
      intent.customerQuery,
      intent.customerQueryAlt,
      t,
    );
    return;
  }

  if (intent.action === "WHO_ARE_YOU") {
    const settings = await getSystemSettings();
    await sendMessage({
      chatId,
      text: t.identityReplyTemplate.replace("{appName}", settings.appName),
    });
    return;
  }

  if (intent.action === "CHAT") {
    // DeepSeek already wrote a reply in the account's chosen language (see
    // buildSystemPrompt in intent.ts) — HTML-escaped since sendMessage uses
    // parse_mode: "HTML" and this text is model-generated, not a literal we
    // control. Falls back to the generic help message if it's ever empty.
    await sendMessage({
      chatId,
      text: intent.reply
        ? escapeTelegramHtml(intent.reply)
        : t.unknownIntentHelp,
    });
    return;
  }

  if (intent.action === "UNKNOWN") {
    await sendMessage({ chatId, text: t.unknownIntentHelp });
    return;
  }

  // ADD_ITEM / REMOVE_ITEM / SET_QUANTITY / GET_TOTAL all act on the active draft.
  const result = await applyIntentToActiveDraft(telegramAccountId, intent);
  if (!result.ok) {
    await sendMessage({ chatId, text: t.noActiveDraftForEdit });
    return;
  }
  await replyDraft(chatId, result.draft, t);
}

/** Matches a spoken customer name against real Customer records (reusing
 * POS's own phone + fuzzy-name search) — never invents one. A single clear
 * match is applied directly; more than one shows pick-buttons, mirroring the
 * ambiguous-product picker UX. */
async function handleSetCustomer(
  chatId: number,
  telegramAccountId: string,
  customerQuery: string | null,
  customerQueryAlt: string | null,
  t: BotText,
) {
  const active = await getActiveDraftForAccount(telegramAccountId);
  if (!active) {
    await sendMessage({ chatId, text: t.noActiveDraftForEdit });
    return;
  }

  const query = customerQuery?.trim();
  const altQuery = customerQueryAlt?.trim();
  if (!query && !altQuery) {
    await sendMessage({ chatId, text: t.customerNotFound });
    return;
  }

  // Same cross-script problem as products — a customer stored as "Ahmed
  // Bennani" won't text-match "أحمد بناني" on its own, so try the
  // transliteration too when the primary spelling comes up empty.
  let items = query ? (await searchPosCustomers({ q: query, take: 5 })).items : [];
  if (items.length === 0 && altQuery) {
    items = (await searchPosCustomers({ q: altQuery, take: 5 })).items;
  }
  if (items.length === 0) {
    await sendMessage({ chatId, text: t.customerNotFound });
    return;
  }

  if (items.length === 1) {
    await setDraftCustomer(active.id, items[0].id);
    await sendMessage({
      chatId,
      text: `${t.customerSetPrefix} ${items[0].name}`,
    });
    const refreshed = await getDraftByToken(active.token);
    await replyDraft(chatId, refreshed, t);
    return;
  }

  await sendMessage({
    chatId,
    text: t.customerAmbiguousPrompt,
    replyMarkup: {
      inline_keyboard: items.map((c) => [
        { text: `${c.name} — ${c.phone}`, callback_data: `setcust:${c.id}` },
      ]),
    },
  });
}

async function confirmActiveDraft(
  chatId: number,
  draftId: string,
  adminId: string,
  lang: InvoiceLanguage,
) {
  const t = getBotText(lang);
  const result = await confirmDraft(draftId, adminId, lang);
  if (result.ok) {
    await sendMessage({
      chatId,
      text: `${t.invoiceCreatedPrefix} (${result.invoiceId})`,
    });
    return;
  }
  const messages: Record<typeof result.reason, string> = {
    not_pending: t.confirmNotPending,
    no_customer: t.confirmNoCustomer,
    unresolved_items: t.confirmUnresolvedItems,
    empty: t.confirmEmpty,
    invoice_error: result.message ?? t.confirmInvoiceErrorFallback,
  };
  await sendMessage({ chatId, text: messages[result.reason] });
}

// ---------------------------------------------------------------------------
// Update dispatch
// ---------------------------------------------------------------------------

async function resolveLinkedAccount(
  telegramUserId: bigint,
): Promise<LinkedAccount | null> {
  const account = await prisma.telegramAccount.findUnique({
    where: { telegramUserId },
  });
  if (!account || !account.isActive) return null;
  const effective = await getEffectivePermissions(account.adminId);
  if (effective !== "full" && !effective.has("POS_MANAGE")) return null;
  return {
    id: account.id,
    adminId: account.adminId,
    language: account.language,
    conversationSummary: account.conversationSummary,
  };
}

async function handleMessage(message: NonNullable<TelegramUpdate["message"]>) {
  const chatId = message.chat.id;
  const fromId = message.from?.id;
  if (!fromId) return;
  const telegramUserId = BigInt(fromId);

  if (message.text?.startsWith("/start")) {
    await handleStartCommand(chatId, telegramUserId, message.text);
    return;
  }

  const account = await resolveLinkedAccount(telegramUserId);
  if (!account) {
    await sendMessage({ chatId, text: getBotText(null).notLinkedOrForbidden });
    return;
  }

  if (message.text?.startsWith("/lang")) {
    await sendLanguagePicker(chatId, account.language);
    return;
  }

  // Every other interaction needs a language first — prompted right after
  // linking, but re-prompt defensively if it's somehow still unset.
  if (!account.language) {
    await sendLanguagePicker(chatId, null);
    return;
  }
  const lang = account.language;
  const t = getBotText(lang);

  let text: string | null = message.text ?? null;
  if (!text && message.voice) {
    try {
      if (
        message.voice.file_size &&
        message.voice.file_size > 15 * 1024 * 1024
      ) {
        await sendMessage({ chatId, text: t.voiceTooLarge });
        return;
      }
      const { buffer } = await downloadTelegramFile(message.voice.file_id);
      text = await transcribeVoice(
        buffer,
        "voice.ogg",
        message.voice.mime_type ?? "audio/ogg",
      );
      console.log("[telegram/webhook] voice transcribed:", text);
    } catch (error) {
      const code = error instanceof GroqError ? error.code : "api";
      console.error("[telegram/webhook] voice transcription failed", error);
      await sendMessage({
        chatId,
        text: code === "too_large" ? t.voiceTooLarge : t.voiceTranscribeFailed,
      });
      return;
    }
  }

  if (!text) return;

  let intent: ExtractedIntent;
  try {
    intent = await extractInvoiceIntent(text, lang, account.conversationSummary);
  } catch (error) {
    console.error("[telegram/webhook] intent extraction failed", error);
    const code = error instanceof DeepSeekError ? error.code : "api";
    await sendMessage({
      chatId,
      text: code === "config" ? t.serviceNotConfigured : t.understandFailed,
    });
    return;
  }

  // Best-effort — conversation memory is a nice-to-have and must never fail
  // the actual bot interaction. Awaited (not fire-and-forget) since a
  // serverless runtime can tear down the function right after the response
  // is sent, before an un-awaited promise gets to run.
  try {
    await recordMessageAndMaybeSummarize(account.id, text, lang);
  } catch (error) {
    console.error("[telegram/webhook] conversation memory update failed", error);
  }

  await handleIntentMessage(
    chatId,
    account.adminId,
    account.id,
    intent,
    text,
    lang,
  );
}

async function handleCallbackQuery(
  callback: NonNullable<TelegramUpdate["callback_query"]>,
) {
  const chatId = callback.message?.chat.id;
  const data = callback.data;
  if (!chatId || !data) {
    await answerCallbackQuery({ callbackQueryId: callback.id });
    return;
  }

  const account = await resolveLinkedAccount(BigInt(callback.from.id));
  if (!account) {
    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: getBotText(null).callbackUnauthorized,
      showAlert: true,
    });
    return;
  }

  const [action, ...rest] = data.split(":");

  if (action === "setlang") {
    const code = rest[0];
    if (!code || !BOT_LANGUAGES.includes(code as InvoiceLanguage)) {
      await answerCallbackQuery({ callbackQueryId: callback.id });
      return;
    }
    const newLang = code as InvoiceLanguage;
    await prisma.telegramAccount.update({
      where: { id: account.id },
      data: { language: newLang },
    });
    await answerCallbackQuery({ callbackQueryId: callback.id });
    await sendMessage({ chatId, text: getBotText(newLang).languageUpdated });
    return;
  }

  const t = getBotText(account.language);

  if (action === "confirm" || action === "cancel") {
    const token = rest.join(":");
    const draft = await getDraftByToken(token);
    if (!draft || draft.telegramAccountId !== account.id) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: t.callbackNotFound,
      });
      return;
    }
    await answerCallbackQuery({ callbackQueryId: callback.id });
    if (action === "confirm") {
      await confirmActiveDraft(
        chatId,
        draft.id,
        account.adminId,
        account.language ?? "AR",
      );
    } else {
      await cancelDraft(draft.id);
      await sendMessage({ chatId, text: t.draftCancelled });
    }
    return;
  }

  if (action === "pick") {
    const [itemId, productId] = rest;
    if (!itemId || !productId) {
      await answerCallbackQuery({ callbackQueryId: callback.id });
      return;
    }
    await pickCandidateForItem(itemId, productId);
    await answerCallbackQuery({ callbackQueryId: callback.id });
    const active = await getActiveDraftForAccount(account.id);
    await replyDraft(chatId, active, t);
    return;
  }

  if (action === "setcust") {
    const customerId = rest[0];
    if (!customerId) {
      await answerCallbackQuery({ callbackQueryId: callback.id });
      return;
    }
    const active = await getActiveDraftForAccount(account.id);
    const customer = active
      ? await prisma.customer.findUnique({
          where: { id: customerId },
          select: { id: true, name: true },
        })
      : null;
    if (!active || !customer) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: t.callbackNotFound,
      });
      return;
    }
    await setDraftCustomer(active.id, customer.id);
    await answerCallbackQuery({ callbackQueryId: callback.id });
    await sendMessage({
      chatId,
      text: `${t.customerSetPrefix} ${customer.name}`,
    });
    const refreshed = await getDraftByToken(active.token);
    await replyDraft(chatId, refreshed, t);
    return;
  }

  await answerCallbackQuery({ callbackQueryId: callback.id });
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const providedSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    if (update.message) await handleMessage(update.message);
    else if (update.callback_query)
      await handleCallbackQuery(update.callback_query);
  } catch (error) {
    // Telegram retries on non-2xx, and a caught bug shouldn't wedge the
    // webhook into a retry storm — log and still acknowledge receipt.
    console.error("[telegram/webhook] update handling failed", error);
  }

  return NextResponse.json({ ok: true });
}
