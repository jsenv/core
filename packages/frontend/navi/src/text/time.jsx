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
 *   If undefined, renders `"–"`.
 *
 * @param {"day"|"month"|"datetime"|"time"|"relative"} [type="day"]
 *   Controls the display format:
 *   - `"day"`      → "lundi 11 mai"
 *   - `"month"`    → "mai 2026"
 *   - `"datetime"` → "lun. 11 mai, 14:30"
 *   - `"time"`     → "14:30"
 *   - `"relative"` → "il y a 3 jours"
 *
 * @param {string} [locale]
 *   BCP 47 locale tag (e.g. `"fr"`, `"en-US"`).
 *   Defaults to `langSignal.value` (the browser's current language).
 */
export const Time = ({ children, type = "day", locale, ...props }) => {
  const date = toDate(children, type);
  const lang = locale || langSignal.value;
  const text = date
    ? formatDate(date, type, lang)
    : children === undefined
      ? "–"
      : String(children);
  const dateTimeAttr = date ? toDateTimeAttr(date, type) : undefined;

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
  // day / datetime / relative → full ISO date (or datetime)
  if (type === "datetime" || type === "relative") {
    return date.toISOString();
  }
  // day
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatDate = (date, type, locale) => {
  if (type === "day") {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(date);
  }
  if (type === "month") {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(date);
  }
  if (type === "datetime") {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
  if (type === "time") {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
  if (type === "relative") {
    return formatRelative(date, locale);
  }
  return String(date);
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const formatRelative = (date, locale) => {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diff = date.getTime() - Date.now();
  const absDiff = Math.abs(diff);

  if (absDiff < MINUTE) {
    return rtf.format(Math.round(diff / SECOND), "second");
  }
  if (absDiff < HOUR) {
    return rtf.format(Math.round(diff / MINUTE), "minute");
  }
  if (absDiff < DAY) {
    return rtf.format(Math.round(diff / HOUR), "hour");
  }
  if (absDiff < WEEK) {
    return rtf.format(Math.round(diff / DAY), "day");
  }
  if (absDiff < MONTH) {
    return rtf.format(Math.round(diff / WEEK), "week");
  }
  if (absDiff < YEAR) {
    return rtf.format(Math.round(diff / MONTH), "month");
  }
  return rtf.format(Math.round(diff / YEAR), "year");
};
