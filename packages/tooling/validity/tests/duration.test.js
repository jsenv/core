import { humanize } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import {
  durationToSeconds,
  durationToString,
  parseDuration,
} from "../src/duration.js";

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value, border: BORDER });

await snapshotTests(import.meta.url, ({ test }) => {
  test("parseDuration", () => {
    const cases = [
      // single units (singular only)
      "2hour",
      "15minute",
      "30second",
      "3day",
      "2week",
      "1month",
      "1year",
      // compound
      "2hour15minute",
      "1year2month3day",
      "1hour20minute30second",
      // spaces between tokens are accepted
      "2hour 15minute",
      // invalid values preserved (parser only splits, does not validate)
      "2ahour",
      "2hourhour",
      // plural forms not accepted (format is singular-only)
      "2hours",
      "15minutes",
      // object passthrough
      { hours: 2, minutes: 15 },
      {},
      // invalid / missing unit
      "30",
      "",
      null,
      undefined,
      42,
    ];

    const rows = cases.map((value) => {
      const result = parseDuration(value);
      return [cell(humanize(value)), cell(humanize(result))];
    });

    return renderTable([[cell("input"), cell("parseDuration()")], ...rows], {
      borderCollapse: true,
    });
  });

  test("durationToString", () => {
    const cases = [
      { hours: 2, minutes: 15 },
      { years: 1, months: 2 },
      {
        years: 1,
        months: 2,
        weeks: 3,
        days: 4,
        hours: 5,
        minutes: 6,
        seconds: 7,
      },
      { minutes: 30 },
      { seconds: 90 },
      // key order in object does not matter -- output is always largest-first
      { minutes: 15, hours: 2 },
      // invalid value preserved as-is, unit appended -> implicit escaping
      { hours: "2a" },
      { hours: "2hour" },
      {},
      null,
      undefined,
    ];

    const rows = cases.map((value) => {
      const result = durationToString(value);
      return [cell(humanize(value)), cell(humanize(result))];
    });

    return renderTable([[cell("input"), cell("durationToString()")], ...rows], {
      borderCollapse: true,
    });
  });

  test("durationToSeconds", () => {
    const cases = [
      // strings
      "2hour",
      "2hour15minute",
      "1year",
      "30second",
      "30",
      "",
      null,
      // objects
      { hours: 2, minutes: 15 },
      { years: 1 },
      { minutes: 30 },
      {},
    ];

    const rows = cases.map((value) => {
      const result = durationToSeconds(value);
      return [cell(humanize(value)), cell(humanize(result))];
    });

    return renderTable(
      [[cell("input"), cell("durationToSeconds()")], ...rows],
      { borderCollapse: true },
    );
  });
});
