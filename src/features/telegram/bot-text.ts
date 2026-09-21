import type { InvoiceLanguage } from "@/generated/prisma/enums";

export type BotText = {
  chooseLanguagePrompt: string;
  languageUpdated: string;
  startNoToken: string;
  startTokenExpired: string;
  startAlreadyLinkedToOther: string;
  startLinkedGreeting: string;
  notLinkedOrForbidden: string;
  voiceTooLarge: string;
  voiceTranscribeFailed: string;
  serviceNotConfigured: string;
  understandFailed: string;
  unknownIntentHelp: string;
  noActiveDraftToConfirm: string;
  noActiveDraftToCancel: string;
  draftCancelled: string;
  noActiveDraftForEdit: string;
  noActiveDraftMessage: string;
  draftHeader: string;
  totalLabel: string;
  needsCustomerNote: string;
  notFoundSuffix: string;
  ambiguousSuffix: string;
  reviewEditButton: string;
  createInvoiceButton: string;
  cancelButtonLabel: string;
  ambiguousPickPromptPrefix: string;
  invoiceCreatedPrefix: string;
  confirmNotPending: string;
  confirmNoCustomer: string;
  confirmUnresolvedItems: string;
  confirmEmpty: string;
  confirmInvoiceErrorFallback: string;
  callbackUnauthorized: string;
  callbackNotFound: string;
  customerSetPrefix: string;
  customerNotFound: string;
  customerAmbiguousPrompt: string;
  /** Contains a literal "{appName}" placeholder — the caller substitutes
   * the business's real name (from SystemSettings/companyConfig). */
  identityReplyTemplate: string;
};

const AR: BotText = {
  chooseLanguagePrompt:
    "اختر لغتك / Choose your language / Choisissez votre langue",
  languageUpdated: "تم تحديث اللغة إلى العربية ✅",
  startNoToken:
    "افتح رابط الربط من إعدادات حسابك في لوحة التحكم للاتصال بهذا البوت.",
  startTokenExpired: "انتهت صلاحية رابط الربط. أنشئ رابطاً جديداً.",
  startAlreadyLinkedToOther: "حساب Telegram هذا مرتبط بالفعل بمستخدم آخر.",
  startLinkedGreeting: "تم ربط حسابك بنجاح ✅ اختر لغتك للمتابعة:",
  notLinkedOrForbidden:
    "هذا الحساب غير مرتبط أو لا يملك صلاحية استخدام هذا البوت. اربط حسابك من إعدادات لوحة التحكم.",
  voiceTooLarge: "الرسالة الصوتية كبيرة جداً.",
  voiceTranscribeFailed: "تعذّر تحويل الرسالة الصوتية إلى نص. حاول مرة أخرى.",
  serviceNotConfigured: "الخدمة غير مُهيَّأة بعد. تواصل مع مدير النظام.",
  understandFailed: "تعذّر فهم الطلب. حاول صياغته بشكل مختلف.",
  unknownIntentHelp:
    'لم أفهم الطلب. جرّب مثلاً: "دير ليا جوج كابتشينو وثلاثة كوكا".',
  noActiveDraftToConfirm: "لا توجد مسودة فاتورة نشطة لتأكيدها.",
  noActiveDraftToCancel: "لا توجد مسودة فاتورة نشطة لإلغائها.",
  draftCancelled: "تم إلغاء المسودة.",
  noActiveDraftForEdit:
    'لا توجد مسودة فاتورة نشطة. ابدأ بطلب جديد أولاً، مثلاً: "دير ليا كابتشينو".',
  noActiveDraftMessage: "لا توجد مسودة فاتورة نشطة حالياً.",
  draftHeader: "🧾 مسودة فاتورة",
  totalLabel: "الإجمالي",
  needsCustomerNote: "⚠️ اختر عميلاً من شاشة المراجعة قبل التأكيد.",
  notFoundSuffix: "⚠️ غير موجود في النظام",
  ambiguousSuffix: "⚠️ يحتاج اختيار المنتج",
  reviewEditButton: "✏️ مراجعة وتعديل",
  createInvoiceButton: "✅ إنشاء الفاتورة",
  cancelButtonLabel: "❌ إلغاء",
  ambiguousPickPromptPrefix: "أي منتج تقصد بـ",
  invoiceCreatedPrefix: "تم إنشاء الفاتورة بنجاح ✅",
  confirmNotPending:
    "هذه المسودة لم تعد قابلة للتأكيد (ربما أُكّدت أو أُلغيت من قبل).",
  confirmNoCustomer: 'اختر عميلاً من شاشة "مراجعة وتعديل" قبل تأكيد الفاتورة.',
  confirmUnresolvedItems:
    "بعض المنتجات تحتاج مراجعة قبل التأكيد — افتح شاشة المراجعة.",
  confirmEmpty: "المسودة فارغة.",
  confirmInvoiceErrorFallback: "تعذّر إنشاء الفاتورة.",
  callbackUnauthorized: "غير مصرح لك.",
  callbackNotFound: "غير موجود.",
  customerSetPrefix: "تم اختيار العميل:",
  customerNotFound: 'لم أجد عميلاً بهذا الاسم. جرّب اسماً آخر أو افتح "مراجعة وتعديل" للبحث.',
  customerAmbiguousPrompt: "اختر العميل المقصود:",
  identityReplyTemplate:
    "أنا مساعد ذكاء اصطناعي في {appName}، أساعد الموظفين على إنشاء الفواتير عبر رسائل صوتية أو نصية.",
};

