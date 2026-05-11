import { snapshotTests } from "@jsenv/snapshot";
import { measureTextWidth } from "@jsenv/terminal-text-size";
import stringWidth from "string-width";

const MAX_INPUT_DISPLAY = 50;

// Render a comparison table as a plain string — no external dep required.
const renderComparisonTable = (sections) => {
  const rows = [["measureTextWidth", "string-width", "diff", "input"]];
  for (const { label, inputs } of sections) {
    rows.push(["", "", "", `--- ${label} ---`]);
    for (const input of inputs) {
      const sw = stringWidth(input);
      const mw = measureTextWidth(input);
      const rawInput = JSON.stringify(input);
      const displayInput =
        rawInput.length > MAX_INPUT_DISPLAY
          ? `${rawInput.slice(0, MAX_INPUT_DISPLAY - 1)}…"`
          : rawInput;
      rows.push([
        String(mw),
        String(sw),
        sw === mw ? "" : "DIFF",
        displayInput,
      ]);
    }
  }

  // Input column is last so no right-padding needed — its width is unconstrained.
  // All other columns use measureTextWidth for correct wide-char alignment.
  const inputColIndex = 3;
  const colWidths = rows[0].map((_, colIndex) => {
    if (colIndex === inputColIndex) {
      return 0; // no fixed width for last column
    }
    return Math.max(...rows.map((row) => measureTextWidth(row[colIndex])));
  });
  const sep = `+${colWidths
    .slice(0, inputColIndex)
    .map((w) => "-".repeat(w + 2))
    .join("+")}+`;
  const formatRow = (row) => {
    const cells = row.slice(0, inputColIndex).map((cell, i) => {
      const pad = colWidths[i] - measureTextWidth(cell);
      return ` ${cell}${" ".repeat(pad)} `;
    });
    return `|${cells.join("|")}| ${row[inputColIndex]}`;
  };

  const lines = [sep, formatRow(rows[0]), sep];
  for (const row of rows.slice(1)) {
    lines.push(formatRow(row));
  }
  lines.push(sep);
  return lines.join("\n");
};

const sections = [
  {
    label: "main",
    inputs: [
      "⛣",
      "abcde",
      "古池や",
      "あいうabc",
      "あいう★",
      "±",
      '"ノード.js"',
      "你好",
      "안녕하세요",
      "A\uD83C\uDE00BC",
      "\u001B[31m\u001B[39m",
      "\u001B]8;;https://github.com\u0007Click\u001B]8;;\u0007",
      "\u{231A}",
      "\u{2194}\u{FE0F}",
      "\u{1F469}",
      "\u{1F469}\u{1F3FF}",
      "\u{845B}\u{E0100}",
      "ปฏัก",
      "_\u0E34",
      "\u201C",
      "✔",
      "+<X>s",
    ],
  },
  {
    label: "typographic punctuation",
    inputs: [
      "\u2019", // ' RIGHT SINGLE QUOTATION MARK — appears in French "d'une"
      "\u2018", // ' LEFT SINGLE QUOTATION MARK
      "\u201C", // " LEFT DOUBLE QUOTATION MARK
      "\u201D", // " RIGHT DOUBLE QUOTATION MARK
      "\u2013", // – EN DASH
      "\u2014", // — EM DASH
      "\u00AB", // « LEFT GUILLEMET
      "\u00BB", // » RIGHT GUILLEMET
      "\u2026", // … HORIZONTAL ELLIPSIS
      "dans moins d\u2019une minute",
      "\u00AB\u00A0Bonjour\u00A0\u00BB",
    ],
  },
  {
    label: "angle brackets and math",
    inputs: [
      "<",
      ">",
      "<=",
      ">=",
      "\u2264", // ≤
      "\u2265", // ≥
      "\u2039", // ‹
      "\u203A", // ›
      "\uFF1C", // ＜ FULLWIDTH
      "\uFF1E", // ＞ FULLWIDTH
    ],
  },
  {
    label: "special spaces",
    inputs: [
      "\u00A0", // NO-BREAK SPACE
      "\u202F", // NARROW NO-BREAK SPACE
      "\u2009", // THIN SPACE
      "\u3000", // IDEOGRAPHIC SPACE
    ],
  },
  {
    label: "control chars",
    inputs: [
      String.fromCodePoint(0),
      String.fromCodePoint(31),
      String.fromCodePoint(127),
      String.fromCodePoint(134),
      String.fromCodePoint(159),
      "\u001B",
    ],
  },
  {
    label: "combining",
    inputs: ["x\u0300", "\u0300\u0301", "e\u0301e", "x\u036F", "\u036F\u036F"],
  },
  {
    label: "ZWJ sequences",
    inputs: ["👶", "👶🏽", "👩‍👩‍👦‍👦", "👨‍❤️‍💋‍👨"],
  },
  {
    label: "zero-width",
    inputs: [
      "\u200B",
      "x\u200Bx",
      "\u200C",
      "x\u200Cx",
      "\u200D",
      "x\u200Dx",
      "\uFEFF",
      "x\uFEFFx",
    ],
  },
  {
    label: "emojis",
    inputs: ["✔️", "✅"],
  },
];

await snapshotTests(import.meta.url, ({ test }) => {
  test("comparison", () => {
    return renderComparisonTable(sections);
  });
});
