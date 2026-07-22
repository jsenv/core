/**
 * Pure vanilla JS time formatting utilities.
 * All functions accept an optional `{ now }` parameter for testability.
 */

import { parseDuration } from "@jsenv/validity";

import { languagesSignal } from "./lang_signal.js";
import { naviI18n } from "./navi_i18n.js";

// Our own compact/custom duration notation interpolates raw numbers
// directly (unlike Intl.DurationFormat, which groups thousands on its own,
// e.g. "5 400 secondes") — this keeps that consistent without reimplementing
// locale-aware grouping. Falls back to the raw value as-is for a
// non-numeric mid-edit value (e.g. "2a"), which Intl.NumberFormat can't
// format anyway.
const formatCompactNumber = (value, lang) => {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat(lang).format(n) : value;
};

/**
 * Formats a date as a human-readable day string.
 *
 * @param {Date} date
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"numeric" }} [options]
 *
 * @example
 * formatDay(new Date(), { lang: "fr" })                    // "lundi 11 mai" (long, default)
 * formatDay(new Date(), { lang: "fr", format: "short" })  // "lun. 11 mai"
 * formatDay(new Date(), { lang: "fr", format: "narrow" }) // "lu. 11 mai"
 * formatDay(new Date(), { lang: "fr", format: "numeric" }) // "11/05/2026"
 */
