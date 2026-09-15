"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, X } from "lucide-react";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

export type CustomerPhoto = { publicId: string; secureUrl: string };

type SignResponse = {
  timestamp: number;
  signature: string;
  folder: string;
  apiKey: string;
  cloudName: string;
};

const MAX_PHOTO_MB = 4;
const ACCEPT = ".png,.jpg,.jpeg,.webp";

export function CustomerImageUploader({
  value,
  onChange,
  name,
  disabled,
}: {
  value: CustomerPhoto | null;
  onChange: (photo: CustomerPhoto | null) => void;
  /** Current name typed in the form, used for the fallback initial. */
  name: string;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const tp = t.customers.photo;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const shown = preview ?? value?.secureUrl ?? null;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      toast.error(formatMessage(tp.errorTooLarge, { max: MAX_PHOTO_MB }));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setIsUploading(true);
    try {
      const signRes = await fetch("/api/cloudinary/sign-customer-photo", {
        method: "POST",
      });
      if (!signRes.ok) throw new Error(t.common.uploadPermissionError);
      const { timestamp, signature, folder, apiKey, cloudName } =
        (await signRes.json()) as SignResponse;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", apiKey);
      formData.append("timestamp", String(timestamp));
      formData.append("signature", signature);
      formData.append("folder", folder);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: formData },
      );
      if (!uploadRes.ok) throw new Error(t.common.imageUploadFailedError);
      const data = await uploadRes.json();
      onChange({ publicId: data.public_id, secureUrl: data.secure_url });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t.common.imageUploadGenericError,
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
      setPreview(null);
      setIsUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <CustomerAvatar
          name={name || "?"}
          imageUrl={shown}
          seed={value?.publicId ?? name}
          className="size-20 text-2xl ring-2 ring-border"
        />
        {isUploading && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <Loader2 className="size-5 animate-spin text-white" />
          </span>
        )}
        <button
          type="button"
          disabled={disabled || isUploading}
          onClick={() => inputRef.current?.click()}
          title={value ? tp.replaceButton : tp.uploadButton}
          className="absolute -bottom-0.5 -end-0.5 flex size-7 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 disabled:pointer-events-none disabled:opacity-60"
        >
          <Camera className="size-3.5" />
        </button>
        {value && !isUploading && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            title={tp.removeButton}
            className="absolute -top-0.5 -end-0.5 flex size-5 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-destructive text-white shadow-sm disabled:pointer-events-none disabled:opacity-60"
          >
            <X className="size-3" />
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{tp.title}</p>
        <p className="text-xs text-muted-foreground">
          {formatMessage(tp.hint, { max: MAX_PHOTO_MB })}
        </p>
      </div>
    </div>
  );
}
