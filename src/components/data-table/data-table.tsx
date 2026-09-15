"use client";

import { useState } from "react";
import {
  type ColumnDef,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkDeleteBar } from "@/components/data-table/bulk-delete-bar";
import { useLocale } from "@/i18n/locale-provider";

type DeleteResult = { error?: string } | void;

export function DataTable<TData extends { id: string }, TValue>({
  columns,
  data,
  onDeleteSelected,
  requireDeletePassword = false,
  bulkDeleteDescription,
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onDeleteSelected?: (
    ids: string[],
    password?: string,
  ) => Promise<DeleteResult>;
  requireDeletePassword?: boolean;
  bulkDeleteDescription?: string;
}) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const selectable = Boolean(onDeleteSelected);
  const { t } = useLocale();

  const selectionColumn: ColumnDef<TData, TValue> = {
    id: "__select__",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={
          !table.getIsAllPageRowsSelected() && table.getIsSomePageRowsSelected()
        }
        onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
        aria-label={t.common.selectAll}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(checked)}
        aria-label={t.common.selectRow}
        onClick={(event) => event.stopPropagation()}
      />
    ),
  };

  const table = useReactTable({
    data,
    columns: selectable ? [selectionColumn, ...columns] : columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: selectable,
  });

  const selectedIds = Object.keys(rowSelection).filter(
    (id) => rowSelection[id],
  );

  return (
    <div className="space-y-3">
      {selectable && selectedIds.length > 0 && (
        <BulkDeleteBar
          count={selectedIds.length}
          onClearSelection={() => setRowSelection({})}
          requirePassword={requireDeletePassword}
          description={bulkDeleteDescription}
          onConfirm={async (password) => {
            const result = await onDeleteSelected!(selectedIds, password);
            if (!result?.error) setRowSelection({});
            return result;
          }}
        />
      )}
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="h-32 text-center text-muted-foreground"
                >
                  {t.common.noResults}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
