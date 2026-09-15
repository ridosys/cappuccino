"use client";

import { useState, useTransition } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import {
  Combobox,
  ComboboxValue,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxInput,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCustomer } from "@/features/customers/actions";
import { normalizeArabicName } from "@/lib/arabic-name";
import { useLocale } from "@/i18n/locale-provider";
import { toast } from "sonner";

export type CustomerOption = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  balance?: number;
  isFavorite?: boolean;
  imageUrl?: string | null;
  imagePublicId?: string | null;
};

function customerLabel(customer: CustomerOption) {
  return customer.id ? `${customer.name} — ${customer.phone}` : customer.name;
}

export function CustomerPicker({
  customers,
  value,
  onChange,
}: {
  customers: CustomerOption[];
  value: string;
  onChange: (customer: CustomerOption | null) => void;
}) {
  const { t } = useLocale();
  const NONE_CUSTOMER: CustomerOption = {
    id: "",
    name: t.customers.selectCustomerPlaceholder,
    phone: "",
  };
  const [options, setOptions] = useState(customers);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const items = [NONE_CUSTOMER, ...options];
  const selected = items.find((item) => item.id === value) ?? NONE_CUSTOMER;

  const normalizedQuery = normalizeArabicName(query);
  const filtered = normalizedQuery
    ? options.filter(
        (customer) =>
          normalizeArabicName(customer.name).includes(normalizedQuery) ||
          customer.phone.includes(query.trim()),
      )
    : options;

  function handleCreate(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();

    startTransition(async () => {
      const result = await createCustomer({
        name,
        phone,
        email,
        isFavorite: false,
      });
      if (result.error || !result.customerId) {
        toast.error(result.error ?? t.customers.createErrorToast);
        return;
      }
      const newCustomer: CustomerOption = {
        id: result.customerId,
        name,
        phone,
        email: email || null,
        address: null,
        notes: null,
      };
      setOptions((prev) => [newCustomer, ...prev]);
      onChange(newCustomer);
      setCreateOpen(false);
      toast.success(t.customers.createSuccessToast);
    });
  }

  return (
    <>
      <div className="flex gap-2">
        <Combobox
          items={[NONE_CUSTOMER, ...filtered]}
          value={selected}
          onValueChange={(customer: CustomerOption | null) => onChange(customer)}
          isItemEqualToValue={(a: CustomerOption, b: CustomerOption) =>
            a.id === b.id
          }
          itemToStringValue={(item: CustomerOption) => item.id}
          itemToStringLabel={customerLabel}
          onInputValueChange={setQuery}
          filter={null}
        >
          <ComboboxTrigger className="w-full flex-1">
            <ComboboxValue />
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxInput placeholder={t.customers.searchCustomerPlaceholder} />
            <ComboboxEmpty>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 py-1 text-primary"
                onClick={() => setCreateOpen(true)}
              >
                <UserPlus className="size-4" />
                {t.customers.createNewCustomer}
              </button>
            </ComboboxEmpty>
            <ComboboxList>
              {(item: CustomerOption) => (
                <ComboboxItem key={item.id} value={item}>
                  {customerLabel(item)}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 cursor-pointer"
          onClick={() => setCreateOpen(true)}
          title={t.customers.createNewCustomer}
        >
          <UserPlus className="size-4" />
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.customers.createNewCustomer}</DialogTitle>
          </DialogHeader>
          <form action={handleCreate} className="space-y-4">
            <fieldset disabled={isPending} className="contents space-y-4">
            <div className="space-y-2">
              <Label htmlFor="picker-customer-name">{t.customers.nameLabel}</Label>
              <Input
                id="picker-customer-name"
                name="name"
                placeholder={t.customers.namePlaceholder}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="picker-customer-phone">
                {t.customers.phoneOptionalLabel}
              </Label>
              <Input id="picker-customer-phone" name="phone" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="picker-customer-email">
                {t.customers.emailOptionalLabel}
              </Label>
              <Input id="picker-customer-email" name="email" dir="ltr" />
            </div>
            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={isPending}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending ? t.common.saving : t.common.save}
            </Button>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
