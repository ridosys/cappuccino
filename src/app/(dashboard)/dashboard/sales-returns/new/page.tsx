import { RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header"; import { ReturnForm } from "@/features/returns/components/return-form"; import { getInvoiceForReturn } from "@/features/returns/queries";
import { ReturnSourcePicker } from "@/features/returns/components/return-source-picker";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary, getLocale } from "@/i18n/server";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{invoiceId?:string}>}) { await requirePageAccess("RETURNS_MANAGE"); const {invoiceId}=await searchParams; const [invoice,t,locale]=await Promise.all([invoiceId?getInvoiceForReturn(invoiceId):null,getDictionary(),getLocale()]);
return <div className="space-y-6"><PageHeader title={t.returns.newSalesTitle} icon={RotateCcw}/><div className="rounded-lg border p-4"><p className="mb-3 font-medium">{t.returns.chooseSalesInvoice}</p><ReturnSourcePicker kind="sales" selectedId={invoiceId} queryKey="invoiceId" placeholder={t.returns.salesSearch} /></div>{invoice&&<><div className="rounded-lg border bg-muted/30 p-4"><b>{invoice.invoiceNumber}</b> — {invoice.customerName} — {invoice.createdAt.toLocaleDateString(locale)}</div><ReturnForm kind="sales" sourceId={invoice.id} rows={invoice.items.map(i=>({id:i.id,productName:i.product?.name??i.name,sku:i.product?.sku??"—",barcode:i.product?.barcode??null,original:Number(i.quantity),returned:i.returnItems.reduce((s,r)=>s+r.quantity.toNumber(),0),unitAmount:Number(i.unitPrice)}))}/></>}</div> }
