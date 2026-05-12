/**
 * Pure vanilla JS time formatting utilities.
 * All functions accept an optional `{ now }` parameter for testability.
 */

import { naviI18n } from "./navi_i18n.js";

const DEFAULT_LANG = "en";

/**
 * Formats a date as a human-readable day, appending "(aujourd'hui)" or
 * "(demain)" when the date matches today or tomorrow.
 *
 * @example
 * formatDay(new Date(), "fr") // "lundi 11 mai (aujourd'hui)"
 * formatDay(tomorrow, "fr")   // "mardi 12 mai (demain)"
 * formatDay(nextWeek, "fr")   // "lundi 18 mai"
 */
export const formatDay = (date, locale, { now = new Date() } = {}) => {
  const base = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);

  const dateKey = toLocalDayKey(date);
  const todayKey = toLocalDayKey(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowKey = toLocalDayKey(tomorrowDate);

  if (dateKey === todayKey) {
    const label = new Intl.RelativeTimeFormat(locale, {
      numeric: "auto",
    }).format(0, "day");
    return `${base} (${label})`;
  }
  if (dateKey === tomorrowKey) {
    const label = new Intl.RelativeTimeFormat(locale, {
      numeric: "auto",
    }).format(1, "day");
    return `${base} (${label})`;
  }
  return base;
};

/**
 * Formats a date as "mai 2026".
 */
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
 * Formats a date relative to now: "il y a 3 jours", "dans 2 heures", etc.
 */
export const formatTimeAgo = (
  date,
  locale,
  { now = new Date(), prefix } = {},
) => {
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

  if (!prefix || value >= 0) {
    return rtf.format(value, unit);
  }
  // Drop the leading past-tense literal ("il y a ", "ago ") and prepend the custom prefix.
  // Slicing from the "integer" part keeps: integer + unit, drops the prefix.
  const parts = rtf.formatToParts(value, unit);
  const integerIndex = parts.findIndex((p) => p.type === "integer");
  const withoutPrefix = parts
    .slice(integerIndex)
    .map((p) => p.value)
    .join("")
    .trim();
  return `${prefix} ${withoutPrefix}`;
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
  { now = new Date(), prefix } = {},
) => {
  const startMs = start instanceof Date ? start.getTime() : Number(start);
  const endMs = startMs + durationMs;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);

  if (nowMs >= startMs && nowMs < endMs) {
    return getOngoingText(locale);
  }
  if (nowMs >= endMs) {
    const refDate = endMs > startMs ? new Date(endMs) : new Date(startMs);
    return formatTimeAgo(refDate, locale, { now, prefix });
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
    return formatHoursAndMinutes(hours, minutes, locale);
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

// "dans 1 heure 30" — colloquial format, built per language.
// The plural suffix is applied inline because it depends on the count;
// a plain string template cannot express this, so we keep it in JS.
const formatHoursAndMinutes = (hours, minutes, locale) => {
  const lang = (locale || "").split("-")[0];
  const templates = {
    fr: (h, m) => `dans ${h} heure${h > 1 ? "s" : ""} ${m}`,
    en: (h, m) => `in ${h} hour${h > 1 ? "s" : ""} ${m}`,
    de: (h, m) => `in ${h} Stunde${h > 1 ? "n" : ""} ${m}`,
    es: (h, m) => `en ${h} hora${h > 1 ? "s" : ""} ${m}`,
    it: (h, m) => `tra ${h} ora${h > 1 ? "e" : ""} ${m}`,
    pt: (h, m) => `em ${h} hora${h > 1 ? "s" : ""} ${m}`,
    nl: (h, m) => `over ${h} uur ${m}`,
  };
  const template = templates[lang] || templates[DEFAULT_LANG];
  return template(hours, minutes);
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
