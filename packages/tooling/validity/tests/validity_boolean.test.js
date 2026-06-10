import { humanize } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import { createValidity } from "../src/validity.js";

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value, border: BORDER });

await snapshotTests(import.meta.url, ({ test }) => {
  test("boolean type conversion", () => {
    const [validity, applyOn] = createValidity({
      type: "boolean",
    });

    const cases = [
      true,
      false,
      "true",
      "false",
      "on",
      "1",
      1,
      0,
      "toto",
      undefined,
    ];

    const grid = [
      [
        cell("value"),
        cell("valid"),
        cell("valid suggestion"),
        cell("invalid message"),
      ],
      ...cases.map((value) => {
        applyOn(value);
        return [
          cell(humanize(value)),
          cell(validity.valid ? "✓" : "✗"),
          cell(
            validity.validSuggestion
              ? humanize(validity.validSuggestion.value)
              : "-",
          ),
          cell(validity.type ?? "-"),
        ];
      }),
    ];

    return renderTable(grid, { borderCollapse: true });
  });
});
