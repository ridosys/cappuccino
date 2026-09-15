"use client";

import { useState } from "react";
import { FileText, Image as ImageIcon, File as FileIcon, Paperclip, X, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";
import { toCloudinaryDownloadUrl } from "@/lib/cloudinary-url";

export type UploadedAttachment = {
  publicId: string;
  secureUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  resourceType: "image" | "raw";
};

type SignResponse = {
  timestamp: number;
  signature: string;
  folder: string;
  apiKey: string;
  cloudName: string;
};

const MAX_FILE_SIZE_MB = 10;
const ACCEPT = "application/pdf,image/*,.doc,.docx,.xls,.xlsx";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ fileType }: { fileType: string }) {
  if (fileType.startsWith("image/")) return <ImageIcon className="size-5 shrink-0 text-muted-foreground" />;
  if (fileType === "application/pdf") return <FileText className="size-5 shrink-0 text-muted-foreground" />;
  return <FileIcon className="size-5 shrink-0 text-muted-foreground" />;
}

/** Generic multi-file uploader (PDF/image/office docs) backed by Cloudinary,
 * displayed as a file list rather than an image grid — unlike
 * CloudinaryUploader this doesn't assume every file is previewable as an
 * image, so a PDF or spreadsheet gets a type icon and its original file
 * name/size instead of a thumbnail. `signEndpoint` decides the folder and
 * the permission required to upload — the server, not this component,
 * decides both. */
export function FileAttachmentUploader({
  value,
  onChange,
  signEndpoint,
  maxFiles = 10,
  disabled = false,
}: {
  value: UploadedAttachment[];
  onChange: (files: UploadedAttachment[]) => void;
  signEndpoint: string;
  maxFiles?: number;
  disabled?: boolean;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const t = useT();

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const remainingSlots = maxFiles - value.length;
    if (remainingSlots <= 0) {
      toast.error(formatMessage(t.purchases.maxAttachmentsTemplate, { max: maxFiles }));
      return;
    }
    const files = Array.from(fileList).slice(0, remainingSlots);
    const oversized = files.find((file) => file.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized) {
      toast.error(formatMessage(t.purchases.fileTooLargeTemplate, { max: MAX_FILE_SIZE_MB }));
      return;
    }

    setIsUploading(true);
    try {
      const signRes = await fetch(signEndpoint, { method: "POST" });
      if (!signRes.ok) throw new Error(t.common.uploadPermissionError);
      const { timestamp, signature, folder, apiKey, cloudName } =
        (await signRes.json()) as SignResponse;

      const uploaded: UploadedAttachment[] = [];
      for (const file of files) {
        // Cloudinary's "auto" endpoint classifies PDFs as resource type
        // "image" — and Cloudinary blocks direct delivery of PDFs uploaded
        // that way as a security default (a PDF served under the image
        // delivery path was historically exploitable). Uploading non-image
        // files as "raw" instead avoids that block; only real images go
        // through the "image" endpoint, matching how they're destroyed
        // later too (see deletePurchaseAttachment).
        const resourceType: "image" | "raw" = file.type.startsWith("image/")
          ? "image"
          : "raw";
        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", apiKey);
        formData.append("timestamp", String(timestamp));
        formData.append("signature", signature);
        formData.append("folder", folder);

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
          { method: "POST", body: formData },
        );
        if (!uploadRes.ok) throw new Error(t.purchases.fileUploadFailedError);
        const data = await uploadRes.json();
        uploaded.push({
          publicId: data.public_id,
          secureUrl: data.secure_url,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          resourceType,
        });
      }

      onChange([...value, ...uploaded]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t.purchases.fileUploadGenericError,
      );
    } finally {
      setIsUploading(false);
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((file, index) => (
            <li
              key={file.publicId}
              className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
            >
              <a
                href={file.secureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
              >
                <FileTypeIcon fileType={file.fileType} />
                <span className="min-w-0 flex-1 truncate text-sm">{file.fileName}</span>
                <span dir="ltr" className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(file.fileSize)}
                </span>
              </a>
              <a
                href={toCloudinaryDownloadUrl(file.secureUrl)}
                aria-label={t.purchases.downloadAttachmentLabel}
                className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Download className="size-4" />
              </a>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeAt(index)}
                className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length < maxFiles && (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/50 has-disabled:pointer-events-none has-disabled:opacity-50">
          {isUploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Paperclip className="size-4" />
          )}
          <span>{t.purchases.addAttachmentsButton}</span>
          <input
            type="file"
            accept={ACCEPT}
            multiple
            disabled={disabled || isUploading}
            className="hidden"
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
