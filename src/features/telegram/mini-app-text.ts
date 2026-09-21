import type { InvoiceLanguage } from "@/generated/prisma/enums";

/**
 * Localized strings for the Telegram Mini App (`/telegram-app/[token]`).
 * The Mini App follows the same per-account language the bot itself uses
 * (set via /lang in the chat, see `bot-text.ts`) rather than the Telegram
 * client's own language — one consistent setting per linked account.
 */

export type MiniAppText = {
  dir: "rtl" | "ltr";
  genericError: string;
  errors: Record<string, string>;
  openFromTelegramOnly: string;
  failedToLoadDraft: string;
  invoiceCreatedSuccess: string;
  draftCancelledMessage: string;
  header: string;
  changeButton: string;
  chooseCustomerButton: string;
  customerSearchPlaceholder: string;
  noResults: string;
  ambiguousBadge: string;
  notFoundBadge: string;
  addProductButton: string;
  productSearchPlaceholder: string;
  totalLabel: string;
  confirmButton: string;
  cancelButton: string;
};

const AR: MiniAppText = {
  dir: "rtl",
  genericError: "حدث خطأ. حاول مرة أخرى.",
  errors: {
    config: "الخدمة غير مهيأة بعد.",
    unauthorized: "تعذّر التحقق من الهوية.",
    not_linked: "حسابك غير مرتبط بهذا البوت.",
    forbidden: "لا تملك صلاحية كافية لهذا الإجراء.",
    not_found: "المسودة غير موجودة أو انتهت صلاحيتها.",
    not_pending: "لم تعد هذه المسودة قابلة للتعديل.",
    no_customer: "اختر عميلاً قبل تأكيد الفاتورة.",
    unresolved_items: "بعض المنتجات تحتاج مراجعة قبل التأكيد.",
    empty: "أضف منتجاً واحداً على الأقل.",
    invalid_input: "بيانات غير صحيحة.",
    item_not_found: "هذا العنصر لم يعد موجوداً.",
    product_not_found: "المنتج غير موجود.",
    customer_not_found: "العميل غير موجود.",
    invalid_candidate: "اختيار غير صالح.",
    invoice_error: "تعذّر إنشاء الفاتورة.",
  },
  openFromTelegramOnly: "افتح هذه الصفحة من داخل تطبيق Telegram.",
  failedToLoadDraft: "تعذّر تحميل المسودة.",
  invoiceCreatedSuccess: "تم إنشاء الفاتورة بنجاح ✅",
  draftCancelledMessage: "تم إلغاء المسودة.",
  header: "🧾 مسودة الفاتورة",
  changeButton: "تغيير",
  chooseCustomerButton: "اختر عميلاً",
  customerSearchPlaceholder: "ابحث بالاسم أو الهاتف",
  noResults: "لا توجد نتائج.",
  ambiguousBadge: "يحتاج اختيار المنتج",
  notFoundBadge: "غير موجود في النظام",
  addProductButton: "+ إضافة منتج",
  productSearchPlaceholder: "ابحث عن منتج",
  totalLabel: "الإجمالي",
  confirmButton: "تأكيد وإنشاء الفاتورة",
  cancelButton: "إلغاء",
};

const EN: MiniAppText = {
  dir: "ltr",
  genericError: "Something went wrong. Please try again.",
  errors: {
    config: "The service isn't configured yet.",
    unauthorized: "Couldn't verify your identity.",
    not_linked: "Your account isn't linked to this bot.",
    forbidden: "You don't have permission for this action.",
    not_found: "This draft doesn't exist or has expired.",
    not_pending: "This draft can no longer be edited.",
    no_customer: "Choose a customer before confirming the invoice.",
    unresolved_items: "Some products need review before confirming.",
    empty: "Add at least one product.",
    invalid_input: "Invalid data.",
    item_not_found: "This item no longer exists.",
    product_not_found: "Product not found.",
    customer_not_found: "Customer not found.",
    invalid_candidate: "Invalid selection.",
    invoice_error: "Couldn't create the invoice.",
  },
  openFromTelegramOnly: "Open this page from inside the Telegram app.",
  failedToLoadDraft: "Couldn't load the draft.",
  invoiceCreatedSuccess: "Invoice created successfully ✅",
  draftCancelledMessage: "Draft cancelled.",
  header: "🧾 Invoice Draft",
  changeButton: "Change",
  chooseCustomerButton: "Choose a customer",
  customerSearchPlaceholder: "Search by name or phone",
  noResults: "No results.",
  ambiguousBadge: "Needs product selection",
  notFoundBadge: "Not found in the system",
  addProductButton: "+ Add Product",
  productSearchPlaceholder: "Search for a product",
  totalLabel: "Total",
  confirmButton: "Confirm & Create Invoice",
  cancelButton: "Cancel",
};

const FR: MiniAppText = {
  dir: "ltr",
  genericError: "Une erreur est survenue. Réessayez.",
  errors: {
    config: "Le service n'est pas encore configuré.",
    unauthorized: "Impossible de vérifier votre identité.",
    not_linked: "Votre compte n'est pas lié à ce bot.",
    forbidden: "Vous n'avez pas les droits nécessaires pour cette action.",
    not_found: "Ce brouillon n'existe pas ou a expiré.",
    not_pending: "Ce brouillon ne peut plus être modifié.",
    no_customer: "Choisissez un client avant de confirmer la facture.",
    unresolved_items: "Certains produits nécessitent une révision avant confirmation.",
    empty: "Ajoutez au moins un produit.",
    invalid_input: "Données invalides.",
    item_not_found: "Cet élément n'existe plus.",
    product_not_found: "Produit introuvable.",
    customer_not_found: "Client introuvable.",
    invalid_candidate: "Sélection invalide.",
    invoice_error: "Impossible de créer la facture.",
  },
  openFromTelegramOnly: "Ouvrez cette page depuis l'application Telegram.",
  failedToLoadDraft: "Impossible de charger le brouillon.",
  invoiceCreatedSuccess: "Facture créée avec succès ✅",
  draftCancelledMessage: "Brouillon annulé.",
  header: "🧾 Brouillon de facture",
  changeButton: "Changer",
  chooseCustomerButton: "Choisir un client",
  customerSearchPlaceholder: "Rechercher par nom ou téléphone",
  noResults: "Aucun résultat.",
  ambiguousBadge: "Nécessite un choix de produit",
  notFoundBadge: "Introuvable dans le système",
  addProductButton: "+ Ajouter un produit",
  productSearchPlaceholder: "Rechercher un produit",
  totalLabel: "Total",
  confirmButton: "Confirmer et créer la facture",
  cancelButton: "Annuler",
};

const MINI_APP_TEXT: Record<InvoiceLanguage, MiniAppText> = { AR, EN, FR };

/** Falls back to Arabic before the account's language is known (the brief
 * moment before the initial draft load resolves), matching the bot's own
 * `getBotText(null)` fallback convention. */
export function getMiniAppText(lang: InvoiceLanguage | null): MiniAppText {
  return MINI_APP_TEXT[lang ?? "AR"];
}
