import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import {
  formatDay,
  formatHourDuration,
  formatMinuteDuration,
  formatMonth,
  formatTime,
  formatTimeRelative,
  getRelativeDay,
} from "../format_time.js";

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
          formatDay(new Date("2026-05-11T09:00:00"), { lang: "fr", format: "long" }),
        ],
        [
          "2026-05-18 (next week)",
          "long",
          "fr",
          formatDay(new Date("2026-05-18T09:00:00"), { lang: "fr", format: "long" }),
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
        ["2026-05-01", "fr", formatMonth(new Date("2026-05-01"), { lang: "fr" })],
        ["2026-05-01", "en", formatMonth(new Date("2026-05-01"), { lang: "en" })],
        ["2026-01-01", "fr", formatMonth(new Date("2026-01-01"), { lang: "fr" })],
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
          formatTime(new Date("2026-05-11T14:30:00"), "fr"),
        ],
        [
          "2026-05-11T09:05:00",
          "fr",
          formatTime(new Date("2026-05-11T09:05:00"), "fr"),
        ],
        [
          "2026-05-11T14:30:00",
          "en",
          formatTime(new Date("2026-05-11T14:30:00"), "en"),
        ],
      ],
    );
  });

  test("formatDuration - future", () => {
    const ms = (n) => NOW.getTime() + n;
    return table(
      ["start offset", "duration", "locale", "result"],
      [
        ["+30s", 0, "fr", formatTimeRelative(ms(+30_000), 0, { lang: "fr", ...opts })],
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
        ["+4h", 0, "fr", formatTimeRelative(ms(+4 * 3_600_000), 0, { lang: "fr", ...opts })],
        [
          "tomorrow 20h",
          0,
          "fr",
          formatTimeRelative(new Date("2026-05-12T20:00:00"), 0, { lang: "fr", ...opts }),
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
          formatTimeRelative(ms(-10 * 60_000), 60 * 60_000, { lang: "fr", ...opts }),
        ],
        [
          "-10min",
          "1h",
          "en",
          formatTimeRelative(ms(-10 * 60_000), 60 * 60_000, { lang: "en", ...opts }),
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
          formatTimeRelative(ms(-3 * 3_600_000), 3_600_000, { lang: "fr", ...opts }),
        ],
        ["-5min", 0, "fr", formatTimeRelative(ms(-5 * 60_000), 0, { lang: "fr", ...opts })],
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
      formatHourDuration(hours, { lang: locale, format: long ? "long" : "compact" });
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
});
