"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";
import {
  removeCompanyLogo,
  updateCompanyLogo,
} from "@/features/settings/actions";

// Kept in sync with src/features/settings/logo.ts — the server is the
// authority, this is only a fast-fail before the upload round-trip.
const MAX_LOGO_MB = 4;
const ACCEPT = ".png,.jpg,.jpeg,.webp,.svg";

export function CompanyLogoForm({ logoUrl }: { logoUrl: string | null }) {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const tl = t.settings.logo;

  const shown = preview ?? logoUrl;

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_LOGO_MB * 1024 * 1024) {
      toast.error(formatMessage(tl.errorTooLarge, { max: MAX_LOGO_MB }));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await updateCompanyLogo(formData);
      URL.revokeObjectURL(objectUrl);
      setPreview(null);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(tl.toastUpdated);
      router.refresh();
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeCompanyLogo();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(tl.toastRemoved);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">{tl.title}</h3>
        <p className="text-xs text-muted-foreground">{tl.description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded / object URL preview, may be SVG
            <img
              src={shown}
              alt={tl.previewLabel}
              className="size-full object-contain p-1.5"
            />
          ) : (
            <span className="px-2 text-center text-[11px] text-muted-foreground">
              {tl.noLogoLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {logoUrl ? tl.replaceButton : tl.uploadButton}
          </Button>
          {logoUrl && (
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer text-destructive hover:text-destructive"
              disabled={isPending}
              onClick={handleRemove}
            >
              <Trash2 className="size-4" />
              {tl.removeButton}
            </Button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {formatMessage(tl.hint, { max: MAX_LOGO_MB })}
      </p>
    </div>
  );
}
