"use client";

import { useEffect, useRef, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";

export function InvoicePdfButton({
  targetId,
  fileName,
  label,
  autoOpen = false,
}: {
  targetId: string;
  fileName: string;
  label: string;
  /** When true, generate the PDF once shortly after mount — used when the
   * page is opened with `?auto=pdf` (from the La Caisse success dialog). */
  autoOpen?: boolean;
}) {
  const t = useT();
  const [isGenerating, setIsGenerating] = useState(false);
  const autoFired = useRef(false);

  async function handleClick() {
    const target = document.getElementById(targetId);
    if (!target) return;

    setIsGenerating(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a5",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;

      const canvasRatio = canvas.width / canvas.height;
      let imgWidth = maxWidth;
      let imgHeight = imgWidth / canvasRatio;
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = imgHeight * canvasRatio;
      }

      const x = (pageWidth - imgWidth) / 2;
      const y = margin;
      pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);
      pdf.setProperties({ title: fileName });

      const blobUrl = pdf.output("bloburl");
      window.open(blobUrl, "_blank");
    } catch (error) {
      console.error(error);
      toast.error(t.common.pdfError);
    } finally {
      setIsGenerating(false);
    }
  }

  useEffect(() => {
    if (!autoOpen || autoFired.current) return;
    autoFired.current = true;
    const id = setTimeout(() => {
      void handleClick();
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={isGenerating}
      className="cursor-pointer"
    >
      {isGenerating ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <FileDown className="size-4" />
      )}
      {label}
    </Button>
  );
}
