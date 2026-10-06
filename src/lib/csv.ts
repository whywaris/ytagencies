// CSV for admin exports. Quotes every cell (RFC 4180) and neutralises spreadsheet formulas: a cell
// starting with = + - @ (or a tab/CR) is prefixed with ' so Excel and Sheets show it as text
// instead of running it (CSV injection). No imports, so tests load this file directly.

const FORMULA = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return '""';
  let s = String(value);
  if (FORMULA.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** A whole CSV file: header row, then rows. CRLF line endings, with a BOM so Excel reads UTF-8. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
