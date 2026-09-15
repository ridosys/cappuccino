"use client";

import { useState } from "react";
import Image from "next/image";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

export type UploadedImage = { publicId: string; secureUrl: string };

type SignResponse = {
  timestamp: number;
  signature: string;
  folder: string;
  apiKey: string;
  cloudName: string;
};

export function CloudinaryUploader({
  value,
  onChange,
  maxImages = 8,
}: {
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxImages?: number;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const t = useT();

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const remainingSlots = maxImages - value.length;
    if (remainingSlots <= 0) {
      toast.error(
        formatMessage(t.common.maxImagesTemplate, { max: maxImages }),
      );
      return;
    }
    const files = Array.from(fileList).slice(0, remainingSlots);

    setIsUploading(true);
    try {
      const signRes = await fetch("/api/cloudinary/sign", { method: "POST" });
      if (!signRes.ok) throw new Error(t.common.uploadPermissionError);
      const { timestamp, signature, folder, apiKey, cloudName } =
        (await signRes.json()) as SignResponse;

      const uploaded: UploadedImage[] = [];
      for (const file of files) {
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
        uploaded.push({ publicId: data.public_id, secureUrl: data.secure_url });
      }

      onChange([...value, ...uploaded]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t.common.imageUploadGenericError,
      );
    } finally {
      setIsUploading(false);
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {value.map((image, index) => (
        <div
          key={image.publicId}
          className="group relative aspect-square overflow-hidden rounded-lg border"
        >
          <Image
            src={image.secureUrl}
            alt=""
            fill
            className="object-cover"
            sizes="120px"
          />
          <button
            type="button"
            onClick={() => removeAt(index)}
            className="absolute top-1 inset-e-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
      {value.length < maxImages && (
        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground hover:bg-muted/50">
          {isUploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ImagePlus className="size-5" />
          )}
          <span className="text-xs">{t.common.addImages}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={isUploading}
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
