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
  test("duration type validation", () => {
    const [validity, applyOn] = createValidity({ type: "duration" });
    return makeTable(
      validity,
      applyOn,
      [
        // ISO 8601 — must be valid and stay valid (numeric values in parsed object)
        "PT2H15M",
        "P1Y2M3DT4H5M6S",
        // Human-friendly aliases
        "1h30min",
        "1h30",
        "2 hours 15 minutes",
        // Legacy format still accepted
        "2hour15minute",
        "30minute",
        "1hour",
        // Invalid / not parseable
        "1aday",
        "30",
        "",
        "invalid",
        90,
        undefined,
      ],
      ["type"],
    );
  });

  test("duration type with duration string max", () => {
    const [validity, applyOn] = createValidity({
      type: "duration",
      max: "1hour",
    });
    return makeTable(
      validity,
      applyOn,
      ["30minute", "1hour", "1hour1minute"],
      ["max"],
    );
  });

  test("duration type with min and max", () => {
    const [validity, applyOn] = createValidity({
      type: "duration",
      min: "30minute",
      max: "2hour",
    });
    return makeTable(
      validity,
      applyOn,
      ["15minute", "30minute", "1hour30minute", "2hour", "2hour30minute"],
      ["min", "max"],
    );
  });
});
