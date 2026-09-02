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
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"numeric"|{ weekday?: "long"|"short"|"narrow", month?: "long"|"short"|"narrow"|"numeric" } }} [options]
 *   A string spells the weekday and the month the same way. An object spells
 *   them apart, each key defaulting to `"long"`: a narrow card usually wants
 *   the weekday whole (it is the reading anchor) and the month abbreviated (it
 *   is where the characters are — "septembre" is 9 of them, "sept." reads the
 *   same). `"numeric"` stays a string-only spelling: it drops the weekday and
 *   writes the whole date in digits.
 *
 * @example
 * formatDay(new Date(), { lang: "fr" })                    // "lundi 11 mai" (long, default)
 * formatDay(new Date(), { lang: "fr", format: "short" })  // "lun. 11 mai"
 * formatDay(new Date(), { lang: "fr", format: "narrow" }) // "lu. 11 mai"
 * formatDay(new Date(), { lang: "fr", format: "numeric" }) // "11/05/2026"
 * formatDay(new Date(), { lang: "fr", format: { weekday: "long", month: "short" } }) // "mercredi 2 sept."
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
  const { weekday = "long", month = "long" } =
    typeof format === "string" ? { weekday: format, month: format } : format;
  return new Intl.DateTimeFormat(lang, {
    weekday, // "long", "short", or "narrow"
    day: "numeric",
    month,
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
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact", clockStyle?: boolean, pad?: boolean, precision?: "hour"|"minute", forceUnit?: boolean }} [options]
 * @param {boolean} [options.forceUnit=false] - Keep the value in minutes
 *   however big it gets ("2160 minutes" instead of "1 jour et 12 heures").
 *   Past 24 hours the default promotes to days, which reads better but hides
 *   the unit the caller works in.
 * @param {boolean} [options.clockStyle=false] - Set this when `minutes`
 *   represents a time-of-day rather than a real duration (used by
 *   `<Time type="time">`, see time.jsx's own TimeTime). A clock's "0" is a
 *   meaningful hour rather than "no hours": a zero-hours component is
 *   normally dropped entirely (a real 5-minute duration should print as
 *   "5 minutes", not "0 hours 5 minutes"); this keeps it instead (e.g.
 *   "0 h et 5 min"/"0h 5min"/"00h05") so midnight doesn't collapse to
 *   something indistinguishable from an actual 5-minute duration.
 *   Must not be set for plain duration formatting.
 * @param {boolean} [options.pad=true] - Zero-pad the hour to 2 digits
 *   ("08h30" rather than "8h30"). `clockStyle` + `format: "compact"` only.
 * @param {"hour"|"minute"} [options.precision="minute"] - Whether a zero
 *   minute is written: `"minute"` keeps it ("10h00"), `"hour"` drops it
 *   ("10h"). `clockStyle` + `format: "compact"` only.
 *
 *   These last two are the clock's two independent shape choices, and only
 *   `format: "compact"` has to make them — the spelled-out formats put their
 *   units in words, so "10 heures"/"10 h"/"10h" already reads as a time of
 *   day whatever the padding, and they always write the hour bare and drop a
 *   zero minute. Padded + minute ("08h00") is the column shape, where every
 *   row occupies the same width; bare + hour ("8h", "8h30") is the shape a
 *   person speaks. Bare + minute ("8h00") only ever makes sense next to a
 *   partner that has minutes of its own — see `<TimeRange>`, which is the
 *   only thing that asks for it.
 *
 * @example
 * formatMinuteDuration(90, { lang: "fr" })                       // "1 heure 30 minutes" (long, default)
 * formatMinuteDuration(90, { lang: "fr", format: "short" })     // "1 h et 30 min" (Intl short)
 * formatMinuteDuration(90, { lang: "fr", format: "narrow" })    // "1h 30min" (Intl narrow)
 * formatMinuteDuration(90, { lang: "fr", format: "compact" })   // "1h30" (custom, no minute symbol)
 * formatMinuteDuration(45, { lang: "en", format: "compact" })   // "45min"
 * formatMinuteDuration(5, { lang: "fr", format: "narrow", clockStyle: true }) // "0h 5min"
 * formatMinuteDuration(330, { lang: "fr", format: "compact", clockStyle: true }) // "05h30"
 * formatMinuteDuration(600, { lang: "fr", format: "compact", clockStyle: true }) // "10h00"
 * formatMinuteDuration(600, { lang: "fr", format: "compact", clockStyle: true, pad: false }) // "10h00"
 * formatMinuteDuration(600, { lang: "fr", format: "compact", clockStyle: true, pad: false, precision: "hour" }) // "10h"
 * formatMinuteDuration(510, { lang: "fr", format: "compact", clockStyle: true, pad: false, precision: "hour" }) // "8h30"
 * formatMinuteDuration(2160, { lang: "fr" })                     // "1 jour et 12 heures"
 * formatMinuteDuration(2160, { lang: "fr", forceUnit: true })    // "2 160 minutes"
 */
export const formatMinuteDuration = (
  minutes,
  {
    lang = languagesSignal.value,
    format = "long",
    clockStyle = false,
    pad = true,
    precision = "minute",
    forceUnit = false,
  } = {},
) => {
  if (minutes < 0) {
    // the d/h/m split below only holds for a positive value; formatting the
    // magnitude and putting the sign back is the only reading that works
    return `-${formatMinuteDuration(-minutes, { lang, format, clockStyle, pad, precision, forceUnit })}`;
  }
  if (forceUnit || (minutes === 0 && !clockStyle)) {
    // a zero has nothing to promote to, and rendering it as an empty string
    // would be indistinguishable from a missing value
    return formatSingleUnit(minutes, "minute", { lang, format });
  }
  const totalHours = Math.floor(minutes / 60);
  const m = minutes % 60;
  // a time of day never goes past 24h, and its hour part is the clock hour
  const d = clockStyle ? 0 : Math.floor(totalHours / 24);
  const h = clockStyle ? totalHours : totalHours % 24;
  if (format !== "compact" && typeof Intl.DurationFormat !== "undefined") {
    const fmt = new Intl.DurationFormat(lang, {
      style: format, // "long", "short", or "narrow"
      ...(clockStyle ? { hoursDisplay: "always" } : {}),
    });
    const duration = {};
    if (d > 0) {
      duration.days = d;
    }
    if (h > 0 || clockStyle || d > 0) {
      duration.hours = h;
    }
    if (m > 0 || (d === 0 && h === 0)) {
      duration.minutes = m;
    }
    return fmt.format(duration);
  }
  // format="compact": "1j12h", "1h30", "45min", "2h" — no minute symbol when hours are present
  const dSym = naviI18n("time.duration.day_symbol", undefined, { lang });
  const hSym = naviI18n("time.duration.hour_symbol", undefined, { lang });
  const mSym = naviI18n("time.duration.minute_symbol", undefined, { lang });
  const dStr = d > 0 ? `${formatCompactNumber(d, lang)}${dSym}` : "";
  const hStr =
    clockStyle && pad
      ? String(h).padStart(2, "0")
      : formatCompactNumber(h, lang);
  if (d === 0 && h === 0 && !clockStyle) {
    return `${m}${mSym}`;
  }
  if (m === 0) {
    if (clockStyle) {
      // "10h00" on a clock, "2h" for a real 2 hours duration — except at
      // precision "hour", where a clock drops the zero minute too ("10h"),
      // the way one says it out loud
      return precision === "minute" ? `${hStr}${hSym}00` : `${hStr}${hSym}`;
    }
    return h === 0 ? dStr : `${dStr}${hStr}${hSym}`;
  }
  return `${dStr}${hStr}${hSym}${String(m).padStart(2, "0")}`;
};

// "forceUnit": stay in the unit the value is expressed in, however big it gets
const formatSingleUnit = (value, unit, { lang, format }) => {
  if (format !== "compact" && typeof Intl.DurationFormat !== "undefined") {
    return new Intl.DurationFormat(lang, {
      style: format,
      // Intl drops a zero-valued unit, and "0 minute" is the whole point here
      [`${unit}sDisplay`]: "always",
    }).format({
      [`${unit}s`]: value,
    });
  }
  const symbol = naviI18n(`time.duration.${unit}_symbol`, undefined, { lang });
  return `${formatCompactNumber(value, lang)}${symbol}`;
};

/**
 * Formats a duration expressed in hours (possibly fractional) as a human-readable string.
 * Delegates to {@link formatMinuteDuration} after converting hours to minutes.
 *
 * @param {number} hours
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact", forceUnit?: boolean }} [options]
 * @param {boolean} [options.forceUnit=false] - Keep the value in hours however
 *   big it gets ("36 heures" instead of "1 jour et 12 heures"). Ignored for a
 *   fractional value, which has no single-unit spelling.
 *
 * @example
 * formatHourDuration(1.5, { lang: "fr" })                       // "1 heure 30 minutes" (long, default)
 * formatHourDuration(1.5, { lang: "fr", format: "compact" })   // "1h30"
 * formatHourDuration(2, { lang: "en", format: "compact" })     // "2h"
 * formatHourDuration(36, { lang: "fr" })                        // "1 jour et 12 heures"
 * formatHourDuration(36, { lang: "fr", forceUnit: true })      // "36 heures"
 */
export const formatHourDuration = (hours, options = {}) => {
  const { lang = languagesSignal.value, format = "long", forceUnit } = options;
  if (hours === 0 || (forceUnit && Number.isInteger(hours))) {
    return formatSingleUnit(hours, "hour", { lang, format });
  }
  // a fractional value has no single-unit spelling, it needs its minutes
  const totalMinutes = Math.round(hours * 60);
  return formatMinuteDuration(totalMinutes, { ...options, forceUnit: false });
};

/**
 * Formats a duration expressed in seconds as a human-readable string.
 * "long", "short", "narrow" delegate to Intl.DurationFormat.
 * "compact" uses our own symbol-based notation.
 *
 * @param {number} seconds
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact", forceUnit?: boolean }} [options]
 * @param {boolean} [options.forceUnit=false] - Keep the value in seconds
 *   however big it gets ("90 000 secondes" instead of "1 jour et 1 heure").
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
  { lang = languagesSignal.value, format = "long", forceUnit = false } = {},
) => {
  if (seconds < 0) {
    // the d/h/m/s split below only holds for a positive value; formatting the
    // magnitude and putting the sign back is the only reading that works
    return `-${formatSecondDuration(-seconds, { lang, format, forceUnit })}`;
  }
  if (forceUnit || seconds === 0) {
    return formatSingleUnit(seconds, "second", { lang, format });
  }
  const totalHours = Math.floor(seconds / 3600);
  const d = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (format !== "compact" && typeof Intl.DurationFormat !== "undefined") {
    const fmt = new Intl.DurationFormat(lang, { style: format });
    const duration = {};
    if (d > 0) duration.days = d;
    if (h > 0) duration.hours = h;
    if (m > 0) duration.minutes = m;
    if (s > 0 || (d === 0 && h === 0 && m === 0)) duration.seconds = s;
    return fmt.format(duration);
  }
  // compact: "1d1h30m45s", "1h30m45s", "1m30s", "45s"
  const dSym = naviI18n("time.duration.day_symbol", undefined, { lang });
  const hSym = naviI18n("time.duration.hour_symbol", undefined, { lang });
  const mSym = naviI18n("time.duration.minute_symbol", undefined, { lang });
  const sSym = naviI18n("time.duration.second_symbol", undefined, { lang });
  const parts = [];
  // h/m/s are bounded by construction (never need grouping); d can be
  // arbitrarily large for a long duration.
  if (d > 0) parts.push(`${formatCompactNumber(d, lang)}${dSym}`);
  if (h > 0) parts.push(`${h}${hSym}`);
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
 * formatDuration({ hours: 0, minutes: 0 }, { lang: "fr" })                        // "0 minute"
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
      if (!hasNegative && !hasPositive) {
        return formatSingleUnit(0, smallestUnitOf(intlDuration), {
          lang,
          format,
        });
      }
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
  // as-is with their own unit symbol. When every component is zero there is
  // nothing left to drop, so the zero itself is rendered — see below.
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
    parts.push(
      `${formatCompactNumber(duration.seconds, lang)}${sym("second")}`,
    );
  }
  if (hasNonZero("milliseconds")) {
    parts.push(
      `${formatCompactNumber(duration.milliseconds, lang)}${sym("millisecond")}`,
    );
  }
  if (parts.length > 0) {
    return parts.join("");
  }
  // everything was zero: say so in the smallest unit the caller mentioned,
  // rather than a bare "0" whose unit the reader has to guess
  const smallestUnit = smallestUnitOf(duration);
  return smallestUnit ? `0${sym(smallestUnit)}` : "0";
};

const UNIT_KEYS = [
  "years",
  "months",
  "weeks",
  "days",
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
];
const smallestUnitOf = (duration) => {
  for (const key of [...UNIT_KEYS].reverse()) {
    if (duration[key] !== undefined && duration[key] !== null) {
      return key.slice(0, -1); // "seconds" -> "second"
    }
  }
  return null;
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