const EN: BotText = {
  chooseLanguagePrompt:
    "اختر لغتك / Choose your language / Choisissez votre langue",
  languageUpdated: "Language updated to English ✅",
  startNoToken:
    "Open the connect link from your account settings in the dashboard to link this bot.",
  startTokenExpired: "This link has expired. Generate a new one.",
  startAlreadyLinkedToOther:
    "This Telegram account is already linked to another user.",
  startLinkedGreeting:
    "Your account is now linked ✅ Choose your language to continue:",
  notLinkedOrForbidden:
    "This account isn't linked, or doesn't have permission to use this bot. Link your account from the dashboard settings.",
  voiceTooLarge: "The voice message is too large.",
  voiceTranscribeFailed:
    "Couldn't transcribe the voice message. Please try again.",
  serviceNotConfigured:
    "The service isn't configured yet. Contact your system admin.",
  understandFailed:
    "Couldn't understand the request. Try phrasing it differently.",
  unknownIntentHelp:
    'Didn\'t understand that. Try something like: "give me two cappuccino and three coke".',
  noActiveDraftToConfirm: "There's no active invoice draft to confirm.",
  noActiveDraftToCancel: "There's no active invoice draft to cancel.",
  draftCancelled: "Draft cancelled.",
  noActiveDraftForEdit:
    'No active invoice draft. Start a new order first, e.g. "give me a cappuccino".',
  noActiveDraftMessage: "There's no active invoice draft right now.",
  draftHeader: "🧾 Invoice draft",
  totalLabel: "Total",
  needsCustomerNote:
    "⚠️ Choose a customer in the review screen before confirming.",
  notFoundSuffix: "⚠️ not found in the system",
  ambiguousSuffix: "⚠️ needs product selection",
  reviewEditButton: "✏️ Review & Edit",
  createInvoiceButton: "✅ Create Invoice",
  cancelButtonLabel: "❌ Cancel",
  ambiguousPickPromptPrefix: "Which product did you mean by",
  invoiceCreatedPrefix: "Invoice created successfully ✅",
  confirmNotPending:
    "This draft can no longer be confirmed (it may already be confirmed or cancelled).",
  confirmNoCustomer:
    'Choose a customer in the "Review & Edit" screen before confirming the invoice.',
  confirmUnresolvedItems:
    "Some products need review before confirming — open the review screen.",
  confirmEmpty: "The draft is empty.",
  confirmInvoiceErrorFallback: "Couldn't create the invoice.",
  callbackUnauthorized: "You're not authorized.",
  callbackNotFound: "Not found.",
  customerSetPrefix: "Customer set:",
  customerNotFound: 'No customer found with that name. Try another name, or open "Review & Edit" to search.',
  customerAmbiguousPrompt: "Which customer did you mean:",
  identityReplyTemplate:
    "I'm an AI assistant for {appName} — I help staff create invoices by voice or text message.",
};

