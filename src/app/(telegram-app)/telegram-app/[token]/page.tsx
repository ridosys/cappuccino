import { TelegramMiniApp } from "@/features/telegram/components/telegram-mini-app";

export default async function TelegramMiniAppPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <TelegramMiniApp token={token} />;
}
