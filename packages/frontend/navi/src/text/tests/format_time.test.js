import { snapshotTests } from "@jsenv/snapshot";
import { COLORS, renderTable } from "@jsenv/terminal-table";

import {
  formatDay,
  formatMonth,
  formatTime,
  formatTimeRelative,
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
        // default (short + labels)
        [
          "2026-05-10 (yesterday)",
          "default",
          "fr",
          formatDay(new Date("2026-05-10T09:00:00"), "fr", opts),
        ],
        [
          "2026-05-11 (today)",
          "default",
          "fr",
          formatDay(new Date("2026-05-11T09:00:00"), "fr", opts),
        ],
        [
          "2026-05-12 (tomorrow)",
          "default",
          "fr",
          formatDay(new Date("2026-05-12T09:00:00"), "fr", opts),
        ],
        [
          "2026-05-18 (next week)",
          "default",
          "fr",
          formatDay(new Date("2026-05-18T09:00:00"), "fr", opts),
        ],
        [
          "2026-05-11 (today)",
          "default",
          "en",
          formatDay(new Date("2026-05-11T09:00:00"), "en", opts),
        ],
        [
          "2026-05-12 (tomorrow)",
          "default",
          "en",
          formatDay(new Date("2026-05-12T09:00:00"), "en", opts),
        ],
        // long
        [
          "2026-05-10 (yesterday)",
          "long",
          "fr",
          formatDay(new Date("2026-05-10T09:00:00"), "fr", {
            ...opts,
            long: true,
          }),
        ],
        [
          "2026-05-11 (today)",
          "long",
          "fr",
          formatDay(new Date("2026-05-11T09:00:00"), "fr", {
            ...opts,
            long: true,
          }),
        ],
        [
          "2026-05-12 (tomorrow)",
          "long",
          "fr",
          formatDay(new Date("2026-05-12T09:00:00"), "fr", {
            ...opts,
            long: true,
          }),
        ],
        [
          "2026-05-18 (next week)",
          "long",
          "fr",
          formatDay(new Date("2026-05-18T09:00:00"), "fr", {
            ...opts,
            long: true,
          }),
        ],
        // labels=false
        [
          "2026-05-11 (today)",
          "labels:false",
          "fr",
          formatDay(new Date("2026-05-11T09:00:00"), "fr", {
            ...opts,
            labels: false,
          }),
        ],
        // custom labels object
        [
          "2026-05-10 (yesterday)",
          "labels:{}",
          "fr",
          formatDay(new Date("2026-05-10T09:00:00"), "fr", {
            ...opts,
            labels: {
              yesterday: "hier",
              today: "aujourd'hui",
              tomorrow: "demain",
            },
          }),
        ],
        [
          "2026-05-11 (today)",
          "labels:{}",
          "fr",
          formatDay(new Date("2026-05-11T09:00:00"), "fr", {
            ...opts,
            labels: {
              yesterday: "hier",
              today: "aujourd'hui",
              tomorrow: "demain",
            },
          }),
        ],
        [
          "2026-05-12 (tomorrow)",
          "labels:{}",
          "fr",
          formatDay(new Date("2026-05-12T09:00:00"), "fr", {
            ...opts,
            labels: {
              yesterday: "hier",
              today: "aujourd'hui",
              tomorrow: "demain",
            },
          }),
        ],
        // partial labels object (suppress tomorrow)
        [
          "2026-05-12 (tomorrow)",
          "labels:{today only}",
          "fr",
          formatDay(new Date("2026-05-12T09:00:00"), "fr", {
            ...opts,
            labels: { today: "aujourd'hui" },
          }),
        ],
      ],
    );
  });

  test("formatMonth", () => {
    return table(
      ["date", "locale", "result"],
      [
        ["2026-05-01", "fr", formatMonth(new Date("2026-05-01"), "fr")],
        ["2026-05-01", "en", formatMonth(new Date("2026-05-01"), "en")],
        ["2026-01-01", "fr", formatMonth(new Date("2026-01-01"), "fr")],
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

  test("formatDuration — future", () => {
    const ms = (n) => NOW.getTime() + n;
    return table(
      ["start offset", "duration", "locale", "result"],
      [
        ["+30s", 0, "fr", formatTimeRelative(ms(+30_000), 0, "fr", opts)],
        [
          "+20min",
          0,
          "fr",
          formatTimeRelative(ms(+20 * 60_000), 0, "fr", opts),
        ],
        [
          "+60min",
          0,
          "fr",
          formatTimeRelative(ms(+60 * 60_000), 0, "fr", opts),
        ],
        [
          "+90min",
          0,
          "fr",
          formatTimeRelative(ms(+90 * 60_000), 0, "fr", opts),
        ],
        ["+4h", 0, "fr", formatTimeRelative(ms(+4 * 3_600_000), 0, "fr", opts)],
        [
          "tomorrow 20h",
          0,
          "fr",
          formatTimeRelative(new Date("2026-05-12T20:00:00"), 0, "fr", opts),
        ],
        [
          "+3 days",
          0,
          "fr",
          formatTimeRelative(ms(+3 * 86_400_000), 0, "fr", opts),
        ],
        [
          "+35 days",
          0,
          "fr",
          formatTimeRelative(ms(+35 * 86_400_000), 0, "fr", opts),
        ],
        [
          "+65 days",
          0,
          "fr",
          formatTimeRelative(ms(+65 * 86_400_000), 0, "fr", opts),
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
          formatTimeRelative(ms(-10 * 60_000), 60 * 60_000, "fr", opts),
        ],
        [
          "-10min",
          "1h",
          "en",
          formatTimeRelative(ms(-10 * 60_000), 60 * 60_000, "en", opts),
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
          formatTimeRelative(ms(-3 * 3_600_000), 3_600_000, "fr", opts),
        ],
        ["-5min", 0, "fr", formatTimeRelative(ms(-5 * 60_000), 0, "fr", opts)],
      ],
    );
  });
});
