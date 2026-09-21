"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useLocale } from "@/i18n/locale-provider";
import { generateTelegramLinkToken, unlinkTelegramAccount } from "@/features/telegram/actions";

export function TelegramConnectCard({ connected: initialConnected }: { connected: boolean }) {
  const { t } = useLocale();
  const [connected, setConnected] = useState(initialConnected);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function connect() {
    startTransition(async () => {
      const result = await generateTelegramLinkToken();
      if ("error" in result) {
        toast.error(t.telegram.generateError);
        return;
      }
      setDeepLink(result.deepLink);
    });
  }

  function unlink() {
    startTransition(async () => {
      const result = await unlinkTelegramAccount();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setConnected(false);
      setDeepLink(null);
      toast.success(t.telegram.unlinkSuccess);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t.telegram.description}</p>
        <Badge variant={connected ? "default" : "outline"}>
          {connected ? t.telegram.connectedLabel : t.telegram.notConnectedLabel}
        </Badge>
      </div>

      {connected ? (
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="outline" disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : t.telegram.unlinkButton}
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.telegram.unlinkConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.telegram.unlinkConfirmDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={unlink}>{t.telegram.unlinkButton}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : deepLink ? (
        <div className="space-y-2">
          <Button onClick={() => window.open(deepLink, "_blank", "noopener,noreferrer")}>
            <Send /> {t.telegram.openInTelegram}
          </Button>
          <p className="text-xs text-muted-foreground">{t.telegram.linkExpiresNote}</p>
        </div>
      ) : (
        <Button onClick={connect} disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : t.telegram.connectButton}
        </Button>
      )}
    </div>
  );
}
