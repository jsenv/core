import { langSignal } from "./lang_signal.js";
import { Text } from "./text.jsx";

// type="day"      → "Lundi 11 Mai"        (jour de l'année, lisible)
// type="month"    → "Mai 2026"
// type="datetime" → "Lun. 11 Mai, 14:30"
// type="time"     → "14:30"
// type="relative" → "il y a 3 jours"

export const Time = ({ children, type = "day", locale, ...props }) => {
  const date = toDate(children);
  const lang = locale || langSignal.value;
  const text = date ? formatDate(date, type, lang) : String(children ?? "");

  return (
    <Text as="time" {...props}>
      {text}
    </Text>
  );
};

const toDate = (value) => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "number") {
    return new Date(value);
  }
  if (typeof value === "string") {
    // YYYY-MM-DD
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
