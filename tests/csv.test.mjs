// CSV export escaping (src/lib/csv.ts).
import assert from "node:assert/strict";
import { test } from "node:test";

import { csvCell, toCsv } from "../src/lib/csv.ts";

test("quotes cells and doubles inner quotes", () => {
  assert.equal(csvCell("Ana"), '"Ana"');
  assert.equal(csvCell('Say "hi", ok'), '"Say ""hi"", ok"');
  assert.equal(csvCell("line 1\nline 2"), '"line 1\nline 2"');
  assert.equal(csvCell(42), '"42"');
  assert.equal(csvCell(null), '""');
});

test("neutralises spreadsheet formulas", () => {
  for (const evil of ['=HYPERLINK("x")', "+1+1", "-2+3", "@SUM(A1)", "\t=1", "\r=1"]) {
    assert.ok(csvCell(evil).startsWith(`"'`), evil);
  }
  assert.equal(csvCell("a=b"), '"a=b"');
});

test("whole file: BOM, header, CRLF", () => {
  const out = toCsv(["name", "email"], [["Ana", "a@x.example"]]);
  assert.equal(out, '﻿"name","email"\r\n"Ana","a@x.example"\r\n');
});
