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
      customRepresentation: "string",
    });
    const [validityNumber, applyOnNumber] = createValidity({
      type: "boolean",
      customRepresentation: "number",
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

    const customCell = (validity) => {
      const v = validity.representations?.custom?.value;
      return cell(v !== undefined ? humanize(v) : "[[CANNOT_CONVERT]]");
    };

    const grid = [
      [
        cell("input"),
        cell(".representations.custom.value (string)"),
        cell(".representations.custom.value (number)"),
      ],
      ...cases.map((value) => {
        applyOnString(value);
        applyOnNumber(value);
        return [
          cell(humanize(value)),
          customCell(validityString),
          customCell(validityNumber),
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
