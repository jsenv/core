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
  test("month type validation", () => {
    const [validity, applyOn] = createValidity({ type: "month" });
    return makeTable(validity, applyOn, [
      ['"2024-06"', "2024-06"],
      ['"2024-13" (invalid month)', "2024-13"],
      ['"2024-00" (invalid month)', "2024-00"],
      ['"not-a-month"', "not-a-month"],
      ["timestamp (number)", Date.UTC(2024, 5, 1)],
      ["undefined", undefined],
    ], ["type"]);
  });

  test("month type with min (timestamp)", () => {
    const thisMonth = new Date(2024, 5, 1);
    const [validity, applyOn] = createValidity({ type: "month", min: thisMonth.getTime() });
    return makeTable(validity, applyOn, [
      ['"2024-06" (this month)', "2024-06"],
      ['"2024-05" (last month)', "2024-05"],
      ['"2024-07" (next month)', "2024-07"],
    ], ["min"]);
  });
});
