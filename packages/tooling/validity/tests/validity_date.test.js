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

  test("date min as timestamp (e.g. Date.now())", () => {
    // In practice: min: Date.now()
    // Here we freeze the date for snapshot stability
    const now = new Date(2024, 5, 15).getTime();
    const yesterday = new Date(2024, 5, 14).toISOString().slice(0, 10);
    const today = new Date(2024, 5, 15).toISOString().slice(0, 10);
    const tomorrow = new Date(2024, 5, 16).toISOString().slice(0, 10);
    const [validity, applyOn] = createValidity({
      type: "date",
      min: now,
    });
    return makeTable(
      validity,
      applyOn,
      [
        [`"${today}" (today)`, today],
        [`"${yesterday}" (yesterday)`, yesterday],
        [`"${tomorrow}" (tomorrow)`, tomorrow],
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
