import "server-only";
import ExcelJS from "exceljs";

export function buildCsv(headers: string[], rows: (string | number)[][]) {
  const escapeCell = (value: string | number) => {
    const str = String(value ?? "");
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeCell(cell)).join(","),
  );
  return "﻿" + lines.join("\n");
}

export async function buildXlsx(
  sheetName: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: true }],
  });
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 22;
  });

  return workbook.xlsx.writeBuffer();
}
