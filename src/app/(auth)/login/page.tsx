import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { BrandMark } from "@/components/shared/brand-mark";
import { getSystemSettings } from "@/features/settings/queries";
import { getDictionary } from "@/i18n/server";

export default async function LoginPage() {
  const [t, settings] = await Promise.all([
    getDictionary(),
    getSystemSettings(),
  ]);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-muted/30 p-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 start-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 end-0 size-[32rem] translate-x-1/3 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="absolute top-4 end-4">
        <LocaleSwitcher />
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-3xl border bg-card/70 p-5 shadow-sm ring-1 ring-foreground/5 backdrop-blur-sm">
            <BrandMark size="2xl" logoUrl={settings.logoUrl} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {settings.appName}
          </h1>
        </div>

        <Card className="shadow-xl shadow-primary/5">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">{t.auth.loginTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {settings.appName}
        </p>
      </div>
    </main>
  );
}
