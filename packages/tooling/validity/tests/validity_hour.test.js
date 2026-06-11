import { humanize } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import { createValidity } from "../src/validity.js";

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value, border: BORDER });

const makeTable = (validity, applyOn, cases, cols) => {
  const rows = cases.map((value) => {
    applyOn(value);
    return [
      cell(humanize(value)),
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
  test("hour type validation", () => {
    const [validity, applyOn] = createValidity({ type: "hour" });
    return makeTable(validity, applyOn, [0, 12, -1, 1.5, "3", true, undefined], ["type", "min", "step"]);
  });

  test("hour type with max", () => {
    const [validity, applyOn] = createValidity({ type: "hour", max: 23 });
    return makeTable(validity, applyOn, [0, 23, 24], ["max"]);
  });
});
