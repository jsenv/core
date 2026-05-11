import assert from "node:assert/strict";

import {
  formatDay,
  formatDuration,
  formatMonth,
  formatTime,
  formatTimeAgo,
} from "../format_time.js";

// Fixed reference point: Monday 11 May 2026, 14:00:00 local time
const NOW = new Date("2026-05-11T14:00:00");
const opts = { now: NOW };

// ---------------------------------------------------------------------------
// formatDay
// ---------------------------------------------------------------------------
{
  // today: should include a parenthesized relative label
  const result = formatDay(new Date("2026-05-11T09:00:00"), "fr", opts);
  assert.ok(
    result.includes("(") && result.includes(")"),
    `today has parens — got: ${result}`,
  );
  // Intl may use typographic apostrophe (U+2019) in "aujourd'hui" — match loosely
  assert.ok(
    result.toLowerCase().includes("hui"),
    `today includes 'hui' — got: ${result}`,
  );
}
{
  // tomorrow: should include "(demain)"
  const result = formatDay(new Date("2026-05-12T09:00:00"), "fr", opts);
  assert.ok(result.includes("demain"), `tomorrow — got: ${result}`);
}
{
  // next week: no suffix
  const result = formatDay(new Date("2026-05-18T09:00:00"), "fr", opts);
  assert.ok(!result.includes("("), `next week — got: ${result}`);
}
{
  // english locale: today includes "today"
  const result = formatDay(new Date("2026-05-11T09:00:00"), "en", opts);
  assert.ok(result.includes("today"), `today en — got: ${result}`);
}
{
  // english locale: tomorrow includes "tomorrow"
  const result = formatDay(new Date("2026-05-12T09:00:00"), "en", opts);
  assert.ok(result.includes("tomorrow"), `tomorrow en — got: ${result}`);
}

// ---------------------------------------------------------------------------
// formatMonth
// ---------------------------------------------------------------------------
{
  const result = formatMonth(new Date("2026-05-01"), "fr");
  assert.ok(
    result.includes("mai") && result.includes("2026"),
    `month fr — got: ${result}`,
  );
}

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------
{
  const result = formatTime(new Date("2026-05-11T14:30:00"), "fr");
  assert.ok(
    result.includes("14") && result.includes("30"),
    `time fr — got: ${result}`,
  );
}

// ---------------------------------------------------------------------------
// formatRelative
// ---------------------------------------------------------------------------
{
  // 5 minutes ago
  const past = new Date(NOW.getTime() - 5 * 60_000);
  const result = formatTimeAgo(past, "fr", opts);
  assert.ok(
    result.includes("5") && result.includes("minute"),
    `5 min ago — got: ${result}`,
  );
}
{
  // in 2 hours
  const future = new Date(NOW.getTime() + 2 * 3_600_000);
  const result = formatTimeAgo(future, "fr", opts);
  assert.ok(
    result.includes("2") && result.includes("heure"),
    `in 2h — got: ${result}`,
  );
}
{
  // 3 days ago
  const past = new Date(NOW.getTime() - 3 * 86_400_000);
  const result = formatTimeAgo(past, "fr", opts);
  assert.ok(
    result.includes("3") && result.includes("jour"),
    `3 days ago — got: ${result}`,
  );
}

// ---------------------------------------------------------------------------
// formatDuration — future
// ---------------------------------------------------------------------------
{
  // 30 seconds → "dans moins d'une minute"
  const start = NOW.getTime() + 30_000;
  const result = formatDuration(start, 0, "fr", opts);
  assert.ok(
    result.includes("moins") && result.includes("minute"),
    `30s — got: ${result}`,
  );
}
{
  // 20 minutes → "dans 20 minutes"
  const start = NOW.getTime() + 20 * 60_000;
  const result = formatDuration(start, 0, "fr", opts);
  assert.ok(
    result.includes("20") && result.includes("minute"),
    `20min — got: ${result}`,
  );
}
{
  // 90 minutes → "dans 1 heure 30"
  const start = NOW.getTime() + 90 * 60_000;
  const result = formatDuration(start, 0, "fr", opts);
  assert.ok(
    result.includes("1") && result.includes("heure") && result.includes("30"),
    `90min — got: ${result}`,
  );
}
{
  // exactly 1 hour → "dans 1 heure" (no minutes)
  const start = NOW.getTime() + 60 * 60_000;
  const result = formatDuration(start, 0, "fr", opts);
  assert.ok(
    result.includes("1") && result.includes("heure"),
    `60min — got: ${result}`,
  );
  assert.ok(!result.includes(" 0"), `60min no zero — got: ${result}`);
}
{
  // 4 hours → "dans 4 heures"
  const start = NOW.getTime() + 4 * 3_600_000;
  const result = formatDuration(start, 0, "fr", opts);
  assert.ok(
    result.includes("4") && result.includes("heure"),
    `4h — got: ${result}`,
  );
}
{
  // tomorrow at 20h (NOW=14h, event=tomorrow 20h → diff=30h)
  // NOW is 2026-05-11 14:00, tomorrow = 2026-05-12, event at 20:00 → diff = 30h
  const start = new Date("2026-05-12T20:00:00");
  const result = formatDuration(start, 0, "fr", opts);
  assert.ok(result.includes("demain"), `tomorrow at 20h — got: ${result}`);
}
{
  // 3 days from now → "dans 3 jours"
  const start = NOW.getTime() + 3 * 86_400_000;
  const result = formatDuration(start, 0, "fr", opts);
  assert.ok(
    result.includes("3") && result.includes("jour"),
    `3 days — got: ${result}`,
  );
}
{
  // ~35 days → "le mois prochain"
  const start = NOW.getTime() + 35 * 86_400_000;
  const result = formatDuration(start, 0, "fr", opts);
  assert.ok(result.includes("mois"), `35 days — got: ${result}`);
}
{
  // ~65 days → "dans 2 mois"
  const start = NOW.getTime() + 65 * 86_400_000;
  const result = formatDuration(start, 0, "fr", opts);
  assert.ok(
    result.includes("2") && result.includes("mois"),
    `65 days — got: ${result}`,
  );
}

// ---------------------------------------------------------------------------
// formatDuration — ongoing
// ---------------------------------------------------------------------------
{
  // started 10 min ago, window = 1 hour → "En cours"
  const start = NOW.getTime() - 10 * 60_000;
  const result = formatDuration(start, 60 * 60_000, "fr", opts);
  assert.equal(result, "En cours", `ongoing — got: ${result}`);
}
{
  // english ongoing
  const start = NOW.getTime() - 10 * 60_000;
  const result = formatDuration(start, 60 * 60_000, "en", opts);
  assert.equal(result, "Ongoing", `ongoing en — got: ${result}`);
}

// ---------------------------------------------------------------------------
// formatDuration — past
// ---------------------------------------------------------------------------
{
  // ended 2 hours ago (started 3h ago, duration 1h)
  const start = NOW.getTime() - 3 * 3_600_000;
  const result = formatDuration(start, 3_600_000, "fr", opts);
  assert.ok(
    result.includes("2") && result.includes("heure"),
    `past 2h ago — got: ${result}`,
  );
}
{
  // instant event (duration=0) that happened 5 min ago
  const start = NOW.getTime() - 5 * 60_000;
  const result = formatDuration(start, 0, "fr", opts);
  assert.ok(
    result.includes("5") && result.includes("minute"),
    `past instant 5min — got: ${result}`,
  );
}

console.log("All format_time tests passed ✓");
