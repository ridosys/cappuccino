"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, File as FileIcon, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import {
  FileAttachmentUploader,
  type UploadedAttachment,
} from "@/components/shared/file-attachment-uploader";
import { addPurchaseAttachment, deletePurchaseAttachment } from "@/features/purchases/actions";
import { formatDateTime } from "@/lib/date";
import { toCloudinaryDownloadUrl } from "@/lib/cloudinary-url";
import { useLocale } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/format";

type AttachmentRow = {
  id: string;
  secureUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
  uploadedByName: string | null;
};

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

/** Purchase order attachments (supplier invoice scans, delivery notes,
 * contracts, ...): a plain flat list, unlike ProductImage's ordered grid,
 * since these aren't previewable-in-place the same way. Adding a file
 * uploads it to Cloudinary client-side then immediately attaches it via a
 * server action (the order already exists here, unlike the create form
 * where attachments ride along as a nested write) — each add/remove
 * revalidates this page so the list reflects the DB right away. */
export function PurchaseAttachmentsCard({
  purchaseOrderId,
  attachments,
}: {
  purchaseOrderId: string;
  attachments: AttachmentRow[];
}) {
  const { t } = useLocale();
  const [isPending, startTransition] = useTransition();

  function handleUpload(files: UploadedAttachment[]) {
    // FileAttachmentUploader is a controlled value/onChange component built
    // for a form field — here there's no persistent local list to control,
    // so `value` is always [] and onChange's payload is just the newly
    // selected files (one call per file-picker use, but that can still be
    // several files at once since the input allows multi-select), each
    // attached individually server-side.
    if (files.length === 0) return;
    startTransition(async () => {
      const results = await Promise.all(
        files.map((file) => addPurchaseAttachment(purchaseOrderId, file)),
      );
      const failed = results.filter((result) => result?.error);
      if (failed.length > 0) toast.error(failed[0].error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.purchases.attachmentsLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.purchases.noAttachmentsText}</p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                <a
                  href={file.secureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 flex-col gap-0.5 hover:underline"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FileTypeIcon fileType={file.fileType} />
                    <span className="min-w-0 flex-1 truncate text-sm">{file.fileName}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <span dir="ltr">{formatFileSize(file.fileSize)}</span> · {file.uploadedByName ?? t.common.unknownEmployee} · {formatDateTime(file.createdAt)}
                  </span>
                </a>
                <a
                  href={toCloudinaryDownloadUrl(file.secureUrl)}
                  aria-label={t.purchases.downloadAttachmentLabel}
                  className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Download className="size-4" />
                </a>
                <ConfirmDeleteDialog
                  action={() => deletePurchaseAttachment(file.id)}
                  description={formatMessage(t.purchases.attachmentDeleteDescriptionTemplate, {
                    name: file.fileName,
                  })}
                />
              </li>
            ))}
          </ul>
        )}
        <FileAttachmentUploader
          value={[]}
          onChange={handleUpload}
          signEndpoint="/api/cloudinary/sign-purchase-attachment"
          disabled={isPending}
        />
      </CardContent>
    </Card>
  );
}
