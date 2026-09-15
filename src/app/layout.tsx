import type { Metadata } from "next";
import { Cairo, Geist_Mono } from "next/font/google";
import { DirectionProvider } from "@/components/ui/direction";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { OfflineNotification } from "@/components/shared/offline-notification";
import { localeDirection } from "@/i18n/config";
import { getLocale, getDictionary } from "@/i18n/server";
import { LocaleProvider } from "@/i18n/locale-provider";
import { companyConfig } from "@/config/company";
import { getThemeCss } from "@/config/apply-theme";
import { getSystemSettings } from "@/features/settings/queries";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-sans",
  subsets: ["arabic", "latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const [t, settings] = await Promise.all([getDictionary(), getSystemSettings()]);
  return {
    title: settings.appShortName,
    description: t.common.siteDescription,
    // A custom logo doubles as the browser-tab icon; otherwise the
    // configured favicon file.
    icons: { icon: settings.logoUrl || companyConfig.favicon },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, dictionary] = await Promise.all([getLocale(), getDictionary()]);
  const direction = localeDirection[locale];

  return (
    <html
      lang={locale}
      dir={direction}
      className={`${cairo.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <style>{await getThemeCss()}</style>
      </head>
      <body className="min-h-full flex flex-col">
        <LocaleProvider locale={locale} dictionary={dictionary}>
          <OfflineNotification />
          <DirectionProvider direction={direction}>
            <TooltipProvider>{children}</TooltipProvider>
          </DirectionProvider>
        </LocaleProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
