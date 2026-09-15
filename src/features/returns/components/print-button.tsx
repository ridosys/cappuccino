"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
export function ReturnPrintButton() { const t = useT(); return <Button variant="outline" onClick={() => window.print()} className="print:hidden"><Printer className="size-4" />{t.returns.printReceipt}</Button>; }
