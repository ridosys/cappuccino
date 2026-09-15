"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n/locale-provider";

const noop = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

/**
 * App-wide "unsaved changes" tracker.
 *
 * Any client form calls `useUnsavedChanges(isDirty)` (typically with
 * react-hook-form's `formState.isDirty`, which already treats "edited back to
 * the original value" as not dirty). While at least one mounted form reports
 * dirty:
 *
 *  - a small "Unsaved changes" pill is shown at the bottom of the screen;
 *  - the browser's native prompt fires on tab close / reload / external nav
 *    (`beforeunload`);
 *  - in-app navigation via any `<a>`/`<Link>` is intercepted and confirmed;
 *  - the browser Back button is intercepted and confirmed.
 *
 * The pill and the guards disappear automatically once every form is back to
 * a clean state (saved, reset, or unmounted).
 */

type UnsavedChangesContextValue = {
  setDirty: (id: string, dirty: boolean, guardHistory: boolean) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(
  null,
);

/**
 * Register this component's dirty state with the global tracker. Safe to call
 * even when no provider is mounted (it becomes a no-op).
 *
 * `guardHistory` (default `true`) also arms a browser Back/Forward-button
 * confirmation. Modal forms (sheets, dialogs) should pass `false`: they
 * unmount cleanly on close and don't own the page's history entry, so the
 * pill + link/reload guards are enough for them.
 */
export function useUnsavedChanges(
  dirty: boolean,
  options?: { guardHistory?: boolean },
) {
  const ctx = useContext(UnsavedChangesContext);
  const id = useId();
  const guardHistory = options?.guardHistory ?? true;

  useEffect(() => {
    ctx?.setDirty(id, dirty, guardHistory);
    return () => ctx?.setDirty(id, false, guardHistory);
  }, [ctx, id, dirty, guardHistory]);
}

function isModifiedClick(event: MouseEvent) {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

export function UnsavedChangesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useT();
  const mounted = useMounted();
  const registry = useRef(new Map<string, { guardHistory: boolean }>());
  const [state, setState] = useState({ dirty: false, guardHistory: false });

  const recompute = useCallback(() => {
    let guardHistory = false;
    for (const entry of registry.current.values()) {
      if (entry.guardHistory) guardHistory = true;
    }
    setState({ dirty: registry.current.size > 0, guardHistory });
  }, []);

  const setDirty = useCallback(
    (id: string, dirty: boolean, guardHistory: boolean) => {
      if (dirty) registry.current.set(id, { guardHistory });
      else if (!registry.current.has(id)) return;
      else registry.current.delete(id);
      recompute();
    },
    [recompute],
  );

  const value = useMemo(() => ({ setDirty }), [setDirty]);

  const isDirty = state.dirty;
  const guardHistory = state.dirty && state.guardHistory;
  const confirmMessage = t.common.unsavedChangesLeaveConfirm;

  // Native prompt for full-page navigation: reload, tab close, typing a new
  // URL, or following a link to another origin.
  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // Confirm client-side navigation triggered by clicking any in-app link.
  // Runs in the capture phase so it beats next/link's own click handler:
  // if the user confirms we do nothing and the navigation proceeds as a
  // normal SPA transition; if they cancel we swallow the click.
  useEffect(() => {
    if (!isDirty) return;
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || isModifiedClick(event)) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let destination: URL;
      try {
        destination = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      if (!window.confirm(confirmMessage)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isDirty, confirmMessage]);

  // Confirm the browser Back / Forward button. The App Router exposes no
  // cancel hook for it, so we arm a throwaway history entry that absorbs the
  // first press, ask for confirmation, then either replay the navigation or
  // re-arm. The sentinel is tagged in history.state so it can be cleaned up
  // when the form is saved in place.
  useEffect(() => {
    if (!guardHistory) return;
    const guardUrl = window.location.href;
    window.history.pushState({ __unsavedChangesGuard: true }, "", guardUrl);

    function onPopState() {
      if (window.confirm(confirmMessage)) {
        window.removeEventListener("popstate", onPopState);
        window.history.back();
      } else {
        window.history.pushState({ __unsavedChangesGuard: true }, "", guardUrl);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (
        (window.history.state as { __unsavedChangesGuard?: boolean } | null)
          ?.__unsavedChangesGuard
      ) {
        window.history.back();
      }
    };
  }, [guardHistory, confirmMessage]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      {mounted &&
        isDirty &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-4 z-60 flex justify-center px-4 print:hidden"
          >
            <div className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-3.5 py-2 text-sm font-medium text-amber-900 shadow-lg animate-in fade-in slide-in-from-bottom-2">
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
              </span>
              {t.common.unsavedChanges}
            </div>
          </div>,
          document.body,
        )}
    </UnsavedChangesContext.Provider>
  );
}
