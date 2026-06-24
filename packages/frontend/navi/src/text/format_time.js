/**
 * Pure vanilla JS time formatting utilities.
 * All functions accept an optional `{ now }` parameter for testability.
 */

import { naviI18n } from "./navi_i18n.js";

/**
 * Formats a date as a human-readable day, appending "(aujourd'hui)" or
 * "(demain)" when the date matches today or tomorrow.
 *
 * @example
 * formatDay(new Date(), "fr") // "lundi 11 mai (aujourd'hui)"
 * formatDay(tomorrow, "fr")   // "mardi 12 mai (demain)"
 * formatDay(nextWeek, "fr")   // "lundi 18 mai"
 */
export const formatDay = (
  date,
  locale,
  { long = false, numeric = false } = {},
) => {
  if (numeric) {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }
  const result = new Intl.DateTimeFormat(locale, {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
  }).format(date);
  return result;
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

const getToken = (key, locale) =>
  naviI18n(`time.placeholder.${key}`, undefined, { lang: locale });

export const formatDatePlaceholder = (locale) => {
  const parts = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(SENTINEL_DATE);
  return parts
    .map((p) => {
      if (p.type === "day") {
        return getToken("day", locale);
      }
      if (p.type === "month") {
        return getToken("month", locale);
      }
      if (p.type === "year") {
        return getToken("year", locale);
      }
      return p.value;
    })
    .join("");
};

export const formatMonthPlaceholder = (locale) => {
  const parts = new Intl.DateTimeFormat(locale, {
    month: "numeric",
    year: "numeric",
  }).formatToParts(SENTINEL_DATE);
  return parts
    .map((p) => {
      if (p.type === "month") {
        return getToken("month", locale);
      }
      if (p.type === "year") {
        return getToken("year", locale);
      }
      return p.value;
    })
    .join("");
};

export const formatWeekPlaceholder = (locale) => {
  return `${getToken("week", locale)} xx / ${getToken("year", locale)}`;
};

export const formatDatetimePlaceholder = (locale) => {
  const datePart = formatDatePlaceholder(locale);
  return `${datePart}, ${getToken("hour", locale)}:${getToken("minute", locale)}`;
};

// ── End placeholder helpers ────────────────────────────────────────────────

export const formatDayRelative = (offset, locale) => {
  const relativeDay = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
  }).format(offset, "day");
  return relativeDay;
};

export const formatMonth = (date, locale) => {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(date);
};

/**
 * Formats a date as "lun. 11 mai, 14:30".
 */
export const formatDatetime = (date, locale) => {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

/**
 * Formats a date as "14:30".
 */
export const formatTime = (date, locale) => {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

/**
 * Formats a duration expressed in minutes as a short human-readable string.
 * Uses Intl.DurationFormat when available, falls back to a compact notation.
 *
 * @param {number} minutes
 * @param {string} locale
 * @param {{ long?: boolean }} [options]
 *
 * @example
 * formatMinuteDuration(90, "fr")             // "1h30"        (compact, default)
 * formatMinuteDuration(90, "fr", { long: true }) // "1 heure 30" or "1 h 30 min" via Intl
 * formatMinuteDuration(45, "en")             // "45min"
 * formatMinuteDuration(120, "fr")            // "2h"
 */
export const formatMinuteDuration = (
  minutes,
  locale,
  { long = false } = {},
) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (long && typeof Intl.DurationFormat !== "undefined") {
    const fmt = new Intl.DurationFormat(locale, { style: "long" });
    if (h === 0) {
      return fmt.format({ minutes: m });
    }
    if (m === 0) {
      return fmt.format({ hours: h });
    }
    return fmt.format({ hours: h, minutes: m });
  }
  // Compact notation: "1h30", "45min", "2h"
  const hSym = naviI18n("time.duration.hour_symbol", undefined, {
    lang: locale,
  });
  const mSym = naviI18n("time.duration.minute_symbol", undefined, {
    lang: locale,
  });
  if (h === 0) {
    return `${m}${mSym}`;
  }
  if (m === 0) {
    return `${h}${hSym}`;
  }
  return `${h}${hSym}${String(m).padStart(2, "0")}`;
};

/**
 * Formats a duration expressed in hours (possibly fractional) as a short human-readable string.
 *
 * @param {number} hours
 * @param {string} locale
 * @param {{ long?: boolean }} [options]
 *
 * @example
 * formatHourDuration(1.5, "fr")              // "1h30"
 * formatHourDuration(1.5, "fr", { long: true }) // "1 heure 30" or "1 h 30 min" via Intl
 * formatHourDuration(2, "en")               // "2h"
 */
export const formatHourDuration = (hours, locale, { long = false } = {}) => {
  const totalMinutes = Math.round(hours * 60);
  return formatMinuteDuration(totalMinutes, locale, { long });
};

/**
 * Formats a duration object as a human-readable string.
 * Reads the parts directly — no conversion to seconds — so years/months/days
 * are preserved as-is and non-numeric mid-edit values (e.g. "2a") are rendered
 * with their unit symbol rather than being stringified.
 *
 * @param {{ years?: any, months?: any, weeks?: any, days?: any,
 *           hours?: any, minutes?: any, seconds?: any, milliseconds?: any }} duration
 * @param {string} locale
 * @param {{ long?: boolean }} [options]
 *
 * @example
 * formatDuration({ hours: 2, minutes: 15 }, "fr")               // "2h15"
 * formatDuration({ minutes: 45 }, "fr")                         // "45min"
 * formatDuration({ hours: 2 }, "fr")                            // "2h"
 * formatDuration({ hours: "2a", minutes: "15" }, "fr")          // "2ah15"
 * formatDuration({ days: 1, hours: 2, minutes: 15 }, "fr")      // "1d 2h15"
 * formatDuration({ hours: 1, minutes: 30 }, "fr", { long: true }) // "1 heure 30 minutes"
 */
export const formatDuration = (duration, locale, { long = false } = {}) => {
  const has = (key) => duration[key] !== undefined && duration[key] !== null;

  // Long mode delegates to Intl.DurationFormat (when available and all values are numeric)
  // because it produces correct locale-aware text like "1 heure 30 minutes".
  //
  // Compact mode always uses our own naviI18n symbols ("2h15", "45min") instead of
  // Intl.DurationFormat for two reasons:
  // 1. We omit the minute symbol when hours are also present ("2h15" not "2h 15 min"),
  //    which Intl.DurationFormat style:"narrow" does not do.
  // 2. Non-numeric mid-edit values (e.g. { hours: "2a" }) must render as-is with their
  //    unit symbol — Intl.DurationFormat only accepts integers.
  if (long && typeof Intl.DurationFormat !== "undefined") {
    const intlDuration = {};
    let allNumeric = true;
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
      intlDuration[key] = n;
    }
    if (allNumeric && Object.keys(intlDuration).length > 0) {
      return new Intl.DurationFormat(locale, { style: "long" }).format(
        intlDuration,
      );
    }
    // Fall through to compact notation when values are non-numeric
  }

  const sym = (key) =>
    naviI18n(`time.duration.${key}_symbol`, undefined, { lang: locale });
  const parts = [];

  if (has("years")) {
    parts.push(`${duration.years}${sym("year")}`);
  }
  if (has("months")) {
    parts.push(`${duration.months}${sym("month")}`);
  }
  if (has("weeks")) {
    parts.push(`${duration.weeks}${sym("week")}`);
  }
  if (has("days")) {
    parts.push(`${duration.days}${sym("day")}`);
  }

  // Hours + minutes: when both present, pad minutes to 2 digits after the h symbol
  const hSym = sym("hour");
  const mSym = sym("minute");
  if (has("hours") && has("minutes")) {
    parts.push(
      `${duration.hours}${hSym}${String(duration.minutes).padStart(2, "0")}`,
    );
  } else if (has("hours")) {
    parts.push(`${duration.hours}${hSym}`);
  } else if (has("minutes")) {
    parts.push(`${duration.minutes}${mSym}`);
  }

  if (has("seconds")) {
    parts.push(`${duration.seconds}${sym("second")}`);
  }
  if (has("milliseconds")) {
    parts.push(`${duration.milliseconds}${sym("millisecond")}`);
  }
  return parts.join("") || "0";
};

