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
  test("minute type validation", () => {
    const [validity, applyOn] = createValidity({ type: "minute" });
    return makeTable(
      validity,
      applyOn,
      [0, 30, 90, -5, 1.5, "45", "1hour", "30minute", true, undefined],
      ["type", "min", "step"],
    );
  });

  test("minute type with max", () => {
    const [validity, applyOn] = createValidity({ type: "minute", max: 59 });
    return makeTable(validity, applyOn, [0, 59, 60], ["max"]);
  });

  test("minute type with duration string max", () => {
    const [validity, applyOn] = createValidity({
      type: "minute",
      max: "1hour",
    });
    return makeTable(validity, applyOn, [0, 60, 61], ["max"]);
  });
});
