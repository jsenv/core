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
  test("date type validation", () => {
    const [validity, applyOn] = createValidity({ type: "date" });
    return makeTable(
      validity,
      applyOn,
      [
        ['"2024-06-15"', "2024-06-15"],
        ['"2024-02-29" (leap)', "2024-02-29"],
        ['"2023-02-29" (invalid leap)', "2023-02-29"],
        ['"not-a-date"', "not-a-date"],
        ["timestamp (number)", Date.UTC(2024, 5, 15)],
        ["boolean (invalid type)", true],
        ["undefined", undefined],
      ],
      ["type"],
    );
  });

  test("date type with min (timestamp)", () => {
    const today = new Date(2024, 5, 15);
    const [validity, applyOn] = createValidity({
      type: "date",
      min: today.getTime(),
    });
    return makeTable(
      validity,
      applyOn,
      [
        ['"2024-06-15" (today)', "2024-06-15"],
        ['"2024-06-14" (yesterday)', "2024-06-14"],
        ['"2024-06-16" (tomorrow)', "2024-06-16"],
      ],
      ["min"],
    );
  });

  test("date type with min and max (string bounds)", () => {
    const [validity, applyOn] = createValidity({
      type: "date",
      min: "2024-01-01",
      max: "2024-12-31",
    });
    return makeTable(
      validity,
      applyOn,
      [
        ['"2024-06-15"', "2024-06-15"],
        ['"2023-12-31" (before min)', "2023-12-31"],
        ['"2025-01-01" (after max)', "2025-01-01"],
      ],
      ["min", "max"],
    );
  });
});
