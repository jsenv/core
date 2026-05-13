import {
  formatDatetime,
  formatDay,
  formatMonth,
  formatTime,
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
 * @param {"day"|"month"|"datetime"|"time"|"relative"} [type="relative"]
 *   Controls the display format:
 *   - `"day"`       → "lundi 11 mai (aujourd'hui)"  — with today/tomorrow label
 *   - `"month"`     → "mai 2026"
 *   - `"datetime"`  → "lun. 11 mai, 14:30"
 *   - `"time"`      → "14:30"
 *   - `"relative"`  → "dans 1 heure 30" / "En cours" / "il y a 2 heures"
 *                     Handles past, present, and future.
 *                     `eventDuration` defaults to 0 (instantaneous: no "En cours" window).
 *
 * @param {number} [eventDuration=0]
 *   Duration of the event in milliseconds. Only used with `type="relative"`.
 *   When omitted, the event is instantaneous (point in time, no "En cours" window).
 * @param {boolean} [bare]
 *   When true, strips the past-tense literal ("il y a", "ago") and returns only integer + unit.
 *   Only applies to the past state of `type="relative"`.
 * @param {string} [locale]
 *   BCP 47 locale tag (e.g. `"fr"`, `"en-US"`).
 *   Defaults to `langSignal.value` (the browser's current language).
 */
export const Time = (props) => {
  const { type } = props;
  if (type === "day") {
    return <TimeDay {...props} />;
  }
  if (type === "month") {
    return <TimeMonth {...props} />;
  }
  if (type === "datetime") {
    return <TimeDatetime {...props} />;
  }
  if (type === "time") {
    return <TimeTime {...props} />;
  }
  return <TimeRelative {...props} />;
};

const TimeDay = ({ children, locale, ...props }) => {
  const lang = locale || langSignal.value;
  const date = toDate(children, "day");
  let text;
  let dateTime; // See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time#datetime
  if (date) {
    text = formatDay(date, lang);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    dateTime = `${yyyy}-${mm}-${dd}`;
  } else if (children === undefined) {
    text = "–";
  } else {
    text = String(children);
  }

  return (
    <TimeText dateTime={dateTime} {...props}>
      {text}
    </TimeText>
  );
};

const TimeMonth = ({ children, locale, ...props }) => {
  const lang = locale || langSignal.value;
  const date = toDate(children, "month");
  let text;
  let dateTime; // See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time#datetime
  if (date) {
    text = formatMonth(date, lang);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    dateTime = `${yyyy}-${mm}`;
  } else if (children === undefined) {
    text = "–";
  } else {
    text = String(children);
  }

  return (
    <TimeText dateTime={dateTime} {...props}>
      {text}
    </TimeText>
  );
};

const TimeDatetime = ({ children, locale, ...props }) => {
  const lang = locale || langSignal.value;
  const date = toDate(children, "datetime");
  let text;
  let dateTime; // See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time#datetime
  if (date) {
    text = formatDatetime(date, lang);
    dateTime = date.toISOString();
  } else if (children === undefined) {
    text = "–";
  } else {
    text = String(children);
  }

  return (
    <TimeText dateTime={dateTime} {...props}>
      {text}
    </TimeText>
  );
};

const TimeTime = ({ children, locale, ...props }) => {
  const lang = locale || langSignal.value;
  const date = toDate(children, "time");
  let text;
  let dateTime; // See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time#datetime
  if (date) {
    text = formatTime(date, lang);
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    dateTime = `${hh}:${mm}`;
  } else if (children === undefined) {
    text = "–";
  } else {
    text = children;
  }

  return (
    <TimeText dateTime={dateTime} {...props}>
      {text}
    </TimeText>
  );
};

const TimeRelative = ({
  children,
  locale,
  eventDuration = 0,
  bare,
  ...props
}) => {
  const lang = locale || langSignal.value;
  const date = toDate(children, "relative");
  let text;
  let dateTime;
  if (date) {
    text = formatTimeRelative(date, eventDuration, lang, { bare });
    dateTime = date.toISOString();
  } else if (children === undefined) {
    text = "–";
  } else {
    text = String(children);
  }

  return (
    <TimeText dateTime={dateTime} {...props}>
      {text}
    </TimeText>
  );
};

const TimeText = (props) => {
  return <Text as="time" {...props} />;
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
