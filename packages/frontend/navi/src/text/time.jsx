import {
  formatDatetime,
  formatDay,
  formatMonth,
  formatTime,
  formatTimeAgo,
  formatTimeRelative,
} from "./format_time.js";
import { langSignal } from "./lang_signal.js";
import { Text } from "./text.jsx";

/**
 * Displays a date/time value in a human-readable format using the current locale.
 *
 * @param {Date|number|string} children
 *   The date to display. Accepts:
 *   - a `Date` instance
 *   - a Unix timestamp (number, in ms)
 *   - a date string `"YYYY-MM-DD"` or any string parseable by `Date`
 *   If the value cannot be parsed, it is rendered as-is.
 *   If undefined/null, renders `"–"`.
 *
 * @param {"day"|"month"|"datetime"|"time"|"ago"|"relative"} [type="day"]
 *   Controls the display format:
 *   - `"day"`       → "lundi 11 mai (aujourd'hui)"  — with today/tomorrow label
 *   - `"month"`     → "mai 2026"
 *   - `"datetime"`  → "lun. 11 mai, 14:30"
 *   - `"time"`      → "14:30"
 *   - `"ago"`       → "il y a 3 jours" (simple past only)
 *   - `"relative"`  → "dans 1 heure 30" / "En cours" / "il y a 2 heures"
 *                     Prefer this over `"ago"` — handles past, present, and future.
 *                     `eventDuration` defaults to 0 (instantaneous: no "En cours" window).
 *
 * @param {number} [eventDuration=0]
 *   Duration of the event in milliseconds. Only used with `type="relative"`.
 *   When omitted, the event is instantaneous (point in time, no "En cours" window).
 * @param {string} [prefix]
 *   Custom prefix to replace "il y a" / "ago" for past times.
 *   Only applies to `type="ago"` and the past state of `type="relative"`.
 *   E.g. `prefix="depuis"` → "depuis 2 heures".
 * @param {string} [locale]
 *   BCP 47 locale tag (e.g. `"fr"`, `"en-US"`).
 *   Defaults to `langSignal.value` (the browser's current language).
 */
export const Time = ({
  children,
  type = "day",
  eventDuration = 0,
  prefix,
  locale,
  ...props
}) => {
  const date = toDate(children, type);
  const lang = locale || langSignal.value;

  let text;
  let dateTimeAttr;

  if (type === "relative") {
    text = date
      ? formatTimeRelative(date, eventDuration, lang, { prefix })
      : children === undefined
        ? "–"
        : String(children);
    dateTimeAttr = date ? date.toISOString() : undefined;
  } else {
    text = date
      ? formatDate(date, type, lang, { prefix })
      : children === undefined
        ? "–"
        : String(children);
    dateTimeAttr = date ? toDateTimeAttr(date, type) : undefined;
  }

  return (
    <Text as="time" dateTime={dateTimeAttr} {...props}>
      {text}
    </Text>
  );
};

const toDate = (value, type) => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "number") {
    return new Date(value);
  }
  if (typeof value === "string") {
    // "HH:MM" or "HH:MM:SS" — only meaningful for type="time"
    if (type === "time" && /^\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
      const d = new Date(`1970-01-01T${value}`);
      return isNaN(d.getTime()) ? null : d;
    }
    // "YYYY-MM" — only meaningful for type="month", avoid UTC shift
    if (type === "month" && /^\d{4}-\d{2}$/.test(value)) {
      const d = new Date(`${value}-01T00:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }
    // "YYYY-MM-DD" — use local midnight to avoid UTC shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(`${value}T00:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }
    // ISO / other parseable strings
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

// Produces a machine-readable value for the HTML `datetime` attribute.
// See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time#datetime
const toDateTimeAttr = (date, type) => {
  if (type === "time") {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  if (type === "month") {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  }
  if (type === "datetime" || type === "ago" || type === "relative") {
    return date.toISOString();
  }
  // day
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatDate = (date, type, locale, { prefix } = {}) => {
  if (type === "day") {
    return formatDay(date, locale);
  }
  if (type === "month") {
    return formatMonth(date, locale);
  }
  if (type === "datetime") {
    return formatDatetime(date, locale);
  }
  if (type === "time") {
    return formatTime(date, locale);
  }
  if (type === "ago") {
    return formatTimeAgo(date, locale, { prefix });
  }
  return String(date);
};
