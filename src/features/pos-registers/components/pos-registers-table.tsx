"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { deletePosRegister } from "@/features/pos-registers/actions";
import type { PosRegisterRow } from "@/features/pos-registers/queries";
import { formatMessage } from "@/i18n/format";
import { useLocale } from "@/i18n/locale-provider";

export function PosRegistersTable({ data }: { data: PosRegisterRow[] }) {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-2 text-start font-medium">{t.posRegisters.columnName}</th>
            <th className="p-2 text-start font-medium">{t.posRegisters.columnCustomer}</th>
            <th className="p-2 text-start font-medium">{t.posRegisters.columnCategories}</th>
            <th className="p-2 text-start font-medium">{t.posRegisters.columnUsers}</th>
            <th className="p-2 text-start font-medium">{t.posRegisters.columnStatus}</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {data.map((register) => (
            <tr key={register.id} className="border-t">
              <td className="p-2 font-medium">{register.name}</td>
              <td className="p-2">{register.customer.name}</td>
              <td className="p-2">
                {register.categories.length === 0
                  ? t.posRegisters.allCategories
                  : register.categories.map((c) => c.name).join("، ")}
              </td>
              <td className="p-2">
                {register.admins.length === 0
                  ? t.posRegisters.noUsers
                  : register.admins.map((a) => a.name).join("، ")}
              </td>
              <td className="p-2">
                <Badge variant={register.isActive ? "default" : "secondary"}>
                  {register.isActive ? t.posRegisters.active : t.posRegisters.inactive}
                </Badge>
              </td>
              <td className="p-2">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={<Link prefetch={false} href={`${pathname}?edit=${register.id}`} />}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <ConfirmDeleteDialog
                    action={() => deletePosRegister(register.id)}
                    description={formatMessage(t.posRegisters.deleteDescription, {
                      name: register.name,
                    })}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
