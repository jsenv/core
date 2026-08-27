import { humanize } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import { createValidity } from "../src/validity.js";

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value, border: BORDER });

await snapshotTests(import.meta.url, ({ test }) => {
  test("formatMessage receives the key and its params", () => {
    const seen = [];
    const [validity, applyOn] = createValidity({
      type: "string",
      maxLength: 5,
      singleSpace: true,
      formatMessage: (key, params) => {
        seen.push({ key, params });
        return `<${key}>`;
      },
    });

    applyOn("  abcdef");
    return renderTable(
      [
        [cell("key"), cell("params"), cell("validity")],
        ...seen.map(({ key, params }, index) => [
          cell(humanize(key)),
          cell(humanize(params)),
          cell(
            humanize(index === 0 ? validity.maxLength : validity.singleSpace),
          ),
        ]),
      ],
      { borderCollapse: true },
    );
  });

  test("the same rule config in another language", () => {
    const FRENCH = {
      "max_length.default": "ne doit pas dépasser [max] caractères",
      "single_space.start": "ne doit pas commencer par une espace",
    };
    const [validity, applyOn] = createValidity({
      type: "string",
      maxLength: 5,
      singleSpace: true,
      formatMessage: (key, params) => {
        const template = FRENCH[key];
        if (!template) {
          return key;
        }
        return template.replace(/\[([^\]]+)\]/g, (match, name) =>
          Object.hasOwn(params, name) ? String(params[name]) : match,
        );
      },
    });

    const cases = ["abcdef", " ab"];
    const rows = cases.map((value) => {
      applyOn(value);
      return [
        cell(humanize(value)),
        cell(humanize(validity.maxLength)),
        cell(humanize(validity.singleSpace)),
      ];
    });
    return renderTable(
      [[cell("input"), cell(".maxLength"), cell(".singleSpace")], ...rows],
      { borderCollapse: true },
    );
  });
});
