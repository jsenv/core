import { snapshotTests } from "@jsenv/snapshot";
import { measureTextWidth } from "@jsenv/terminal-text-size";
import stringWidth from "string-width";

// Render a comparison table as a plain string — no external dep required.
const renderComparisonTable = (sections) => {
  const rows = [
    ["input", "codepoints", "string-width", "measureTextWidth", "match"],
  ];
  for (const { label, inputs } of sections) {
    rows.push([`--- ${label} ---`, "", "", "", ""]);
    for (const input of inputs) {
      const sw = stringWidth(input);
      const mw = measureTextWidth(input);
      const cpFull = [...input]
        .map(
          (c) =>
            `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`,
        )
        .join(" ");
      const codepoints =
        cpFull.length > 40 ? cpFull.slice(0, 37) + "…" : cpFull;
      rows.push([
        JSON.stringify(input),
        codepoints,
        String(sw),
        String(mw),
        sw === mw ? "✓" : "✗ DIFF",
      ]);
    }
  }

  const colWidths = rows[0].map((_, colIndex) =>
    Math.max(...rows.map((row) => row[colIndex].length)),
  );
  const sep = "+" + colWidths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const formatRow = (row) =>
    "|" +
    row.map((cell, i) => ` ${cell.padEnd(colWidths[i])} `).join("|") +
    "|";

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
const main = [
  "⛣",
  "abcde",
  "古池や",
  "あいうabc",
  "あいう★",
  "あいう★",
  "±",
  '"ノード.js"',
  "你好",
  "안녕하세요",
  "A\uD83C\uDE00BC",
  "\u001B[31m\u001B[39m",
  "\u001B[31m\u001B[39m",
  "\u001B]8;;https://github.com\u0007Click\u001B]8;;\u0007",
  "\u{231A}",
  "\u{2194}\u{FE0F}",
  "\u{1F469}",
  "\u{1F469}\u{1F3FF}",
  "\u{845B}\u{E0100}",
  "ปฏัก",
  "_\u0E34",
  "“",
  "✔",
];
const measureAll = (inputs) => {
  const results = {};
  for (const input of inputs) {
    results[input] = measure(input);
  }
  return results;
};
const controlChars = [
  String.fromCodePoint(0),
  String.fromCodePoint(31),
  String.fromCodePoint(127),
  String.fromCodePoint(134),
  String.fromCodePoint(159),
  "\u001B",
];

const combining = [
  "x\u0300",
  "\u0300\u0301",
  "e\u0301e",
  "x\u036F",
  "\u036F\u036F",
];

const ZWJ = ["👶", "👶🏽", "👩‍👩‍👦‍👦", "👨‍❤️‍💋‍👨"];

const zeroWidths = [
  "\u200B",
  "x\u200Bx",
  "\u200C",
  "x\u200Cx",
  "\u200D",
  "x\u200Dx",
  "\uFEFF",
  "x\uFEFFx",
];

const variationSelectors = [
  "\u{1F1E6}\uFE0F", // Regional indicator symbol A with variation selector
  "A\uFE0F",
  "\uFE0F",
];

const edgeCases = [
  "",
  "\u200B\u200B",
  "x\u200Bx\u200B",
  "x\u0300x\u0300",
  "\uD83D\uDE00\uFE0F",
  "\uD83D\uDC69\u200D\uD83C\uDF93",
  "x\u1AB0x\u1AB0",
  "x\u1DC0x\u1DC0",
  "x\u20D0x\u20D0",
  "x\uFE20x\uFE20",
];

const defaultIgnorableCodePoints = [
  "\u2060",
  "\u2061",
  "\u2062",
  "\u2063",
  "\u2064",
  "\uFEFF",
  "x\u2060x",
  "x\u2061x",
  "x\u2062x",
  "x\u2063x",
  "x\u2064x",
];

await snapshotTests(import.meta.url, ({ test }) => {
  test("comparison", () => {
    return renderComparisonTable(sections);
  });
});
