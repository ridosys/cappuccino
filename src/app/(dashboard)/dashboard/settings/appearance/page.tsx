import { Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { getSystemSettings } from "@/features/settings/queries";
import { AppearanceForm } from "@/features/settings/components/appearance-form";
import { CompanyLogoForm } from "@/features/settings/components/company-logo-form";
import { requirePageAccess } from "@/lib/permissions";
import { getDictionary } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function AppearancePage() {
  await requirePageAccess("SETTINGS_MANAGE");

  const [t, settings] = await Promise.all([getDictionary(), getSystemSettings()]);

  return (
    <div className="space-y-6">
      <PageHeader title={t.admin.appearance} icon={Palette} />
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.brandingTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyLogoForm logoUrl={settings.logoUrl} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.appearanceTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <AppearanceForm settings={settings} />
        </CardContent>
      </Card>
    </div>
  );
}