const FR: BotText = {
  chooseLanguagePrompt:
    "اختر لغتك / Choose your language / Choisissez votre langue",
  languageUpdated: "Langue mise à jour en français ✅",
  startNoToken:
    "Ouvrez le lien de connexion depuis les paramètres de votre compte pour lier ce bot.",
  startTokenExpired: "Ce lien a expiré. Générez-en un nouveau.",
  startAlreadyLinkedToOther:
    "Ce compte Telegram est déjà lié à un autre utilisateur.",
  startLinkedGreeting:
    "Votre compte est maintenant lié ✅ Choisissez votre langue pour continuer :",
  notLinkedOrForbidden:
    "Ce compte n'est pas lié, ou ne dispose pas des droits nécessaires pour utiliser ce bot. Liez votre compte depuis les paramètres du tableau de bord.",
  voiceTooLarge: "Le message vocal est trop volumineux.",
  voiceTranscribeFailed:
    "Impossible de transcrire le message vocal. Réessayez.",
  serviceNotConfigured:
    "Le service n'est pas encore configuré. Contactez votre administrateur.",
  understandFailed: "Impossible de comprendre la demande. Reformulez-la.",
  unknownIntentHelp:
    'Je n\'ai pas compris. Essayez par exemple : "donne-moi deux cappuccino et trois coca".',
  noActiveDraftToConfirm: "Aucune facture en brouillon à confirmer.",
  noActiveDraftToCancel: "Aucune facture en brouillon à annuler.",
  draftCancelled: "Brouillon annulé.",
  noActiveDraftForEdit:
    'Aucun brouillon actif. Commencez par une nouvelle commande, ex. : "donne-moi un cappuccino".',
  noActiveDraftMessage:
    "Il n'y a aucun brouillon de facture actif pour le moment.",
  draftHeader: "🧾 Brouillon de facture",
  totalLabel: "Total",
  needsCustomerNote:
    "⚠️ Choisissez un client dans l'écran de révision avant de confirmer.",
  notFoundSuffix: "⚠️ introuvable dans le système",
  ambiguousSuffix: "⚠️ nécessite un choix de produit",
  reviewEditButton: "✏️ Réviser et modifier",
  createInvoiceButton: "✅ Créer la facture",
  cancelButtonLabel: "❌ Annuler",
  ambiguousPickPromptPrefix: "Quel produit voulez-vous dire par",
  invoiceCreatedPrefix: "Facture créée avec succès ✅",
  confirmNotPending:
    "Ce brouillon ne peut plus être confirmé (déjà confirmé ou annulé).",
  confirmNoCustomer:
    'Choisissez un client dans l\'écran "Réviser et modifier" avant de confirmer.',
  confirmUnresolvedItems:
    "Certains produits nécessitent une révision avant confirmation — ouvrez l'écran de révision.",
  confirmEmpty: "Le brouillon est vide.",
  confirmInvoiceErrorFallback: "Impossible de créer la facture.",
  callbackUnauthorized: "Vous n'êtes pas autorisé.",
  callbackNotFound: "Introuvable.",
  customerSetPrefix: "Client sélectionné :",
  customerNotFound: 'Aucun client trouvé avec ce nom. Essayez un autre nom, ou ouvrez "Réviser et modifier" pour chercher.',
  customerAmbiguousPrompt: "Quel client voulez-vous dire :",
  identityReplyTemplate:
    "Je suis un assistant IA pour {appName} — j'aide le personnel à créer des factures par message vocal ou texte.",
};

const BOT_TEXT: Record<InvoiceLanguage, BotText> = { AR, EN, FR };

export const BOT_LANGUAGE_LABELS: Record<InvoiceLanguage, string> = {
  AR: "العربية",
  EN: "English",
  FR: "Français",
};

export const BOT_LANGUAGES: InvoiceLanguage[] = ["AR", "EN", "FR"];

/** Falls back to Arabic only for the sliver of interaction that happens
 * before a language is known (the very first message after linking) — every
 * other call site has a real, chosen `InvoiceLanguage` by the time it needs
 * text. */
export function getBotText(lang: InvoiceLanguage | null): BotText {
  return BOT_TEXT[lang ?? "AR"];
}
