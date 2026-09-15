"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvoicePrintButton({ label }: { label: string }) {
  return (
    <Button onClick={() => window.print()} className={"cursor-pointer"}>
      <Printer className="size-4" />
      {label}
    </Button>
  );
}
