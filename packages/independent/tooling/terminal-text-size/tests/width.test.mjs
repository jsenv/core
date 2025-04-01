import { snapshotTests } from "@jsenv/snapshot";
import { measureTextWidth } from "@jsenv/terminal-text-size";
import stringWidth from "string-width";

const run = (measure) => {
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

  const emojis = ["✔️", "✅"];

  return {
    main: measureAll(main),
    controlChars: measureAll(controlChars),
    combining: measureAll(combining),
    ZWJ: measureAll(ZWJ),
    zeroWidths: measureAll(zeroWidths),
    variationSelectors: measureAll(variationSelectors),
    edgeCases: measureAll(edgeCases),
    defaultIgnorableCodePoints: measureAll(defaultIgnorableCodePoints),
    emojis: measureAll(emojis),
  };
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_string_width", () => run(stringWidth));

  test("1_terminal_size", () => run(measureTextWidth));
});
