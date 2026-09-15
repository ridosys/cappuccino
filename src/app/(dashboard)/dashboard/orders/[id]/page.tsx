import { notFound } from "next/navigation";
import { Phone, MessageCircle, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { BackButton } from "@/components/shared/back-button";
import { getOrderById } from "@/features/orders/queries";
import { getCustomerOptions } from "@/features/customers/queries";
import { getProductPickerOptions } from "@/features/products/queries";
import { OrderStatusSelect } from "@/features/orders/components/order-status-select";
import { OrderItemsPriceForm } from "@/features/orders/components/order-items-price-form";
import { GenerateInvoiceDialog } from "@/features/orders/components/generate-invoice-dialog";
import { OrderCustomerCard } from "@/features/orders/components/order-customer-card";
import { InvoiceLockedNotice } from "@/features/orders/components/invoice-locked-notice";
import { OrderDeleteActions } from "@/features/orders/components/order-delete-actions";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";
import { formatMessage } from "@/i18n/format";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function buildDefaultMessage(
  order: {
    customerName: string;
    orderNumber: string;
    items: { product: { name: string }; quantity: number | Prisma.Decimal }[];
    total: unknown;
  },
  t: Dictionary,
) {
  const lines = [
    formatMessage(t.orders.whatsappGreeting, { name: order.customerName }),
    formatMessage(t.orders.whatsappOrderRef, { number: order.orderNumber }),
    ...order.items.map((item) => `- ${item.product.name} × ${item.quantity}`),
    formatMessage(t.orders.whatsappTotalLine, { total: String(order.total) }),
    t.orders.whatsappClosing,
  ];
  return lines.join("\n");
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("ORDERS_VIEW");

  const { id } = await params;
  const [t, order, customers, productRows] = await Promise.all([
    getDictionary(),
    getOrderById(id),
    getCustomerOptions(),
    getProductPickerOptions(),
  ]);
  if (!order) notFound();

  const products = productRows.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    quantity: Number(product.quantity),
    categoryId: product.categoryId,
    categoryName: product.category.name,
    brandId: product.brandId,
    brandName: product.brand?.name ?? null,
    price1: Number(product.price1),
    price2: Number(product.price2),
    price3: Number(product.price3),
  }));

  const message = buildDefaultMessage(order, t);
  const whatsappUrl = buildWhatsAppUrl(order.customerPhone, message);
  const locked = Boolean(order.invoice);

  return (
    <div className="space-y-6">
      <PageHeader
        title={formatMessage(t.orders.detailTitle, { number: order.orderNumber })}
        icon={ShoppingCart}
        action={<BackButton fallbackHref="/dashboard/orders" />}
      />

      <p className="text-sm text-muted-foreground">
        {t.common.createdByLabel}:{" "}
        <span className="font-medium text-foreground">
          {order.createdBy?.name ?? t.common.unknownEmployee}
        </span>
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t.orders.itemsCardTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderItemsPriceForm
                orderId={order.id}
                items={order.items.map((item) => ({
                  id: item.id,
                  productId: item.productId,
                  productName: item.product.name,
                  quantity: Number(item.quantity),
                  price: Number(item.price),
                  product: {
                    ...item.product,
                    quantity: Number(item.product.quantity),
                    price1: Number(item.product.price1),
                    price2: Number(item.product.price2),
                    price3: Number(item.product.price3),
                  },
                }))}
                products={products}
                locked={locked}
                invoiceId={order.invoice?.id}
                invoiceNumber={order.invoice?.invoiceNumber}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.orders.actionsCardTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {order.invoice ? (
                <InvoiceLockedNotice
                  invoiceId={order.invoice.id}
                  invoiceNumber={order.invoice.invoiceNumber}
                  message={t.orders.invoiceAlreadyIssuedMessage}
                />
              ) : (
                <GenerateInvoiceDialog
                  orderId={order.id}
                  orderTotal={Number(order.total)}
                  customerBalance={
                    order.customer ? Number(order.customer.balance) : 0
                  }
                  hasCustomer={Boolean(order.customer)}
                />
              )}
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <a href={whatsappUrl} />
                }
              >
                <MessageCircle className="size-4" />
                {t.orders.sendWhatsapp}
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<a href={`tel:${order.customerPhone}`} />}
              >
                <Phone className="size-4" />
                {t.orders.callCustomer}
              </Button>
              <OrderDeleteActions
                orderId={order.id}
                orderNumber={order.orderNumber}
                invoice={
                  order.invoice
                    ? {
                        id: order.invoice.id,
                        invoiceNumber: order.invoice.invoiceNumber,
                        customerName: order.customerName,
                        customerPhone: order.customerPhone,
                        total: Number(order.invoice.total),
                        paymentStatus: order.invoice.paymentStatus,
                        createdAt: order.invoice.createdAt,
                        balanceEffectApplied: Number(
                          order.invoice.balanceEffectApplied,
                        ),
                      }
                    : null
                }
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <OrderCustomerCard
            orderId={order.id}
            customers={customers}
            currentCustomer={
              order.customer
                ? {
                    id: order.customer.id,
                    name: order.customer.name,
                    phone: order.customer.phone,
                    email: order.customer.email,
                    address: order.customer.address,
                    notes: order.customer.notes,
                  }
                : null
            }
            snapshot={{
              name: order.customerName,
              phone: order.customerPhone,
              email: order.customerEmail,
            }}
            createdAt={order.createdAt}
            notes={order.notes}
            locked={locked}
            invoiceId={order.invoice?.id}
            invoiceNumber={order.invoice?.invoiceNumber}
          />

          <Card>
            <CardHeader>
              <CardTitle>{t.orders.statusCardTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderStatusSelect
                orderId={order.id}
                status={order.status}
                hasInvoice={Boolean(order.invoice)}
                orderTotal={Number(order.total)}
                customerBalance={
                  order.customer ? Number(order.customer.balance) : 0
                }
                hasCustomer={Boolean(order.customer)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
