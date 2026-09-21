"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Minus, Plus, Trash2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getTelegramDraftForMiniApp,
  updateTelegramDraftItemQuantityAction,
  removeTelegramDraftItemAction,
  addTelegramDraftItemAction,
  pickTelegramDraftCandidateAction,
  setTelegramDraftCustomerAction,
  searchTelegramCustomersAction,
  searchTelegramProductsAction,
  confirmTelegramInvoiceDraft,
  cancelTelegramInvoiceDraft,
  type TelegramDraftView,
} from "@/features/telegram/actions";
import { getMiniAppText } from "@/features/telegram/mini-app-text";
import type { InvoiceLanguage } from "@/generated/prisma/enums";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
        close: () => void;
      };
    };
  }
}

type ActionResult<T> = { error: string } | ({ success: true } & T);

type CustomerResult = { id: string; name: string; phone: string };
type ProductResult = { id: string; name: string; sku: string; price1: number };

export function TelegramMiniApp({ token }: { token: string }) {
  // Read once on mount — Telegram's WebApp bridge only exists client-side,
  // so this is undefined during SSR and stable for the component's lifetime.
  const [initData] = useState<string>(() =>
    typeof window !== "undefined" ? (window.Telegram?.WebApp?.initData ?? "") : "",
  );
  // The account's language (set via /lang in the bot chat) — unknown until
  // the initial draft load resolves, so every string before then falls back
  // to getMiniAppText(null)'s default.
  const [language, setLanguage] = useState<InvoiceLanguage | null>(null);
  const t = getMiniAppText(language);

  const [draft, setDraft] = useState<TelegramDraftView | null>(null);
  const [loading, setLoading] = useState(() => Boolean(initData));
  const [loadError, setLoadError] = useState<string | null>(() =>
    initData ? null : getMiniAppText(null).openFromTelegramOnly,
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"confirmed" | "cancelled" | null>(null);

  const [customerPanelOpen, setCustomerPanelOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);

  const [productPanelOpen, setProductPanelOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductResult[]>([]);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
  }, []);

  useEffect(() => {
    if (!initData) return;
    getTelegramDraftForMiniApp({ token, initData }).then((res) => {
      if ("error" in res) {
        setLoadError(getMiniAppText(null).errors[res.error] ?? getMiniAppText(null).genericError);
      } else {
        setLanguage(res.language);
        setDraft(res.draft);
      }
      setLoading(false);
    });
  }, [token, initData]);

  function base() {
    return { token, initData };
  }

  function errorText(code: string) {
    return t.errors[code] ?? t.genericError;
  }

  async function run<T>(
    promise: Promise<ActionResult<T>>,
    onSuccess?: (result: T) => void,
  ) {
    setBusy(true);
    try {
      const result = await promise;
      if ("error" in result) {
        toast.error(errorText(result.error));
        return;
      }
      onSuccess?.(result);
    } finally {
      setBusy(false);
    }
  }

  function applyDraft(result: { draft: TelegramDraftView }) {
    setDraft(result.draft);
  }

  async function changeQuantity(itemId: string, quantity: number) {
    if (quantity <= 0) {
      await run(removeTelegramDraftItemAction({ ...base(), itemId }), applyDraft);
      return;
    }
    await run(
      updateTelegramDraftItemQuantityAction({ ...base(), itemId, quantity }),
      applyDraft,
    );
  }

  async function removeItem(itemId: string) {
    await run(removeTelegramDraftItemAction({ ...base(), itemId }), applyDraft);
  }

  async function pickCandidate(itemId: string, productId: string) {
    await run(pickTelegramDraftCandidateAction({ ...base(), itemId, productId }), applyDraft);
  }

  async function searchCustomers(q: string) {
    setCustomerQuery(q);
    const res = await searchTelegramCustomersAction({ ...base(), q });
    setCustomerResults(res.items);
  }

  async function chooseCustomer(customerId: string) {
    await run(setTelegramDraftCustomerAction({ ...base(), customerId }), (result) => {
      applyDraft(result);
      setCustomerPanelOpen(false);
    });
  }

  async function searchProducts(q: string) {
    setProductQuery(q);
    const res = await searchTelegramProductsAction({ ...base(), q });
    setProductResults(res.items);
  }

  async function addProduct(productId: string) {
    await run(addTelegramDraftItemAction({ ...base(), productId, quantity: 1 }), (result) => {
      applyDraft(result);
      setProductPanelOpen(false);
      setProductQuery("");
      setProductResults([]);
    });
  }

  async function confirm() {
    await run(confirmTelegramInvoiceDraft(base()), () => setDone("confirmed"));
  }

  async function cancel() {
    await run(cancelTelegramInvoiceDraft(base()), () => setDone("cancelled"));
  }

  if (loading) {
    return (
      <div dir={t.dir} className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !draft) {
    return (
      <div
        dir={t.dir}
        className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground"
      >
        {loadError ?? t.failedToLoadDraft}
      </div>
    );
  }

  if (done) {
    return (
      <div dir={t.dir} className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-base font-medium">
          {done === "confirmed" ? t.invoiceCreatedSuccess : t.draftCancelledMessage}
        </p>
      </div>
    );
  }

  const canConfirm =
    !busy && draft.status === "PENDING" && !!draft.customer && !draft.hasUnresolvedItems && draft.items.length > 0;

  return (
    <div dir={t.dir} className="flex min-h-screen flex-col gap-4 p-4">
      <h1 className="text-lg font-bold">{t.header}</h1>

      {/* Customer */}
      <div className="rounded-lg border p-3">
        {draft.customer ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{draft.customer.name}</p>
              <p className="text-xs text-muted-foreground">{draft.customer.phone}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setCustomerPanelOpen(true)}>
              {t.changeButton}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setCustomerPanelOpen(true);
              searchCustomers("");
            }}
          >
            {t.chooseCustomerButton}
          </Button>
        )}
      </div>

      {customerPanelOpen && (
        <div className="rounded-lg border p-3">
          <div className="mb-2 flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder={t.customerSearchPlaceholder}
              value={customerQuery}
              onChange={(e) => searchCustomers(e.target.value)}
            />
            <Button size="icon-sm" variant="ghost" onClick={() => setCustomerPanelOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {customerResults.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy}
                onClick={() => chooseCustomer(c.id)}
                className="w-full rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted"
              >
                {c.name} — {c.phone}
              </button>
            ))}
            {customerResults.length === 0 && (
              <p className="p-2 text-xs text-muted-foreground">{t.noResults}</p>
            )}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="flex flex-col gap-2">
        {draft.items.map((item) => (
          <div key={item.id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {item.matchedProduct?.name ?? item.spokenName}
                </p>
                {item.matchStatus === "AMBIGUOUS" && (
                  <Badge variant="destructive" className="mt-1">
                    {t.ambiguousBadge}
                  </Badge>
                )}
                {item.matchStatus === "NOT_FOUND" && (
                  <Badge variant="destructive" className="mt-1">
                    {t.notFoundBadge}
                  </Badge>
                )}
                {item.matchedProduct && (
                  <p className="text-xs text-muted-foreground">
                    {item.matchedProduct.price1.toFixed(2)} DH
                  </p>
                )}
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={busy}
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>

            {item.matchStatus === "AMBIGUOUS" && item.candidates.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {item.candidates.map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => pickCandidate(item.id, c.id)}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            )}

            {item.matchedProduct && (
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="icon-sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => changeQuantity(item.id, item.quantity - 1)}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-10 text-center text-sm">{item.quantity}</span>
                <Button
                  size="icon-sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => changeQuantity(item.id, item.quantity + 1)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            )}
          </div>
        ))}

        {!productPanelOpen ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setProductPanelOpen(true);
              searchProducts("");
            }}
          >
            {t.addProductButton}
          </Button>
        ) : (
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder={t.productSearchPlaceholder}
                value={productQuery}
                onChange={(e) => searchProducts(e.target.value)}
              />
              <Button size="icon-sm" variant="ghost" onClick={() => setProductPanelOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {productResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={busy}
                  onClick={() => addProduct(p.id)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted"
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.price1.toFixed(2)} DH
                  </span>
                </button>
              ))}
              {productResults.length === 0 && (
                <p className="p-2 text-xs text-muted-foreground">{t.noResults}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Total + actions */}
      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t bg-background pt-3">
        <div className="flex items-center justify-between text-base font-bold">
          <span>{t.totalLabel}</span>
          <span>{draft.total.toFixed(2)} DH</span>
        </div>
        <Button disabled={!canConfirm} onClick={confirm} className="w-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : t.confirmButton}
        </Button>
        <Button variant="outline" disabled={busy} onClick={cancel} className="w-full">
          {t.cancelButton}
        </Button>
      </div>
    </div>
  );
}
