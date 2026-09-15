"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem,
  ComboboxList, ComboboxTrigger, ComboboxValue, useComboboxFilter,
} from "@/components/ui/combobox";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

type QuickProduct = {
  id: string; name: string; sku: string;
  categoryId: string; categoryName: string;
  brandId: string | null; brandName: string | null;
};
type Option = { id: string; name: string };

export function QuickProductAddPanel<T extends QuickProduct>({ products, onAddProducts }: {
  products: T[]; onAddProducts: (products: T[]) => void;
}) {
  const { t, locale } = useLocale();
  const { contains } = useComboboxFilter();
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const categories: Option[] = [{ id: "", name: t.invoices.selectCategoryPlaceholder }, ...Array.from(new Map(products.map((p) => [p.categoryId, { id: p.categoryId, name: p.categoryName }])).values())];
  const brands: Option[] = [{ id: "", name: t.invoices.selectBrandPlaceholder }, ...Array.from(new Map(products.filter((p) => p.brandId).map((p) => [p.brandId!, { id: p.brandId!, name: p.brandName! }])).values())];
  const category = categories.find((item) => item.id === categoryId) ?? categories[0];
  const brand = brands.find((item) => item.id === brandId) ?? brands[0];
  const filtered = products.filter((p) => (!categoryId || p.categoryId === categoryId) && (!brandId || p.brandId === brandId) && (!query.trim() || `${p.name} ${p.sku}`.toLowerCase().includes(query.trim().toLowerCase())));
  const picker = (items: Option[], value: Option, onChange: (id: string) => void, placeholder: string) => (
    <Combobox items={items} value={value} onValueChange={(item: Option | null) => { onChange(item?.id ?? ""); setSelected(new Set()); }} isItemEqualToValue={(a: Option, b: Option) => a.id === b.id} itemToStringValue={(item: Option) => item.id} itemToStringLabel={(item: Option) => item.name} filter={contains}>
      <ComboboxTrigger className="w-full"><ComboboxValue /></ComboboxTrigger>
      <ComboboxContent><ComboboxInput placeholder={placeholder} /><ComboboxEmpty>{t.common.noResults}</ComboboxEmpty><ComboboxList>{(item: Option) => <ComboboxItem key={item.id} value={item}>{item.name}</ComboboxItem>}</ComboboxList></ComboboxContent>
    </Combobox>
  );
  return <div className="space-y-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
    <div className="flex items-center gap-2 font-semibold"><Plus className="size-4 text-primary" />{t.invoices.quickAddTitle}</div>
    <div className="grid gap-2 sm:grid-cols-2">
      {picker(categories, category, setCategoryId, t.categories.searchPlaceholder)}
      {picker(brands, brand, setBrandId, t.brands.searchPlaceholder)}
    </div>
    {(categoryId || brandId) && <>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.inventory.productSearchPlaceholder} />
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border bg-background p-1.5">
        {filtered.map((product) => <label key={product.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"><Checkbox checked={selected.has(product.id)} onCheckedChange={() => setSelected((old) => { const next = new Set(old); if (next.has(product.id)) next.delete(product.id); else next.add(product.id); return next; })} /><span>{product.name}</span><span className="ms-auto text-xs text-muted-foreground" dir="ltr">{product.sku}</span></label>)}
      </div>
      <Button type="button" size="sm" className="w-full" disabled={!selected.size} onClick={() => { onAddProducts(filtered.filter((p) => selected.has(p.id))); setSelected(new Set()); }}><Plus className="size-4" />{formatMessage(t.invoices.addSelectedToInvoice, { count: selected.size.toLocaleString(locale) })}</Button>
    </>}
  </div>;
}
