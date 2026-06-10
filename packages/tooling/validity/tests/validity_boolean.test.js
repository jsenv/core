import { humanize } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import { createValidity } from "../src/validity.js";

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value, border: BORDER });

await snapshotTests(import.meta.url, ({ test }) => {
  test("boolean representations", () => {
    const [validityString, applyOnString] = createValidity({
      type: "boolean",
      representation: { string: "string" },
    });
    const [validityNumber, applyOnNumber] = createValidity({
      type: "boolean",
      representation: { number: "number" },
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

    const customCell = (validity, key) => {
      const v = validity.representations?.[key]?.value;
      return cell(v !== undefined ? humanize(v) : "[[CANNOT_CONVERT]]");
    };

    const grid = [
      [
        cell("input"),
        cell(".representations.string.value"),
        cell(".representations.number.value"),
      ],
      ...cases.map((value) => {
        applyOnString(value);
        applyOnNumber(value);
        return [
          cell(humanize(value)),
          customCell(validityString, "string"),
          customCell(validityNumber, "number"),
        ];
      }),
    ];

    return renderTable(grid, { borderCollapse: true });
  });
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
        cell("input"),
        cell(".valid"),
        cell(".representations.valid.value"),
        cell(".type"),
      ],
      ...cases.map((value) => {
        applyOn(value);
        return [
          cell(humanize(value)),
          cell(humanize(validity.valid)),
          cell(humanize(validity.representations.valid?.value)),
          cell(humanize(validity.type)),
        ];
      }),
    ];

    return renderTable(grid, { borderCollapse: true });
  });
});
