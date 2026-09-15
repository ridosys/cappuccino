"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { FileScan, Loader2, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";
import type { UploadedAttachment } from "@/components/shared/file-attachment-uploader";
import type {
  ScanResultPayload,
  ScanStreamEvent,
} from "@/features/purchases/scan-types";
import { ScanReview, type ScanProductOption } from "./scan-review";

type SupplierOption = { id: string; name: string };

type Phase =
  | { name: "idle" }
  | { name: "uploading" }
  | { name: "rendering_pdf"; page: number; pages: number }
  | { name: "scanning" }
  | { name: "matching" }
  | { name: "review"; payload: ScanResultPayload; attachment: UploadedAttachment | null }
  | { name: "error"; message: string };

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

export function ScanInvoiceWorkspace({
  suppliers,
  products,
  categories,
  brands,
  canManageSuppliers,
  canManageProducts,
}: {
  suppliers: SupplierOption[];
  products: ScanProductOption[];
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  canManageSuppliers: boolean;
  canManageProducts: boolean;
}) {
  const { t } = useLocale();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [inputKey, setInputKey] = useState(0);
  const runningRef = useRef(false);

  const errorMessage = useCallback(
    (code: string, fallback: string) => {
      const map: Record<string, string> = {
        unsupported_file: t.purchaseScan.errors.unsupportedFile,
        file_too_large: t.purchaseScan.errors.fileTooLarge,
        pdf_render_failed: t.purchaseScan.errors.pdfRenderFailed,
        deepseek_config: t.purchaseScan.errors.deepseekConfig,
        deepseek_failed: t.purchaseScan.errors.deepseekFailed,
        invalid_ai_json: t.purchaseScan.errors.invalidAiJson,
        no_items: t.purchaseScan.errors.noItems,
        internal: t.purchaseScan.errors.internal,
      };
      return map[code] ?? fallback;
    },
    [t],
  );

  const uploadOriginal = useCallback(
    async (file: File): Promise<UploadedAttachment | null> => {
      try {
        const signRes = await fetch("/api/cloudinary/sign-purchase-attachment", {
          method: "POST",
        });
        if (!signRes.ok) return null;
        const { timestamp, signature, folder, apiKey, cloudName } =
          await signRes.json();
        const resourceType: "image" | "raw" = file.type.startsWith("image/")
          ? "image"
          : "raw";
        const form = new FormData();
        form.append("file", file);
        form.append("api_key", apiKey);
        form.append("timestamp", String(timestamp));
        form.append("signature", signature);
        form.append("folder", folder);
        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
          { method: "POST", body: form },
        );
        if (!uploadRes.ok) return null;
        const data = await uploadRes.json();
        return {
          publicId: data.public_id,
          secureUrl: data.secure_url,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          resourceType,
        };
      } catch {
        return null;
      }
    },
    [],
  );

  const runScan = useCallback(
    async (file: File) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setPhase({ name: "uploading" });

      // Kick off the (non-blocking) archival upload of the original document.
      const attachmentPromise = uploadOriginal(file);

      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/purchases/scan", {
          method: "POST",
          body: formData,
        });
        if (!response.body) throw new Error(t.purchaseScan.errors.internal);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done: ScanResultPayload | null = null;
        let failed: string | null = null;

        const handle = (event: ScanStreamEvent) => {
          if (event.stage === "rendering_pdf") {
            setPhase({ name: "rendering_pdf", page: event.page, pages: event.pages });
          } else if (event.stage === "scanning") {
            setPhase({ name: "scanning" });
          } else if (event.stage === "matching") {
            setPhase({ name: "matching" });
          } else if (event.stage === "done") {
            done = event.payload;
          } else if (event.stage === "error") {
            failed = errorMessage(event.code, event.message);
          }
        };

        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            if (part.trim()) handle(JSON.parse(part) as ScanStreamEvent);
          }
        }
        if (buffer.trim()) handle(JSON.parse(buffer) as ScanStreamEvent);

        if (failed) {
          setPhase({ name: "error", message: failed });
          toast.error(failed);
          return;
        }
        if (!done) {
          setPhase({ name: "error", message: t.purchaseScan.errors.internal });
          return;
        }
        const attachment = await attachmentPromise;
        setPhase({ name: "review", payload: done, attachment });
      } catch {
        const message = t.purchaseScan.errors.internal;
        setPhase({ name: "error", message });
        toast.error(message);
      } finally {
        runningRef.current = false;
      }
    },
    [errorMessage, t, uploadOriginal],
  );

  function reset() {
    setPhase({ name: "idle" });
    setInputKey((k) => k + 1);
  }

  if (phase.name === "review") {
    return (
      <ScanReview
        payload={phase.payload}
        attachment={phase.attachment}
        suppliers={suppliers}
        products={products}
        categories={categories}
        brands={brands}
        canManageSuppliers={canManageSuppliers}
        canManageProducts={canManageProducts}
        onScanAnother={reset}
      />
    );
  }

  const busy =
    phase.name === "uploading" ||
    phase.name === "rendering_pdf" ||
    phase.name === "scanning" ||
    phase.name === "matching";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <label
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center hover:bg-muted/40 has-disabled:pointer-events-none has-disabled:opacity-60"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {busy ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <Upload className="size-6" />
          )}
        </span>
        <span className="text-sm font-medium">
          {busy ? t.purchaseScan.processing : t.purchaseScan.dropzoneTitle}
        </span>
        <span className="text-xs text-muted-foreground">
          {t.purchaseScan.dropzoneHint}
        </span>
        <input
          key={inputKey}
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void runScan(file);
          }}
        />
      </label>

      {busy && (
        <div className="space-y-1.5 rounded-lg border bg-muted/30 p-4 text-sm">
          <Step label={t.purchaseScan.stages.rendering} done={phase.name !== "uploading" && phase.name !== "rendering_pdf"} current={phase.name === "uploading" || phase.name === "rendering_pdf"} />
          {phase.name === "rendering_pdf" && (
            <p className="ps-6 text-xs text-muted-foreground">
              {formatMessage(t.purchaseScan.stages.renderingPage, {
                page: phase.page,
                pages: phase.pages,
              })}
            </p>
          )}
          <Step label={t.purchaseScan.stages.scanning} done={phase.name === "matching"} current={phase.name === "scanning"} />
          <Step label={t.purchaseScan.stages.matching} done={false} current={phase.name === "matching"} />
        </div>
      )}

      {phase.name === "error" && (
        <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{phase.message}</p>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="size-4" />
            {t.purchaseScan.retry}
          </Button>
        </div>
      )}

      {phase.name === "idle" && (
        <p className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <FileScan className="mt-0.5 size-4 shrink-0 text-primary" />
          {t.purchaseScan.disclaimer}
        </p>
      )}
    </div>
  );
}

function Step({
  label,
  done,
  current,
}: {
  label: string;
  done: boolean;
  current: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          done
            ? "flex size-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white"
            : current
              ? "flex size-4 items-center justify-center rounded-full border-2 border-primary"
              : "flex size-4 items-center justify-center rounded-full border-2 border-muted-foreground/30"
        }
      >
        {done ? "✓" : current ? <Loader2 className="size-2.5 animate-spin" /> : null}
      </span>
      <span className={current ? "font-medium" : done ? "text-muted-foreground" : "text-muted-foreground/60"}>
        {label}
      </span>
    </div>
  );
}
