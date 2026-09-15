"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { deleteRole } from "@/features/roles/actions";
import { formatMessage } from "@/i18n/format";
import { useLocale } from "@/i18n/locale-provider";

export type RoleRow = {
  id: string;
  name: string;
  isSystem: boolean;
  isFullAccess: boolean;
  _count: { admins: number };
};

export function RolesTable({ data }: { data: RoleRow[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();

  function editHref(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.set("edit", id);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.roles.columnName}</TableHead>
          <TableHead>{t.roles.columnAccess}</TableHead>
          <TableHead>{t.roles.columnUsersCount}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((role) => (
          <TableRow key={role.id}>
            <TableCell className="font-medium">{role.name}</TableCell>
            <TableCell>
              {role.isFullAccess ? (
                <Badge>{t.roles.fullAccessBadge}</Badge>
              ) : (
                <Badge variant="secondary">{t.roles.customAccessBadge}</Badge>
              )}
            </TableCell>
            <TableCell>{role._count.admins.toLocaleString(locale)}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  nativeButton={false}
                  render={<Link href={editHref(role.id)} />}
                >
                  <Pencil className="size-4" />
                </Button>
                {!role.isSystem && (
                  <ConfirmDeleteDialog
                    action={() => deleteRole(role.id)}
                    description={formatMessage(t.roles.deleteDescription, {
                      name: role.name,
                    })}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={role._count.admins > 0}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