export const formatDay = (
  date,
  { lang = languagesSignal.value, format = "long" } = {},
) => {
  if (format === "numeric") {
    return new Intl.DateTimeFormat(lang, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }
  return new Intl.DateTimeFormat(lang, {
    weekday: format, // "long", "short", or "narrow"
    day: "numeric",
    month: format,
  }).format(date);
};

/**
 * Returns the day offset relative to now: -1 (yesterday), 0 (today), 1 (tomorrow), or the
 * actual number of days difference for any other date.
 */
export const getRelativeDay = (date, { now = new Date() } = {}) => {
  const dateKey = toLocalDayKey(date);

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  if (dateKey === toLocalDayKey(yesterdayDate)) {
    return -1;
  }

  if (dateKey === toLocalDayKey(now)) {
    return 0;
  }

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  if (dateKey === toLocalDayKey(tomorrowDate)) {
    return 1;
  }

  const nowMidnight = new Date(now);
  nowMidnight.setHours(0, 0, 0, 0);
  const dateMidnight = new Date(date);
  dateMidnight.setHours(0, 0, 0, 0);
  return Math.round((dateMidnight - nowMidnight) / DAY);
};

/**
 * Formats a relative day offset (-1/0/1) as a locale-aware label: "hier", "aujourd'hui", "demain".
 */
// ── Placeholder helpers ────────────────────────────────────────────────────
// Derive locale-aware format placeholders from Intl.DateTimeFormat.formatToParts
// using a sentinel date whose parts are unambiguous (day=28, month=11, year=9999).
// Per-language token tables cover the most common locales; unknown langs fall
// back to "dd/mm/yyyy".

const SENTINEL_DATE = new Date(9999, 10, 28); // 28 Nov 9999 — day≠month, both 2-digit

const getToken = (key, lang) =>
  naviI18n(`time.placeholder.${key}`, undefined, { lang });

export const formatDatePlaceholder = ({
  lang = languagesSignal.value,
} = {}) => {
  const parts = new Intl.DateTimeFormat(lang, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(SENTINEL_DATE);
  return parts
    .map((p) => {
      if (p.type === "day") {
        return getToken("day", lang);
      }
      if (p.type === "month") {
        return getToken("month", lang);
      }
      if (p.type === "year") {
        return getToken("year", lang);
      }
      return p.value;
    })
    .join("");
};

export const formatMonthPlaceholder = ({
  lang = languagesSignal.value,
  format = "long",
} = {}) => {
  const parts = new Intl.DateTimeFormat(lang, {
    month: format,
    year: "numeric",
  }).formatToParts(SENTINEL_DATE);
  return parts
    .map((p) => {
      if (p.type === "month") {
        // Text month formats (long/short/narrow) → dash; numeric → token
        return format === "numeric" ? "–" : getToken("month", lang);
      }
      if (p.type === "year") {
        return getToken("year", lang);
      }
      return p.value;
    })
    .join("");
};

export const formatWeekPlaceholder = ({
  lang = languagesSignal.value,
} = {}) => {
  return `${getToken("week", lang)} xx / ${getToken(lang)}`;
};

export const formatDatetimePlaceholder = ({
  lang = languagesSignal.value,
  format = "long",
} = {}) => {
  const intlOptions =
    format === "long"
      ? {
          weekday: "short",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        }
      : format === "narrow"
        ? {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }
        : {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          };
  const parts = new Intl.DateTimeFormat(lang, intlOptions).formatToParts(
    SENTINEL_DATE,
  );
  let skipNext = false;
  return parts
    .map((p) => {
      if (p.type === "weekday") {
        skipNext = true;
        return "";
      }
      if (p.type === "literal" && skipNext) {
        skipNext = false;
        return "";
      }
      skipNext = false;
      if (p.type === "day") {
        return getToken("day", lang);
      }
      if (p.type === "month") {
        return getToken("month", lang);
      }
      if (p.type === "hour") {
        return getToken("hour", lang);
      }
      if (p.type === "minute") {
        return getToken("minute", lang);
      }
      return p.value;
    })
    .join("")
    .trim();
};

// ── End placeholder helpers ────────────────────────────────────────────────

export const formatDayRelative = (offset, lang) => {
  const relativeDay = new Intl.RelativeTimeFormat(lang, {
    numeric: "auto",
  }).format(offset, "day");
  return relativeDay;
};

export const formatMonth = (
  date,
  { lang = languagesSignal.value, format = "long" } = {},
) => {
  return new Intl.DateTimeFormat(lang, {
    month: format, // "long", "short", or "narrow"
    year: "numeric",
  }).format(date);
};

/**
 * Formats a date as "lun. 11 mai, 14:30" (long), "11 mai, 14:30" (short), "11/05, 14:30" (narrow).
 */
export const formatDatetime = (
  date,
  { lang = languagesSignal.value, format = "long" } = {},
) => {
  if (format === "long") {
    return new Intl.DateTimeFormat(lang, {
      weekday: "short",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
  if (format === "narrow") {
    return new Intl.DateTimeFormat(lang, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
  // "short": no weekday
  return new Intl.DateTimeFormat(lang, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

/**
 * Formats a date as "14:30".
 */
export const formatTime = (date, lang) => {
  return new Intl.DateTimeFormat(lang, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

/**
 * Formats a duration expressed in minutes as a human-readable string.
 * "long", "short", "narrow" delegate to Intl.DurationFormat.
 * "compact" uses our own notation that omits the minute symbol when hours are present.
 *
 * @param {number} minutes
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact", clockStyle?: boolean }} [options]
 * @param {boolean} [options.clockStyle=false] - Set this when `minutes`
 *   represents a time-of-day rather than a real duration (used by
 *   `<Time type="time">`, see time.jsx's own TimeTime) — affects two
 *   things at once, both consequences of a clock's "0" being a meaningful
 *   hour rather than "no hours":
 *   - a zero-hours component is normally dropped entirely (a real 5-minute
 *     duration should print as "5 minutes", not "0 hours 5 minutes"); this
 *     keeps it instead (e.g. "0 h et 5 min"/"0h 5min"/"00h05") so midnight
 *     doesn't collapse to something indistinguishable from an actual
 *     5-minute duration.
 *   - `format: "compact"` also zero-pads a single-digit hour to 2 digits
 *     (e.g. "5h30" → "05h30"), so it reads closer to a "05:30" clock.
 *   Must not be set for plain duration formatting.
 *
 * @example
 * formatMinuteDuration(90, { lang: "fr" })                       // "1 heure 30 minutes" (long, default)
 * formatMinuteDuration(90, { lang: "fr", format: "short" })     // "1 h et 30 min" (Intl short)
 * formatMinuteDuration(90, { lang: "fr", format: "narrow" })    // "1h 30min" (Intl narrow)
 * formatMinuteDuration(90, { lang: "fr", format: "compact" })   // "1h30" (custom, no minute symbol)
 * formatMinuteDuration(45, { lang: "en", format: "compact" })   // "45min"
 * formatMinuteDuration(5, { lang: "fr", format: "narrow", clockStyle: true }) // "0h 5min"
 * formatMinuteDuration(330, { lang: "fr", format: "compact", clockStyle: true }) // "05h30"
 */
export const formatMinuteDuration = (
  minutes,
  { lang = languagesSignal.value, format = "long", clockStyle = false } = {},
) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (format !== "compact" && typeof Intl.DurationFormat !== "undefined") {
    const fmt = new Intl.DurationFormat(lang, {
      style: format, // "long", "short", or "narrow"
      ...(clockStyle ? { hoursDisplay: "always" } : {}),
    });
    if (h === 0 && !clockStyle) {
      return fmt.format({ minutes: m });
    }
    if (m === 0) {
      return fmt.format({ hours: h });
    }
    return fmt.format({ hours: h, minutes: m });
  }
  // format="compact": "1h30", "45min", "2h" — no minute symbol when hours are present
  const hSym = naviI18n("time.duration.hour_symbol", undefined, { lang });
  const mSym = naviI18n("time.duration.minute_symbol", undefined, { lang });
  const hStr = clockStyle
    ? String(h).padStart(2, "0")
    : formatCompactNumber(h, lang);
  if (h === 0 && !clockStyle) {
    return `${m}${mSym}`;
  }
  if (m === 0) {
    return `${hStr}${hSym}`;
  }
  return `${hStr}${hSym}${String(m).padStart(2, "0")}`;
};

/**
 * Formats a duration expressed in hours (possibly fractional) as a human-readable string.
 * Delegates to {@link formatMinuteDuration} after converting hours to minutes.
 *
 * @param {number} hours
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact" }} [options]
 *
 * @example
 * formatHourDuration(1.5, { lang: "fr" })                       // "1 heure 30 minutes" (long, default)
 * formatHourDuration(1.5, { lang: "fr", format: "compact" })   // "1h30"
 * formatHourDuration(2, { lang: "en", format: "compact" })     // "2h"
 */
export const formatHourDuration = (hours, options) => {
  const totalMinutes = Math.round(hours * 60);
  return formatMinuteDuration(totalMinutes, options);
};

/**
 * Formats a duration expressed in seconds as a human-readable string.
 * "long", "short", "narrow" delegate to Intl.DurationFormat.
 * "compact" uses our own symbol-based notation.
 *
 * @param {number} seconds
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact" }} [options]
 *
 * @example
 * formatSecondDuration(90, { lang: "fr" })                       // "1 minute 30 secondes" (long, default)
 * formatSecondDuration(90, { lang: "fr", format: "short" })     // "1 min. et 30 s." (Intl short)
 * formatSecondDuration(90, { lang: "fr", format: "narrow" })    // "1min 30s" (Intl narrow)
 * formatSecondDuration(90, { lang: "fr", format: "compact" })   // "1m30s" (custom)
 * formatSecondDuration(45, { lang: "en", format: "compact" })   // "45s"
 */
export const formatSecondDuration = (
  seconds,
  { lang = languagesSignal.value, format = "long" } = {},
) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (format !== "compact" && typeof Intl.DurationFormat !== "undefined") {
    const fmt = new Intl.DurationFormat(lang, { style: format });
    const duration = {};
    if (h > 0) duration.hours = h;
    if (m > 0) duration.minutes = m;
    if (s > 0 || (h === 0 && m === 0)) duration.seconds = s;
    return fmt.format(duration);
  }
  // compact: "1h30m45s", "1m30s", "45s"
  const hSym = naviI18n("time.duration.hour_symbol", undefined, { lang });
  const mSym = naviI18n("time.duration.minute_symbol", undefined, { lang });
  const sSym = naviI18n("time.duration.second_symbol", undefined, { lang });
  const parts = [];
  // m/s are always 0-59 by construction (never need grouping); h can be
  // arbitrarily large for a long duration.
  if (h > 0) parts.push(`${formatCompactNumber(h, lang)}${hSym}`);
  if (m > 0) parts.push(`${m}${mSym}`);
  if (s > 0 || parts.length === 0) parts.push(`${s}${sSym}`);
  return parts.join("");
};

/**
 * Formats a duration object as a human-readable string.
 * Reads the parts directly — no conversion to seconds — so years/months/days
 * are preserved as-is and non-numeric mid-edit values (e.g. "2a") are rendered
 * with their unit symbol rather than being stringified.
 *
 * @param {{ years?: any, months?: any, weeks?: any, days?: any,
 *           hours?: any, minutes?: any, seconds?: any, milliseconds?: any }} duration
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact" }} [options]
 *
 * @example
 * formatDuration({ hours: 2, minutes: 15 }, { lang: "fr" })                       // "2 heures 15 minutes" (long, default)
 * formatDuration({ hours: 2, minutes: 15 }, { lang: "fr", format: "short" })     // "2 h et 15 min" (Intl short)
 * formatDuration({ hours: 2, minutes: 15 }, { lang: "fr", format: "narrow" })    // "2h 15min" (Intl narrow)
 * formatDuration({ hours: 2, minutes: 15 }, { lang: "fr", format: "compact" })   // "2h15" (custom, no minute symbol)
 * formatDuration({ minutes: 45 }, { lang: "fr", format: "compact" })             // "45min"
 * formatDuration({ hours: "2a", minutes: "15" }, { lang: "fr", format: "compact" }) // "2ah15"
 */
export const formatDuration = (
  duration,
  { lang = languagesSignal.value, format = "long" } = {},
) => {
  if (typeof duration === "string") {
    duration = parseDuration(duration) ?? {};
  } else if (typeof duration === "number") {
    duration = { seconds: duration };
  }
  const has = (key) => duration[key] !== undefined && duration[key] !== null;

  // "long" and "narrow" delegate to Intl.DurationFormat when available and all values are numeric.
  //
  // "short" always uses our own compact symbols ("2h15", "45min") because:
  // 1. We omit the minute symbol when hours are also present ("2h15" not "2h 15 min"),
  //    which Intl.DurationFormat style:"narrow" does not do.
  // 2. Non-numeric mid-edit values (e.g. { hours: "2a" }) must render as-is with their
  //    unit symbol — Intl.DurationFormat only accepts integers.
  if (format !== "compact" && typeof Intl.DurationFormat !== "undefined") {
    const intlDuration = {};
    let allNumeric = true;
    let hasNegative = false;
    let hasPositive = false;
    for (const key of [
      "years",
      "months",
      "weeks",
      "days",
      "hours",
      "minutes",
      "seconds",
      "milliseconds",
    ]) {
      if (!has(key)) {
        continue;
      }
      const n = Number(duration[key]);
      if (!isFinite(n)) {
        allNumeric = false;
        break;
      }
      if (n < 0) {
        hasNegative = true;
      } else if (n > 0) {
        hasPositive = true;
      }
      intlDuration[key] = n;
    }
    // Temporal requires all components to share the same sign.
    // Mixed-sign values (e.g. { hours: -1, minutes: 15 }) throw a RangeError.
    if (
      allNumeric &&
      Object.keys(intlDuration).length > 0 &&
      !(hasNegative && hasPositive)
    ) {
      return new Intl.DurationFormat(lang, { style: format }).format(
        intlDuration,
      );
    }
    // Fall through to compact notation when values are non-numeric or mixed-sign
  }

  // A component explicitly present but numerically zero (e.g. the demo's own
  // { hours: 0, minutes: 5 }) conveys no information for a genuine duration
  // — same convention formatMinuteDuration/formatSecondDuration already
  // follow (checking h > 0/m > 0, not merely "was a value passed") — so
  // it's dropped here too, regardless of whether the caller included the
  // key at all. Non-numeric mid-edit values (e.g. "2a") still count as
  // present — Number("2a") is NaN, never === 0 — so those keep rendering
  // as-is with their own unit symbol.
  const hasNonZero = (key) => has(key) && Number(duration[key]) !== 0;

  const sym = (key) =>
    naviI18n(`time.duration.${key}_symbol`, undefined, { lang });
  const parts = [];

  if (hasNonZero("years")) {
    parts.push(`${formatCompactNumber(duration.years, lang)}${sym("year")}`);
  }
  if (hasNonZero("months")) {
    parts.push(`${formatCompactNumber(duration.months, lang)}${sym("month")}`);
  }
  if (hasNonZero("weeks")) {
    parts.push(`${formatCompactNumber(duration.weeks, lang)}${sym("week")}`);
  }
  if (hasNonZero("days")) {
    parts.push(`${formatCompactNumber(duration.days, lang)}${sym("day")}`);
  }

  // Hours + minutes: when both present, pad minutes to 2 digits after the h
  // symbol — minutes stays a plain 2-digit pad (it's always 0-59 by
  // convention), only hours goes through grouping.
  const hSym = sym("hour");
  const mSym = sym("minute");
  if (hasNonZero("hours") && hasNonZero("minutes")) {
    parts.push(
      `${formatCompactNumber(duration.hours, lang)}${hSym}${String(duration.minutes).padStart(2, "0")}`,
    );
  } else if (hasNonZero("hours")) {
    parts.push(`${formatCompactNumber(duration.hours, lang)}${hSym}`);
  } else if (hasNonZero("minutes")) {
    parts.push(`${formatCompactNumber(duration.minutes, lang)}${mSym}`);
  }

  if (hasNonZero("seconds")) {
    parts.push(`${formatCompactNumber(duration.seconds, lang)}${sym("second")}`);
  }
  if (hasNonZero("milliseconds")) {
    parts.push(
      `${formatCompactNumber(duration.milliseconds, lang)}${sym("millisecond")}`,
    );
  }
  return parts.join("") || "0";
};

/**
 * Formats a date relative to now: "il y a 3 jours", "dans 2 heures", etc.
 */
const formatTimeAgo = (
  date,
  {
    lang = languagesSignal.value,
    now = new Date(),
    bare,
    format = "long",
  } = {},
) => {
  const rtf = new Intl.RelativeTimeFormat(lang, {
    numeric: "auto",
    style: format,
  });
  const nowMs = now instanceof Date ? now.getTime() : now;
  const diff = date.getTime() - nowMs;
  const absDiff = Math.abs(diff);

  let value;
  let unit;
  if (absDiff < MINUTE) {
    value = Math.round(diff / 1000);
    unit = "second";
  } else if (absDiff < HOUR) {
    value = Math.round(diff / MINUTE);
    unit = "minute";
  } else if (absDiff < DAY) {
    value = Math.round(diff / HOUR);
    unit = "hour";
  } else if (absDiff < 7 * DAY) {
    value = Math.round(diff / DAY);
    unit = "day";
  } else if (absDiff < 30 * DAY) {
    value = Math.round(diff / (7 * DAY));
    unit = "week";
  } else if (absDiff < YEAR) {
    value = Math.round(diff / (30 * DAY));
    unit = "month";
  } else {
    value = Math.round(diff / YEAR);
    unit = "year";
  }

  if (!bare || value >= 0) {
    return rtf.format(value, unit);
  }
  // Drop the leading past-tense literal ("il y a ", "ago ") — keep only integer + unit.
  const parts = rtf.formatToParts(value, unit);
  const integerIndex = parts.findIndex((p) => p.type === "integer");
  return parts
    .slice(integerIndex)
    .map((p) => p.value)
    .join("")
    .trim();
};

/**
 * Formats a timed event with an optional duration window.
 *
 * States:
 * - Future  (now < start)              → "dans 1 heure 30", "demain à 15h", …
 * - Ongoing (start ≤ now < start+dur)  → "En cours"
 * - Past    (now ≥ start+dur)          → relative ("il y a 2 heures", …)
 *
 * @param {Date|number} start      Start of the event (Date or ms timestamp)
 * @param {number}      durationMs Duration in milliseconds (0 = instant event)
 * @param {{ lang?: string, now?: Date|number, bare?: boolean, format?: "long"|"short"|"narrow" }} options
 *
 * @example
 * // 90 min from now
 * formatTimeRelative(Date.now() + 90 * 60_000, 0, { lang: "fr" }) // "dans 1 heure 30"
 * // currently happening (30 min window)
 * formatTimeRelative(Date.now() - 5 * 60_000, 30 * 60_000, { lang: "fr" }) // "En cours"
 * // ended 2 hours ago
 * formatTimeRelative(Date.now() - 3 * 3_600_000, 3_600_000, { lang: "fr" }) // "il y a 2 heures"
 * // short format
 * formatTimeRelative(Date.now() - 3 * 3_600_000, 0, { lang: "fr", format: "short" }) // "il y a 3 h"
 */
export const formatTimeRelative = (
  start,
  durationMs = 0,
  {
    lang = languagesSignal.value,
    now = new Date(),
    bare,
    format = "long",
  } = {},
) => {
  const startMs = start instanceof Date ? start.getTime() : Number(start);
  const endMs = startMs + durationMs;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);

  if (nowMs >= startMs && nowMs < endMs) {
    return getOngoingText(lang);
  }
  if (nowMs >= endMs) {
    const refDate = endMs > startMs ? new Date(endMs) : new Date(startMs);
    return formatTimeAgo(refDate, { lang, now, bare, format });
  }

  const diff = startMs - nowMs;
  return formatFuture(new Date(startMs), diff, { lang, now, format });
};

const formatFuture = (date, diff, { lang, now, format = "long" }) => {
  const rtf = new Intl.RelativeTimeFormat(lang, {
    numeric: "auto",
    style: format,
  });
  const nowDate = now instanceof Date ? now : new Date(now);

  // < 1 min
  if (diff < MINUTE) {
    return getLessThanMinuteText(lang);
  }

  // < 1 hour → "dans X minutes"
  if (diff < HOUR) {
    return rtf.format(Math.ceil(diff / MINUTE), "minute");
  }

  // 1h to 2h → "dans 1 heure 30"
  if (diff < 2 * HOUR) {
    const hours = Math.floor(diff / HOUR);
    const minutes = Math.round((diff % HOUR) / MINUTE);
    if (minutes === 0) {
      return rtf.format(hours, "hour");
    }
    const duration = formatMinuteDuration(hours * 60 + minutes, {
      lang,
      format,
    });
    const template = naviI18n("time.in_duration", undefined, { lang });
    if (template !== "time.in_duration") {
      return template.replace("[duration]", duration);
    }
    return `in ${duration}`;
  }

  // < 6h → "dans X heures" (precise enough, skip tomorrow label)
  if (diff < 6 * HOUR) {
    return rtf.format(Math.round(diff / HOUR), "hour");
  }

  // Tomorrow (calendar day) and within ~30h → "demain à 15h"
  const tomorrowDate = new Date(nowDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  if (diff < 30 * HOUR && toLocalDayKey(date) === toLocalDayKey(tomorrowDate)) {
    return formatTomorrowAt(date, lang);
  }

  // < 24h → "dans X heures"
  if (diff < DAY) {
    return rtf.format(Math.round(diff / HOUR), "hour");
  }

  // < 7 days → "dans X jours"
  if (diff < 7 * DAY) {
    return rtf.format(Math.round(diff / DAY), "day");
  }

  // < 30 days → "dans X semaines"
  if (diff < 30 * DAY) {
    return rtf.format(Math.round(diff / (7 * DAY)), "week");
  }

  // months (Intl handles "le mois prochain" when value = 1)
  if (diff < YEAR) {
    return rtf.format(Math.round(diff / (30 * DAY)), "month");
  }

  return rtf.format(Math.round(diff / YEAR), "year");
};

const formatTomorrowAt = (date, lang) => {
  const dayLabel = new Intl.RelativeTimeFormat(lang, {
    numeric: "auto",
  }).format(1, "day");
  const hasMinutes = date.getMinutes() !== 0;
  const timeLabel = new Intl.DateTimeFormat(lang, {
    hour: "numeric",
    ...(hasMinutes ? { minute: "2-digit" } : {}),
  }).format(date);
  const atTemplate = naviI18n("time.tomorrow_at", undefined, {
    lang,
  });
  // atTemplate is e.g. "[day] à [time]" — replace placeholders
  if (atTemplate !== "time.tomorrow_at") {
    return atTemplate.replace("[day]", dayLabel).replace("[time]", timeLabel);
  }
  // fallback: concatenate with a space
  return `${dayLabel} ${timeLabel}`;
};

const getLessThanMinuteText = (lang) => {
  return naviI18n("time.less_than_minute", undefined, { lang });
};

const getOngoingText = (lang) => {
  return naviI18n("time.ongoing", undefined, { lang });
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const YEAR = 365 * DAY;

// Compares calendar days in local time (ignores the clock time)
const toLocalDayKey = (date) => {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};
