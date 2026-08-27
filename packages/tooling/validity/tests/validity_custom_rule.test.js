import { humanize } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import { createValidity } from "../src/validity.js";

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value, border: BORDER });

const MAX_WORDS_RULE = {
  name: "maxWords",
  applyOn: (maxWords, value) => {
    if (maxWords === undefined || typeof value !== "string") {
      return null;
    }
    const words = value.trim().split(/\s+/);
    if (words.length <= maxWords) {
      return null;
    }
    return {
      key: "max_words",
      params: { max: maxWords, count: words.length },
      autoFix: () => words.slice(0, maxWords).join(" "),
    };
  },
};

const NO_SHOUTING_RULE = {
  name: "noShouting",
  applyOn: (noShouting, value) => {
    if (!noShouting || typeof value !== "string") {
      return null;
    }
    return value.includes("!!") ? "pas la peine de crier" : null;
  },
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("a rule of the app's own", () => {
    const [validity, applyOn] = createValidity({
      type: "string",
      rules: [MAX_WORDS_RULE],
      maxWords: 3,
      formatMessage: (key, params) =>
        key === "max_words"
          ? `pas plus de ${params.max} mots (${params.count})`
          : key,
    });

    const cases = ["un deux", "un deux trois", "un deux trois quatre"];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(humanize(validity.valid)),
        cell(humanize(validity.representations.valid?.value)),
        cell(humanize(validity.maxWords)),
      ];
    });
    return renderTable(
      [
        [
          cell("input"),
          cell(".valid"),
          cell(".representations.valid.value"),
          cell(".maxWords"),
        ],
        ...rows,
      ],
      { borderCollapse: true },
    );
  });

  test("a rule left unparameterized stays quiet", () => {
    const [validity, applyOn] = createValidity({
      type: "string",
      rules: [MAX_WORDS_RULE],
    });
    applyOn("un deux trois quatre cinq");
    return renderTable(
      [
        [cell(".valid"), cell(".maxWords")],
        [cell(humanize(validity.valid)), cell(humanize(validity.maxWords))],
      ],
      { borderCollapse: true },
    );
  });

  test("a rule answering with a finished sentence", () => {
    const [validity, applyOn] = createValidity({
      type: "string",
      rules: [NO_SHOUTING_RULE],
      noShouting: true,
      formatMessage: () => "this formatter is never called",
    });

    const cases = ["bonjour", "bonjour !!"];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(humanize(validity.valid)),
        cell(humanize(validity.noShouting)),
      ];
    });
    return renderTable(
      [[cell("input"), cell(".valid"), cell(".noShouting")], ...rows],
      { borderCollapse: true },
    );
  });

  test("app rules and built-in rules together", () => {
    const [validity, applyOn] = createValidity({
      type: "string",
      maxLength: 30,
      singleSpace: true,
      rules: [MAX_WORDS_RULE, NO_SHOUTING_RULE],
      maxWords: 3,
      noShouting: true,
      formatMessage: (key) => key,
    });

    const cases = ["un deux trois", "un  deux trois quatre !!"];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(humanize(validity.valid)),
        cell(humanize(validity.singleSpace)),
        cell(humanize(validity.maxWords)),
        cell(humanize(validity.noShouting)),
      ];
    });
    return renderTable(
      [
        [
          cell("input"),
          cell(".valid"),
          cell(".singleSpace"),
          cell(".maxWords"),
          cell(".noShouting"),
        ],
        ...rows,
      ],
      { borderCollapse: true },
    );
  });

  test("a malformed rule is refused", () => {
    const attempts = [
      { rules: [{ applyOn: () => null }] },
      { rules: [{ name: "noApplyOn" }] },
    ];
    const rows = attempts.map((ruleConfig) => {
      let thrown;
      try {
        createValidity({ type: "string", ...ruleConfig });
      } catch (e) {
        thrown = e.message;
      }
      return [cell(humanize(ruleConfig.rules[0])), cell(humanize(thrown))];
    });
    return renderTable([[cell("rule"), cell("throws")], ...rows], {
      borderCollapse: true,
    });
  });
});
