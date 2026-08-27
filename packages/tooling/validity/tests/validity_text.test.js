import { humanize } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import { createValidity } from "../src/validity.js";

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value, border: BORDER });

const renderCases = (ruleConfig, ruleName, cases) => {
  const [validity, applyOn] = createValidity(ruleConfig);
  const rows = cases.map((value) => {
    applyOn(value);
    return [
      cell(humanize(value)),
      cell(humanize(validity.valid)),
      cell(humanize(validity.representations.valid?.value)),
      cell(humanize(validity[ruleName])),
    ];
  });
  return renderTable(
    [
      [
        cell("input"),
        cell(".valid"),
        cell(".representations.valid.value"),
        cell(`.${ruleName}`),
      ],
      ...rows,
    ],
    { borderCollapse: true },
  );
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("maxLength", () => {
    return renderCases({ type: "string", maxLength: 5 }, "maxLength", [
      "",
      "abcde",
      "abcdef",
      undefined,
    ]);
  });

  test("minLength", () => {
    return renderCases({ type: "string", minLength: 3 }, "minLength", [
      "",
      "ab",
      "abc",
    ]);
  });

  test("charClass preset", () => {
    return renderCases({ type: "string", charClass: "slug" }, "charClass", [
      "hello-world",
      "Hello World",
      "",
    ]);
  });

  test("charClass custom", () => {
    return renderCases(
      { type: "string", charClass: "[\\p{L} ]" },
      "charClass",
      ["Émile Zola", "Émile Zola 3"],
    );
  });

  test("displayable", () => {
    return renderCases({ type: "string", displayable: true }, "displayable", [
      "hello",
      // a decomposed Vietnamese letter carries two marks — legitimate
      "Tí́nh",
      // seven marks on one base character — zalgo
      "é̀̂̃̄̆̇",
      // two of them in one value — the message counts them and shows one
      "á̀̂̃̄̆̇ b́̀̂̃̄̆̇",
      // a value made only of things that draw nothing
      "​ ­",
      "line\n\n\nline",
      // a joiner at the end joins nothing
      "hello‍",
      // the same joiner between two characters is doing its job
      "\u{1F468}‍\u{1F469}‍\u{1F467}",
      "",
    ]);
  });

  test("displayable with maxStackedMarks", () => {
    return renderCases(
      { type: "string", displayable: true, maxStackedMarks: 2 },
      "displayable",
      ["é̀", "é̀̂"],
    );
  });

  test("singleSpace", () => {
    return renderCases({ type: "string", singleSpace: true }, "singleSpace", [
      "one two",
      " one",
      "one ",
      "one  two",
      "  one  two  ",
    ]);
  });

  test("noEmoji", () => {
    return renderCases({ type: "string", noEmoji: true }, "noEmoji", [
      "Jean Dupont",
      "Jean \u{1F44D}",
      // a flag is a pair of regional indicators, no pictographic character
      "\u{1F1EB}\u{1F1F7}",
      // text presentation stays text
      "©",
      // the same character asking for emoji presentation does not
      "©️",
    ]);
  });

  test("maxLineBreaks", () => {
    return renderCases({ type: "string", maxLineBreaks: 2 }, "maxLineBreaks", [
      "one line",
      "a\nb\nc",
      "a\nb\nc\nd",
      "a\r\nb\r\nc\r\nd",
    ]);
  });

  test("several text rules at once", () => {
    const [validity, applyOn] = createValidity({
      type: "string",
      maxLength: 20,
      singleSpace: true,
      displayable: true,
    });
    const cases = ["hello", "  hello  ", "x".repeat(30)];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(humanize(validity.valid)),
        cell(humanize(validity.representations.valid?.value)),
        cell(humanize(validity.maxLength)),
        cell(humanize(validity.singleSpace)),
      ];
    });
    return renderTable(
      [
        [
          cell("input"),
          cell(".valid"),
          cell(".representations.valid.value"),
          cell(".maxLength"),
          cell(".singleSpace"),
        ],
        ...rows,
      ],
      { borderCollapse: true },
    );
  });

  test("rule config is checked", () => {
    const attempts = [
      { maxLength: -1 },
      { maxLength: 1.5 },
      { minLength: 5, maxLength: 2 },
      { charClass: 42 },
      { maxLineBreaks: "3" },
    ];
    const rows = attempts.map((ruleConfig) => {
      let thrown;
      try {
        createValidity({ type: "string", ...ruleConfig });
      } catch (e) {
        thrown = e.message;
      }
      return [cell(humanize(ruleConfig)), cell(humanize(thrown))];
    });
    return renderTable([[cell("ruleConfig"), cell("throws")], ...rows], {
      borderCollapse: true,
    });
  });
});
