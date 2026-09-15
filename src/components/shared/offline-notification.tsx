"use client";

import { useSyncExternalStore } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useT } from "@/i18n/locale-provider";

type ConnectionStatus = "online" | "offline" | "reconnected";

const RECONNECTED_DISPLAY_MS = 3000;

let status: ConnectionStatus = "online";
let hideTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function handleOffline() {
  if (hideTimer) clearTimeout(hideTimer);
  status = "offline";
  notify();
}

function handleOnline() {
  status = "reconnected";
  notify();
  hideTimer = setTimeout(() => {
    status = "online";
    notify();
  }, RECONNECTED_DISPLAY_MS);
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (listeners.size === 1) {
    status = navigator.onLine ? "online" : "offline";
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (hideTimer) clearTimeout(hideTimer);
    }
  };
}

function getSnapshot() {
  return status;
}

function getServerSnapshot(): ConnectionStatus {
  return "online";
}

/** Global banner shown on every page reflecting the device's connection
 * status — red while offline, then a green confirmation for a few seconds
 * once the connection comes back. Sits at the very top of the page
 * (pushing content down, not overlapping it) so it's impossible to miss. */
export function OfflineNotification() {
  const connectionStatus = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const t = useT();

  if (connectionStatus === "offline") {
    return (
      <div
        role="alert"
        className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-destructive px-4 py-2.5 text-center text-sm font-bold text-destructive-foreground shadow-md print:hidden"
      >
        <WifiOff className="size-4 shrink-0" />
        <span>{t.common.offlineMessage}</span>
      </div>
    );
  }

  if (connectionStatus === "reconnected") {
    return (
      <div
        role="status"
        className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-green-600 px-4 py-2.5 text-center text-sm font-bold text-white shadow-md print:hidden"
      >
        <Wifi className="size-4 shrink-0" />
        <span>{t.common.reconnectedMessage}</span>
      </div>
    );
  }

  return null;
}
