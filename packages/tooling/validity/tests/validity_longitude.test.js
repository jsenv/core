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
  test("longitude type validation", () => {
    const [validity, applyOn] = createValidity({ type: "longitude" });
    return makeTable(validity, applyOn, [45.5, 0, -179.9, 200, -200, "125.5", undefined], ["type"]);
  });

  test("longitude with step 0.1", () => {
    const [validity, applyOn] = createValidity({ type: "longitude", step: 0.1 });
    return makeTable(validity, applyOn, ["3.000001", "2.67", "-179.95", "3.05"], ["step"]);
  });

  test("longitude with step 0.000001", () => {
    const [validity, applyOn] = createValidity({ type: "longitude", step: 0.000001 });
    return makeTable(validity, applyOn, ["48.86666699999998"], ["step"]);
  });
});
