import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import {
  formatDay,
  formatHourDuration,
  formatMinuteDuration,
  formatMonth,
  formatSecondDuration,
  formatTime,
  formatTimeRelative,
  getRelativeDay,
} from "@jsenv/humanize";

// Fixed reference point: Monday 11 May 2026, 14:00:00 local time
const NOW = new Date("2026-05-11T14:00:00");
const opts = { now: NOW };

const BORDER = { color: COLORS.GREY };
const cell = (value) => ({ value, border: BORDER });

const table = (headers, rows) => {
  const grid = [headers.map(cell)];
  for (const row of rows) {
    grid.push(row.map(cell));
  }
  return renderTable(grid, { borderCollapse: true });
};

snapshotTests.prefConfigure({ preserveDurations: true });
await snapshotTests(import.meta.url, ({ test }) => {
  test("formatDay", () => {
    return table(
      ["date", "options", "locale", "result"],
      [
        [
          "2026-05-10 (yesterday)",
          "default",
          "fr",
          formatDay(new Date("2026-05-10T09:00:00"), { lang: "fr" }),
        ],
        [
          "2026-05-11 (today)",
          "default",
          "fr",
          formatDay(new Date("2026-05-11T09:00:00"), { lang: "fr" }),
        ],
        [
          "2026-05-12 (tomorrow)",
          "default",
          "fr",
          formatDay(new Date("2026-05-12T09:00:00"), { lang: "fr" }),
        ],
        [
          "2026-05-18 (next week)",
          "default",
          "fr",
          formatDay(new Date("2026-05-18T09:00:00"), { lang: "fr" }),
        ],
        [
          "2026-05-11 (today)",
          "default",
          "en",
          formatDay(new Date("2026-05-11T09:00:00"), { lang: "en" }),
        ],
        [
          "2026-05-11 (today)",
          "long",
          "fr",
          formatDay(new Date("2026-05-11T09:00:00"), {
            lang: "fr",
            format: "long",
          }),
        ],
        [
          "2026-05-18 (next week)",
          "long",
          "fr",
          formatDay(new Date("2026-05-18T09:00:00"), {
            lang: "fr",
            format: "long",
          }),
        ],
        // September is the date to spell apart: "septembre" abbreviates, "mai" does not
        [
          "2026-09-02",
          "short",
          "fr",
          formatDay(new Date("2026-09-02T09:00:00"), {
            lang: "fr",
            format: "short",
          }),
        ],
        [
          "2026-09-02",
          "{ weekday: long, month: short }",
          "fr",
          formatDay(new Date("2026-09-02T09:00:00"), {
            lang: "fr",
            format: { weekday: "long", month: "short" },
          }),
        ],
        [
          "2026-09-02",
          "{ month: short }",
          "fr",
          formatDay(new Date("2026-09-02T09:00:00"), {
            lang: "fr",
            format: { month: "short" },
          }),
        ],
        [
          "2026-09-02",
          "{ weekday: long, month: short }",
          "en",
          formatDay(new Date("2026-09-02T09:00:00"), {
            lang: "en",
            format: { weekday: "long", month: "short" },
          }),
        ],
      ],
    );
  });

  test("getRelativeDay", () => {
    return table(
      ["date", "result"],
      [
        [
          "2026-05-10 (yesterday)",
          getRelativeDay(new Date("2026-05-10T09:00:00"), opts),
        ],
        [
          "2026-05-11 (today)",
          getRelativeDay(new Date("2026-05-11T09:00:00"), opts),
        ],
        [
          "2026-05-12 (tomorrow)",
          getRelativeDay(new Date("2026-05-12T09:00:00"), opts),
        ],
        [
          "2026-05-18 (next week)",
          getRelativeDay(new Date("2026-05-18T09:00:00"), opts),
        ],
      ],
    );
  });

  test("formatMonth", () => {
    return table(
      ["date", "locale", "result"],
      [
        [
          "2026-05-01",
          "fr",
          formatMonth(new Date("2026-05-01"), { lang: "fr" }),
        ],
        [
          "2026-05-01",
          "en",
          formatMonth(new Date("2026-05-01"), { lang: "en" }),
        ],
        [
          "2026-01-01",
          "fr",
          formatMonth(new Date("2026-01-01"), { lang: "fr" }),
        ],
      ],
    );
  });

  test("formatTime", () => {
    return table(
      ["date", "locale", "result"],
      [
        [
          "2026-05-11T14:30:00",
          "fr",
          formatTime(new Date("2026-05-11T14:30:00"), { lang: "fr" }),
        ],
        [
          "2026-05-11T09:05:00",
          "fr",
          formatTime(new Date("2026-05-11T09:05:00"), { lang: "fr" }),
        ],
        [
          "2026-05-11T14:30:00",
          "en",
          formatTime(new Date("2026-05-11T14:30:00"), { lang: "en" }),
        ],
      ],
    );
  });

  test("formatDuration - future", () => {
    const ms = (n) => NOW.getTime() + n;
    return table(
      ["start offset", "duration", "locale", "result"],
      [
        [
          "+30s",
          0,
          "fr",
          formatTimeRelative(ms(+30_000), 0, { lang: "fr", ...opts }),
        ],
        [
          "+20min",
          0,
          "fr",
          formatTimeRelative(ms(+20 * 60_000), 0, { lang: "fr", ...opts }),
        ],
        [
          "+60min",
          0,
          "fr",
          formatTimeRelative(ms(+60 * 60_000), 0, { lang: "fr", ...opts }),
        ],
        [
          "+90min",
          0,
          "fr",
          formatTimeRelative(ms(+90 * 60_000), 0, { lang: "fr", ...opts }),
        ],
        [
          "+4h",
          0,
          "fr",
          formatTimeRelative(ms(+4 * 3_600_000), 0, { lang: "fr", ...opts }),
        ],
        [
          "tomorrow 20h",
          0,
          "fr",
          formatTimeRelative(new Date("2026-05-12T20:00:00"), 0, {
            lang: "fr",
            ...opts,
          }),
        ],
        [
          "+3 days",
          0,
          "fr",
          formatTimeRelative(ms(+3 * 86_400_000), 0, { lang: "fr", ...opts }),
        ],
        [
          "+35 days",
          0,
          "fr",
          formatTimeRelative(ms(+35 * 86_400_000), 0, { lang: "fr", ...opts }),
        ],
        [
          "+65 days",
          0,
          "fr",
          formatTimeRelative(ms(+65 * 86_400_000), 0, { lang: "fr", ...opts }),
        ],
      ],
    );
  });

  test("formatDuration — ongoing", () => {
    const ms = (n) => NOW.getTime() + n;
    return table(
      ["start offset", "duration", "locale", "result"],
      [
        [
          "-10min",
          "1h",
          "fr",
          formatTimeRelative(ms(-10 * 60_000), 60 * 60_000, {
            lang: "fr",
            ...opts,
          }),
        ],
        [
          "-10min",
          "1h",
          "en",
          formatTimeRelative(ms(-10 * 60_000), 60 * 60_000, {
            lang: "en",
            ...opts,
          }),
        ],
      ],
    );
  });

  test("formatDuration — past", () => {
    const ms = (n) => NOW.getTime() + n;
    return table(
      ["start offset", "duration", "locale", "result"],
      [
        [
          "-3h",
          "1h",
          "fr",
          formatTimeRelative(ms(-3 * 3_600_000), 3_600_000, {
            lang: "fr",
            ...opts,
          }),
        ],
        [
          "-5min",
          0,
          "fr",
          formatTimeRelative(ms(-5 * 60_000), 0, { lang: "fr", ...opts }),
        ],
      ],
    );
  });

  test("formatMinuteDuration — compact (default)", () => {
    const run = (minutes, locale) =>
      formatMinuteDuration(minutes, { lang: locale, format: "compact" });
    return table(
      ["minutes", "locale", "result"],
      [
        [0, "fr", run(0, "fr")],
        [1, "fr", run(1, "fr")],
        [45, "fr", run(45, "fr")],
        [60, "fr", run(60, "fr")],
        [90, "fr", run(90, "fr")],
        [120, "fr", run(120, "fr")],
        [135, "fr", run(135, "fr")],
        [45, "en", run(45, "en")],
        [90, "en", run(90, "en")],
      ],
    );
  });

  test("formatMinuteDuration — long", () => {
    const run = (minutes, locale) =>
      formatMinuteDuration(minutes, { lang: locale, format: "long" });
    return table(
      ["minutes", "locale", "result"],
      [
        [0, "fr", run(0, "fr")],
        [45, "fr", run(45, "fr")],
        [60, "fr", run(60, "fr")],
        [90, "fr", run(90, "fr")],
        [135, "fr", run(135, "fr")],
        [45, "en", run(45, "en")],
        [90, "en", run(90, "en")],
      ],
    );
  });

  test("formatHourDuration", () => {
    const run = (hours, locale, long = false) =>
      formatHourDuration(hours, {
        lang: locale,
        format: long ? "long" : "compact",
      });
    return table(
      ["hours", "locale", "long", "result"],
      [
        [1, "fr", false, run(1, "fr")],
        [1.5, "fr", false, run(1.5, "fr")],
        [2.25, "fr", false, run(2.25, "fr")],
        [1, "en", false, run(1, "en")],
        [1.5, "en", false, run(1.5, "en")],
        [1.5, "fr", true, run(1.5, "fr", true)],
        [2.25, "fr", true, run(2.25, "fr", true)],
      ],
    );
  });

  // clockStyle is what <Time type="time"> uses: the minutes are a time of day,
  // so a zero hour is kept and a zero minute is printed rather than dropped
  test("formatMinuteDuration — clockStyle", () => {
    const run = (minutes, locale, format) =>
      formatMinuteDuration(minutes, { lang: locale, format, clockStyle: true });
    const rows = [];
    for (const [label, minutes] of [
      ["00:00", 0],
      ["00:05", 5],
      ["09:05", 545],
      ["10:00", 600],
      ["14:30", 870],
      ["14:00", 840],
    ]) {
      for (const locale of ["fr", "en"]) {
        rows.push([
          label,
          locale,
          run(minutes, locale, "long"),
          run(minutes, locale, "short"),
          run(minutes, locale, "narrow"),
          run(minutes, locale, "compact"),
        ]);
      }
    }
    return table(
      ["time", "locale", "long", "short", "narrow", "compact"],
      rows,
    );
  });

  // the values that are not a plain "a few hours and minutes": past a day,
  // zero, and negative
  test("formatMinuteDuration — edge values", () => {
    const run = (minutes, locale, format) =>
      formatMinuteDuration(minutes, { lang: locale, format });
    const rows = [];
    for (const [label, minutes] of [
      ["0", 0],
      ["-90", -90],
      ["1440 (1 day)", 1440],
      ["1500 (25h)", 1500],
      ["2160 (36h)", 2160],
      ["-2160", -2160],
    ]) {
      for (const locale of ["fr", "en"]) {
        rows.push([
          label,
          locale,
          run(minutes, locale, "long"),
          run(minutes, locale, "short"),
          run(minutes, locale, "narrow"),
          run(minutes, locale, "compact"),
        ]);
      }
    }
    return table(
      ["minutes", "locale", "long", "short", "narrow", "compact"],
      rows,
    );
  });

  test("formatSecondDuration — edge values", () => {
    const run = (seconds, locale, format) =>
      formatSecondDuration(seconds, { lang: locale, format });
    const rows = [];
    for (const [label, seconds] of [
      ["0", 0],
      ["-45", -45],
      ["3661", 3661],
      ["86400 (1 day)", 86400],
      ["90000 (25h)", 90000],
    ]) {
      for (const locale of ["fr", "en"]) {
        rows.push([
          label,
          locale,
          run(seconds, locale, "long"),
          run(seconds, locale, "short"),
          run(seconds, locale, "narrow"),
          run(seconds, locale, "compact"),
        ]);
      }
    }
    return table(
      ["seconds", "locale", "long", "short", "narrow", "compact"],
      rows,
    );
  });

  // forceUnit keeps the value in the unit it is expressed in instead of
  // promoting it to days
  test("forceUnit", () => {
    const rows = [];
    for (const [label, run] of [
      [
        "hour 36",
        (f, o) => formatHourDuration(36, { lang: "fr", format: f, ...o }),
      ],
      [
        "hour 1.5",
        (f, o) => formatHourDuration(1.5, { lang: "fr", format: f, ...o }),
      ],
      [
        "minute 2160",
        (f, o) => formatMinuteDuration(2160, { lang: "fr", format: f, ...o }),
      ],
      [
        "second 90000",
        (f, o) => formatSecondDuration(90000, { lang: "fr", format: f, ...o }),
      ],
    ]) {
      for (const format of ["long", "compact"]) {
        rows.push([
          label,
          format,
          run(format, {}),
          run(format, { forceUnit: true }),
        ]);
      }
    }
    return table(["value", "format", "(default)", "forceUnit"], rows);
  });
});
