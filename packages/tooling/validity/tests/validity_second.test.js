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

snapshotTests.prefConfigure({ preserveDurations: true });
await snapshotTests(import.meta.url, ({ test }) => {
  test("second type validation", () => {
    const [validity, applyOn] = createValidity({ type: "second" });
    return makeTable(
      validity,
      applyOn,
      [0, 30, -1, 1.5, "10", "1hour", "30second", true, undefined],
      ["type", "min", "step"],
    );
  });

  test("second type with max and decimal step", () => {
    const [validity, applyOn] = createValidity({
      type: "second",
      max: 59,
      step: 0.5,
    });
    return makeTable(validity, applyOn, [0, 30.5, 30.3, 60], ["max", "step"]);
  });

  test("second type with duration string max", () => {
    const [validity, applyOn] = createValidity({
      type: "second",
      max: "1hour",
    });
    return makeTable(validity, applyOn, [0, 3600, 3601], ["max"]);
  });
});
