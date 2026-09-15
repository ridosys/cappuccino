"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ImageOff,
  Loader2,
  Package,
  Upload,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

type ProgressState = {
  processed: number;
  imported: number;
  total: number;
  currentName: string;
};

type ImportSummary = {
  total: number;
  imported: number;
  failed: number;
  skipped: number;
  validationErrors: number;
  failedImages: number;
  errors: { row: number; name?: string; reason: string }[];
};

type ImportEvent =
  | ({ type: "progress" } & ProgressState)
  | ({ type: "done" } & ImportSummary)
  | { type: "error"; message: string };

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  locale,
}: {
  icon: typeof Package;
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning" | "danger";
  locale: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border p-2.5",
        tone === "success" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        tone === "warning" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        tone === "danger" &&
          "border-destructive/30 bg-destructive/10 text-destructive",
        tone === "neutral" && "bg-muted/30 text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-base font-semibold leading-tight">
          {value.toLocaleString(locale)}
        </p>
        <p className="truncate text-xs opacity-80">{label}</p>
      </div>
    </div>
  );
}

export function ImportProductsDialog() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  function reset() {
    setFile(null);
    setInputKey((key) => key + 1);
    setProgress(null);
    setSummary(null);
    setFatalError(null);
    setShowErrors(false);
  }

  function handleOpenChange(next: boolean) {
    if (isImporting) return;
    setOpen(next);
    if (!next) reset();
  }

  async function handleImport() {
    if (!file || isImporting) return;
    setIsImporting(true);
    setSummary(null);
    setFatalError(null);
    setShowErrors(false);
    setProgress({ processed: 0, imported: 0, total: 0, currentName: "" });

    function handleEvent(event: ImportEvent) {
      if (event.type === "progress") {
        setProgress(event);
        return;
      }
      if (event.type === "done") {
        setSummary(event);
        router.refresh();
        if (event.imported > 0) {
          toast.success(
            formatMessage(t.products.import.successToast, {
              count: event.imported.toLocaleString(locale),
            }),
          );
        } else {
          toast.error(t.products.import.noneImportedToast);
        }
        return;
      }
      setFatalError(event.message);
      toast.error(event.message);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/products/import", {
        method: "POST",
        body: formData,
      });
      if (!response.body) throw new Error(t.products.import.connectionError);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) handleEvent(JSON.parse(line));
        }
      }
      if (buffer.trim()) handleEvent(JSON.parse(buffer));
    } catch {
      const message = t.products.import.genericError;
      setFatalError(message);
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  }

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : 0;

  const stage: "form" | "importing" | "result" =
    summary || fatalError ? "result" : isImporting ? "importing" : "form";

  const isFullSuccess =
    summary &&
    summary.imported === summary.total &&
    summary.failed === 0 &&
    summary.skipped === 0 &&
    summary.validationErrors === 0 &&
    summary.failedImages === 0;

  const isTotalFailure = summary && summary.imported === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Upload className="size-4" />
            {t.products.import.button}
          </Button>
        }
      />
      <DialogContent>
        {stage !== "result" && (
          <DialogHeader>
            <DialogTitle>{t.products.import.title}</DialogTitle>
            <DialogDescription>{t.products.import.description}</DialogDescription>
          </DialogHeader>
        )}

        {stage === "result" && summary && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              {isFullSuccess ? (
                <CheckCircle2 className="size-12 text-emerald-500" />
              ) : isTotalFailure ? (
                <XCircle className="size-12 text-destructive" />
              ) : (
                <AlertTriangle className="size-12 text-amber-500" />
              )}
              <DialogTitle className="text-lg">
                {isFullSuccess
                  ? t.products.import.successTitle
                  : isTotalFailure
                    ? t.products.import.noneImportedTitle
                    : t.products.import.partialTitle}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {isFullSuccess
                  ? formatMessage(t.products.import.successDescription, {
                      total: summary.total.toLocaleString(locale),
                    })
                  : formatMessage(t.products.import.partialDescription, {
                      imported: summary.imported.toLocaleString(locale),
                      total: summary.total.toLocaleString(locale),
                    })}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatTile
                icon={Package}
                label={t.products.import.statTotal}
                value={summary.total}
                tone="neutral"
                locale={locale}
              />
              <StatTile
                icon={CheckCircle2}
                label={t.products.import.statImported}
                value={summary.imported}
                tone="success"
                locale={locale}
              />
              {summary.skipped > 0 && (
                <StatTile
                  icon={AlertTriangle}
                  label={t.products.import.statSkipped}
                  value={summary.skipped}
                  tone="warning"
                  locale={locale}
                />
              )}
              {summary.validationErrors > 0 && (
                <StatTile
                  icon={AlertTriangle}
                  label={t.products.import.statValidationErrors}
                  value={summary.validationErrors}
                  tone="warning"
                  locale={locale}
                />
              )}
              {summary.failed > 0 && (
                <StatTile
                  icon={XCircle}
                  label={t.products.import.statFailed}
                  value={summary.failed}
                  tone="danger"
                  locale={locale}
                />
              )}
              {summary.failedImages > 0 && (
                <StatTile
                  icon={ImageOff}
                  label={t.products.import.statFailedImages}
                  value={summary.failedImages}
                  tone="danger"
                  locale={locale}
                />
              )}
            </div>

            {summary.errors.length > 0 && (
              <div className="rounded-lg border">
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between p-2.5 text-sm font-medium"
                  onClick={() => setShowErrors((value) => !value)}
                >
                  <span>
                    {formatMessage(t.products.import.errorDetails, {
                      count: summary.errors.length.toLocaleString(locale),
                    })}
                  </span>
                  {showErrors ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </button>
                {showErrors && (
                  <div className="max-h-48 space-y-1 overflow-y-auto border-t p-2.5">
                    {summary.errors.map((error, index) => (
                      <p key={index} className="text-xs text-muted-foreground">
                        {formatMessage(t.products.import.rowLabel, {
                          row: error.row.toLocaleString(locale),
                        })}
                        {error.name ? ` — ${error.name}` : ""}: {error.reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 cursor-pointer"
                onClick={reset}
              >
                {t.products.import.importAnotherFile}
              </Button>
              <Button
                className="flex-1 cursor-pointer"
                onClick={() => handleOpenChange(false)}
              >
                {t.products.import.close}
              </Button>
            </div>
          </div>
        )}

        {stage === "result" && !summary && fatalError && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <XCircle className="size-12 text-destructive" />
              <DialogTitle className="text-lg">{t.products.import.importFailedTitle}</DialogTitle>
              <p className="text-sm text-muted-foreground">{fatalError}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 cursor-pointer"
                onClick={reset}
              >
                {t.products.import.tryAgain}
              </Button>
              <Button
                className="flex-1 cursor-pointer"
                onClick={() => handleOpenChange(false)}
              >
                {t.products.import.close}
              </Button>
            </div>
          </div>
        )}

        {stage !== "result" && (
          <div className="space-y-4">
            <fieldset disabled={isImporting} className="contents space-y-2">
              <Label htmlFor="import-file">{t.products.import.fileLabel}</Label>
              <Input
                key={inputKey}
                id="import-file"
                type="file"
                accept=".xlsx"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </fieldset>

            {isImporting && progress && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                {progress.currentName && (
                  <p className="truncate text-muted-foreground">
                    {t.products.import.currentProduct}{" "}
                    <span className="font-medium text-foreground">
                      {progress.currentName}
                    </span>
                  </p>
                )}
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {t.products.import.processingLabel} {progress.processed.toLocaleString(locale)} /{" "}
                    {progress.total.toLocaleString(locale)}
                  </span>
                  <span>
                    {t.products.import.savedLabel} {progress.imported.toLocaleString(locale)} /{" "}
                    {progress.total.toLocaleString(locale)}
                  </span>
                </div>
              </div>
            )}

            <Button
              className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-2"
              disabled={!file || isImporting}
              onClick={handleImport}
            >
              {isImporting && <Loader2 className="size-4 animate-spin" />}
              {isImporting ? t.products.import.importing : t.products.import.startImport}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
