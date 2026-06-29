import { humanize } from "@jsenv/humanize";
import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import {
  durationToISOString,
  durationToSeconds,
  durationToString,
  parseDuration,
} from "../src/duration.js";

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value, border: BORDER });

snapshotTests.prefConfigure({ preserveDurations: true });
await snapshotTests(import.meta.url, ({ test }) => {
  test("parseDuration", () => {
    const cases = [
      // single units (singular only)
      "2hour",
      "15minute",
      "30second",
      "140millisecond",
      "3day",
      "2week",
      "1month",
      "1year",
      // compound
      "2hour15minute",
      "1year2month3day",
      "1hour20minute30second",
      "1second140millisecond",
      // spaces are NOT trimmed -- " 15" is the raw minute value
      "2hour 15minute",
      // decimal value
      "1.14second",
      // negative sign
      "-1second",
      // invalid values preserved (parser only splits, does not validate)
      "2ahour",
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
      maxRows: Infinity,
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
      // invalid value preserved as-is, unit appended
      { hours: "2a" },
      { seconds: "-1" },
      { seconds: 1, milliseconds: 140 },
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

  test("parseDuration ISO strings", () => {
    const cases = [
      // standard ISO
      "PT2H30M",
      "P1Y2M3W4DT5H6M7S",
      "P3W",
      // lowercase accepted
      "pt2h30m",
      // decimal seconds
      "PT1.5S",
      // bare P / PT — no components → null
      "P",
      "PT",
      // non-numeric values preserved (mid-edit support)
      // value before the marker letter is kept as-is
      "PTabH", // hours: "ab"
      "PTaHH", // hours: "aH"  (last H is the marker, "aH" is the value)
      "PT30MabH", // hours: "30Mab"  (last H is marker; everything before it is the value)
      "P1YabMT2H", // years: 1, months: "ab", hours: 2
    ];

    const rows = cases.map((value) => {
      const result = parseDuration(value);
      return [cell(humanize(value)), cell(humanize(result))];
    });

    return renderTable([[cell("input"), cell("parseDuration()")], ...rows], {
      borderCollapse: true,
      maxRows: Infinity,
    });
  });

  test("durationToSeconds", () => {
    const cases = [
      // strings
      "2hour",
      "2hour15minute",
      "1year",
      "30second",
      "1.14second",
      "-1second",
      "1second140millisecond",
      "30",
      "",
      null,
      // objects
      { hours: 2, minutes: 15 },
      { years: 1 },
      { minutes: 30 },
      { seconds: "-1" },
      { hours: "2a" },
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

  test("durationToISOString", () => {
    const cases = [
      // standard numeric durations
      { hours: 2, minutes: 30 },
      { years: 1, months: 2 },
      { seconds: 1, milliseconds: 500 },
      // explicit zeros are preserved (user typed "0" vs field left empty)
      { hours: 0, minutes: 30 },
      { hours: 0 },
      { seconds: 0 },
      // non-numeric mid-edit values embedded as-is between markers
      { hours: "ab", minutes: 30 },
      { hours: "aH", minutes: 30 },
      // non-numeric values containing ISO marker letters are bracket-escaped so
      // the field association is preserved through the round-trip
      // time markers (H/M/S)
      { minutes: "34h" },
      { minutes: "30m" },
      { hours: "2", minutes: "34h" },
      // date markers (Y/M/W/D)
      { months: "2Y" },
      { weeks: "3M" },
      { days: "5W" },
      // empty / null → null
      {},
      null,
    ];

    const rows = cases.map((value) => {
      const result = durationToISOString(value);
      return [cell(humanize(value)), cell(humanize(result))];
    });

    return renderTable(
      [[cell("input"), cell("durationToISOString()")], ...rows],
      { borderCollapse: true, maxRows: Infinity },
    );
  });

  // Demonstrates the full mid-edit round-trip that InputDuration relies on:
  //   build an ISO string from sub-field values → store it → parse it back → validate
  //
  // The sub-fields (hours / minutes / seconds) each map to one key in the
  // duration object. A field that is still empty is omitted from the object;
  // a field that contains a partial or invalid string is included as-is.
  // durationToISOString embeds those values between ISO markers so they survive
  // the round-trip through parseDuration.
  test("mid-edit round-trip", () => {
    // Each step records { hours, minutes, seconds } as the component would
    // build durationObj (absent = not in object, present = raw input string).
    const steps = [
      {
        label: "initial — all fields empty",
        durationObj: {},
      },
      {
        label: 'user types "a" into hours',
        durationObj: { hours: "a" },
      },
      {
        label: 'user types "0" into minutes',
        durationObj: { hours: "a", minutes: "0" },
      },
      {
        label: 'user replaces hours with "2"',
        durationObj: { hours: "2", minutes: "0" },
      },
      {
        label: 'user replaces minutes with "30"',
        durationObj: { hours: "2", minutes: "30" },
      },
      {
        label: 'user types "34h" into minutes — preserved as minutes: "34h"',
        durationObj: { minutes: "34h" },
      },
    ];

    const rows = steps.map(({ label, durationObj }) => {
      const iso = durationToISOString(durationObj);
      const parsed = parseDuration(iso);
      // validation: all values must be finite numbers
      let valid = false;
      if (parsed) {
        valid = Object.values(parsed).every(
          (v) => typeof v === "number" && isFinite(v),
        );
      }
      return [
        cell(label),
        cell(humanize(durationObj)),
        cell(humanize(iso)),
        cell(humanize(parsed)),
        cell(valid ? "valid" : "invalid"),
      ];
    });

    return renderTable(
      [
        [
          cell("step"),
          cell("durationObj"),
          cell("ISO string"),
          cell("parsed back"),
          cell("valid?"),
        ],
        ...rows,
      ],
      { borderCollapse: true, maxRows: Infinity },
    );
  });
});
