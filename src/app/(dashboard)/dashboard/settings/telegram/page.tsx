import { Send } from "lucide-react";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { requirePageAccess } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { getTelegramAccountForAdmin } from "@/features/telegram/queries";
import { TelegramConnectCard } from "@/features/telegram/components/telegram-connect-card";

export const dynamic = "force-dynamic";

export default async function TelegramSettingsPage() {
  await requirePageAccess("POS_MANAGE");

  const session = await auth();
  if (!session?.user) notFound();

  const [t, account] = await Promise.all([
    getDictionary(),
    getTelegramAccountForAdmin(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t.admin.telegram} icon={Send} />
      <Card>
        <CardHeader>
          <CardTitle>{t.admin.telegram}</CardTitle>
        </CardHeader>
        <CardContent>
          <TelegramConnectCard connected={Boolean(account?.isActive)} />
        </CardContent>
      </Card>
    </div>
  );
}