/**
 * Formats a date relative to now: "il y a 3 jours", "dans 2 heures", etc.
 */
const formatTimeAgo = (date, locale, { now = new Date(), bare } = {}) => {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
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
 * @param {string}      locale     BCP 47 locale tag
 * @param {{ now?: Date|number }} options
 *
 * @example
 * // 90 min from now
 * formatDuration(Date.now() + 90 * 60_000, 0, "fr") // "dans 1 heure 30"
 * // currently happening (30 min window)
 * formatDuration(Date.now() - 5 * 60_000, 30 * 60_000, "fr") // "En cours"
 * // ended 2 hours ago
 * formatDuration(Date.now() - 3 * 3_600_000, 3_600_000, "fr") // "il y a 2 heures"
 */
export const formatTimeRelative = (
  start,
  durationMs = 0,
  locale,
  { now = new Date(), bare } = {},
) => {
  const startMs = start instanceof Date ? start.getTime() : Number(start);
  const endMs = startMs + durationMs;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);

  if (nowMs >= startMs && nowMs < endMs) {
    return getOngoingText(locale);
  }
  if (nowMs >= endMs) {
    const refDate = endMs > startMs ? new Date(endMs) : new Date(startMs);
    return formatTimeAgo(refDate, locale, { now, bare });
  }

  const diff = startMs - nowMs;
  return formatFuture(new Date(startMs), diff, locale, { now });
};

const formatFuture = (date, diff, locale, { now }) => {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const nowDate = now instanceof Date ? now : new Date(now);

  // < 1 min
  if (diff < MINUTE) {
    return getLessThanMinuteText(locale);
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
    const duration = formatMinuteDuration(hours * 60 + minutes, locale, {
      long: true,
    });
    const template = naviI18n("time.in_duration", undefined, { lang: locale });
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
    return formatTomorrowAt(date, locale);
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

const formatTomorrowAt = (date, locale) => {
  const dayLabel = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
  }).format(1, "day");
  const hasMinutes = date.getMinutes() !== 0;
  const timeLabel = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    ...(hasMinutes ? { minute: "2-digit" } : {}),
  }).format(date);
  const atTemplate = naviI18n("time.tomorrow_at", undefined, {
    lang: locale,
  });
  // atTemplate is e.g. "[day] à [time]" — replace placeholders
  if (atTemplate !== "time.tomorrow_at") {
    return atTemplate.replace("[day]", dayLabel).replace("[time]", timeLabel);
  }
  // fallback: concatenate with a space
  return `${dayLabel} ${timeLabel}`;
};

const getLessThanMinuteText = (locale) => {
  return naviI18n("time.less_than_minute", undefined, { lang: locale });
};

const getOngoingText = (locale) => {
  return naviI18n("time.ongoing", undefined, { lang: locale });
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const YEAR = 365 * DAY;

// Compares calendar days in local time (ignores the clock time)
const toLocalDayKey = (date) => {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};
