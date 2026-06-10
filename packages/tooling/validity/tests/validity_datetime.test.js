import { humanize } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import { createValidity } from "../src/validity.js";

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value, border: BORDER });

const makeTable = (validity, applyOn, cases, cols) => {
  const rows = cases.map(([label, value]) => {
    applyOn(value);
    return [
      cell(label),
      cell(humanize(validity.value)),
      cell(humanize(validity.valid)),
      cell(humanize(validity.representations.valid?.value)),
      ...cols.map((col) => cell(humanize(validity[col]))),
    ];
  });
  return renderTable(
    [
      [
        cell("input"),
        cell(".value"),
        cell(".valid"),
        cell(".representations.valid.value"),
        ...cols.map((col) => cell(`.${col}`)),
      ],
      ...rows,
    ],
    { borderCollapse: true },
  );
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("datetime type validation", () => {
    const [validity, applyOn] = createValidity({ type: "datetime" });
    return makeTable(validity, applyOn, [
      ['"2024-06-15T14:30:00Z"', "2024-06-15T14:30:00Z"],
      ['"2024-06-15"', "2024-06-15"],
      ['"not a datetime"', "not a datetime"],
      ["timestamp (number)", Date.UTC(2024, 5, 15, 14, 30)],
      ["Date instance", new Date(2024, 5, 15, 14, 30)],
      ["undefined", undefined],
    ], ["type"]);
  });

  test("datetime type with min and max (timestamps)", () => {
    const minTs = new Date(2024, 5, 15, 9, 0).getTime();
    const maxTs = new Date(2024, 5, 15, 18, 0).getTime();
    const [validity, applyOn] = createValidity({ type: "datetime", min: minTs, max: maxTs });
    return makeTable(validity, applyOn, [
      ["within range", new Date(2024, 5, 15, 12, 0).getTime()],
      ["before min", new Date(2024, 5, 15, 8, 0).getTime()],
      ["after max", new Date(2024, 5, 15, 19, 0).getTime()],
    ], ["min", "max"]);
  });
});
