import Script from "next/script";

/**
 * Isolated shell for the Telegram Mini App — no dashboard/caisse chrome.
 * Runs inside Telegram's own WebView, which has no cookies shared with the
 * dashboard, so this route group never uses the NextAuth session or the
 * app-wide locale cookie; it authenticates purely via `initData` (see
 * `src/lib/telegram-init-data.ts`). `dir`/`lang` aren't fixed here — the
 * linked account's language is only known client-side after the initial
 * draft load, so `TelegramMiniApp` itself sets them once it knows.
 */
export default function TelegramAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <div className="mx-auto max-w-md min-h-screen bg-background">{children}</div>
    </div>
  );
}
