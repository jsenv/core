import {
  durationToISOString,
  durationToSeconds,
  parseDuration,
} from "@jsenv/validity";
import {
  formatDatePlaceholder,
  formatDatetime,
  formatDatetimePlaceholder,
  formatDay,
  formatDayRelative,
  formatDuration,
  formatHourDuration,
  formatMinuteDuration,
  formatMonth,
  formatMonthPlaceholder,
  formatSecondDuration,
  formatTime,
  formatTimeRelative,
  formatWeekPlaceholder,
  getRelativeDay,
} from "./format_time.js";
import { languagesSignal } from "./lang_signal.js";
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
 * @param {"date"|"month"|"datetime"|"time"|"hour"|"minute"|"second"|"duration"|"relative"} [type="relative"]
 *   Controls the display format:
 *   - `"date"`     → "lundi 11 mai" (long by default); `format="short"` → "lun. 11 mai"; `format="numeric"` → "11/05/2026"
 *   - `"month"`    → "juin 2026"
 *   - `"datetime"` → "lun. 11 mai, 14:30" (long); `format="short"` → "11 mai, 14:30"; `format="narrow"` → "11/05, 14:30"
 *   - `"time"`     → time-of-day as duration by default; `format="timestring"` → clock "14 h 30"
 *   - `"hour"`     → hours as duration (e.g. 1.5 → "1 heure 30 minutes")
 *   - `"minute"`   → minutes as duration (e.g. 90 → "1 heure 30 minutes")
 *   - `"second"`   → seconds as duration (e.g. 90 → "1 minute 30 secondes")
 *   - `"duration"` → duration string/object/number (seconds); `format="iso"` → ISO 8601
 *   - `"relative"` → "dans 1 heure 30" / "En cours" / "il y a 2 heures"
 *                    Handles past, present, and future.
 *                    `eventDuration` defaults to 0 (instantaneous: no "En cours" window).
 *
 * @param {number} [eventDuration=0]
 *   Duration of the event in milliseconds. Only used with `type="relative"`.
 *   When omitted, the event is instantaneous (point in time, no "En cours" window).
 * @param {boolean} [bare]
 *   When true, strips the past-tense literal ("il y a", "ago") and returns only integer + unit.
 *   Only applies to the past state of `type="relative"`.
 * @param {"long"|"short"|"narrow"|"compact"|"numeric"|"timestring"|"iso"} [format="long"]
 *   Controls the verbosity of the output. Defaults to `"long"` for all types.
 *   - `"short"`      → Intl short (e.g. "2 h et 15 min", short month for dates/datetimes, no weekday for datetime)
 *   - `"narrow"`     → Intl narrow (e.g. "2h 15min", numeric month for datetime)
 *   - `"compact"`    → custom compact notation (e.g. "2h15", no minute symbol when hours present)
 *   - `"numeric"`    → numeric date, only for `type="date"` (e.g. "11/09/2026")
 *   - `"timestring"` → clock display for `type="time"`, `type="minute"`, `type="hour"`, and `type="second"` (e.g. "14:30", "01:30" for 90s)
 *   - `"iso"`        → ISO 8601 string, only for `type="duration"` (e.g. "PT2H15M")
 * @param {boolean} [dayLabel]
 *   When true and `type="date"`, appends the locale-aware relative label
 *   ("hier", "aujourd'hui", "demain") when the date is yesterday, today, or tomorrow.
 * @param {string} [lang]
 *   BCP 47 locale tag (e.g. `"fr"`, `"en-US"`).
 *   Defaults to `languagesSignal.value` (the browser's current language).
 */
export const Time = (props) => {
  const { type } = props;
  if (type === "date") {
    return <TimeDate {...props} />;
  }
  if (type === "month") {
    return <TimeMonth {...props} />;
  }
  if (type === "week") {
    return <TimeWeek {...props} />;
  }
  if (type === "datetime") {
    return <TimeDatetime {...props} />;
  }
  if (type === "time") {
    return <TimeTime {...props} />;
  }
  if (type === "minute") {
    return <TimeMinute {...props} />;
  }
  if (type === "second") {
    return <TimeSecond {...props} />;
  }
  if (type === "hour") {
    return <TimeHour {...props} />;
  }
  if (type === "duration") {
    return <TimeDuration {...props} />;
  }
  return <TimeRelative {...props} />;
};

const TimeDate = ({
  children,
  lang = languagesSignal.value,
  format = "long",
  dayLabel,
  now,
  ...props
}) => {
  if (children === undefined) {
    return (
      <TimeText {...props} capitalize={false}>
        {formatDatePlaceholder({ lang })}
      </TimeText>
    );
  }

  const date = toDate(children, (value) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(`${value}T00:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  });
  if (!date) {
    return <TimeText {...props}>{String(children)}</TimeText>;
  }

  const base = formatDay(date, { lang, format });
  let text;
  if (dayLabel) {
    const offset = getRelativeDay(date, { now });
    if (offset >= -1 && offset <= 1) {
      text = `${base} (${formatDayRelative(offset, lang)})`;
    } else {
      text = base;
    }
  } else {
    text = base;
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const dateTime = `${yyyy}-${mm}-${dd}`; // See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time#datetime
  return (
    <TimeText dateTime={dateTime} {...props}>
      {text}
    </TimeText>
  );
};

const TimeMonth = ({
  children,
  lang = languagesSignal.value,
  format = "long",
  ...props
}) => {
  if (children === undefined) {
    return (
      <TimeText {...props}>{formatMonthPlaceholder({ lang, format })}</TimeText>
    );
  }

  const date = toDate(children, (value) => {
    if (/^\d{4}-\d{2}$/.test(value)) {
      const d = new Date(`${value}-01T00:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  });
  if (!date) {
    return <TimeText {...props}>{String(children)}</TimeText>;
  }

  const text = formatMonth(date, { lang, format });
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dateTime = `${yyyy}-${mm}`; // See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time#datetime
  return (
    <TimeText dateTime={dateTime} {...props}>
      {text}
    </TimeText>
  );
};

const TimeWeek = ({ children, lang = languagesSignal.value, ...props }) => {
  if (children === undefined || children === null) {
    return <TimeText {...props}>{formatWeekPlaceholder({ lang })}</TimeText>;
  }

  const dateTime = String(children);
  return (
    <TimeText dateTime={dateTime} {...props}>
      {dateTime}
    </TimeText>
  );
};

const TimeDatetime = ({
  children,
  lang = languagesSignal.value,
  format = "long",
  ...props
}) => {
  if (children === undefined) {
    return (
      <TimeText {...props} capitalize={false}>
        {formatDatetimePlaceholder({ lang, format })}
      </TimeText>
    );
  }

  const date = toDate(children);
  if (!date) {
    return <TimeText {...props}>{String(children)}</TimeText>;
  }

  const text = formatDatetime(date, { lang, format });
  const dateTime = date.toISOString(); // See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time#datetime
  return (
    <TimeText dateTime={dateTime} {...props}>
      {text}
    </TimeText>
  );
};

const TimeTime = ({
  children,
  lang = languagesSignal.value,
  format = "long",
  ...props
}) => {
  if (children === undefined) {
    return <TimeText {...props}>--:--</TimeText>;
  }

  const date = toDate(children, (value) => {
    if (/^\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
      const d = new Date(`1970-01-01T${value}`);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  });
  if (!date) {
    return <TimeText {...props}>{children}</TimeText>;
  }

  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const dateTime = `${hh}:${mm}`; // See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time#datetime
  if (format === "timestring") {
    return (
      <TimeText dateTime={dateTime} {...props}>
        {formatTime(date, lang)}
      </TimeText>
    );
  }
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  const text = formatMinuteDuration(totalMinutes, { lang, format });
  return (
    <TimeText dateTime={dateTime} {...props}>
      {text}
    </TimeText>
  );
};

const TimeMinute = ({
  children,
  lang = languagesSignal.value,
  format = "long",
  ...props
}) => {
  if (children === undefined) {
    return (
      <TimeText {...props}>{format === "timestring" ? "--:--" : "--"}</TimeText>
    );
  }
  let minutes;
  if (typeof children === "number") {
    minutes = children;
  } else {
    const childrenAsNumber = Number(children);
    if (isNaN(childrenAsNumber)) {
      return <TimeText {...props}>{children}</TimeText>;
    }
    minutes = childrenAsNumber;
  }

  const totalHours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const hh = String(totalHours).padStart(2, "0");
  const mm = String(remainingMinutes).padStart(2, "0");
  const dateTime = `${hh}:${mm}`;
  let text;
  if (format === "timestring") {
    const date = new Date(1970, 0, 1, totalHours, remainingMinutes, 0);
    text = formatTime(date, lang);
  } else {
    text = formatMinuteDuration(minutes, { lang, format });
  }
  return (
    <TimeText dateTime={dateTime} {...props}>
      {text}
    </TimeText>
  );
};

const TimeSecond = ({
  children,
  lang = languagesSignal.value,
  format = "long",
  ...props
}) => {
  if (children === undefined) {
    return (
      <TimeText {...props}>
        {format === "timestring" ? "--:--:--" : "--"}
      </TimeText>
    );
  }
  let seconds;
  if (typeof children === "number") {
    seconds = children;
  } else {
    const n = Number(children);
    if (isNaN(n)) {
      return <TimeText {...props}>{children}</TimeText>;
    }
    seconds = n;
  }

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const dateTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  let text;
  if (format === "timestring") {
    // Always HH:MM:SS to avoid ambiguity with HH:MM time-of-day format
    text = dateTime;
  } else {
    text = formatSecondDuration(seconds, { lang, format });
  }
  return (
    <TimeText dateTime={dateTime} {...props}>
      {text}
    </TimeText>
  );
};

const TimeHour = ({
  children,
  lang = languagesSignal.value,
  format = "long",
  ...props
}) => {
  if (children === undefined) {
    return (
      <TimeText {...props}>{format === "timestring" ? "--:--" : "--"}</TimeText>
    );
  }
  let hours;
  if (typeof children === "number") {
    hours = children;
  } else {
    const childrenAsNumber = Number(children);
    if (isNaN(childrenAsNumber)) {
      return <TimeText {...props}>{children}</TimeText>;
    }
    hours = childrenAsNumber;
  }

  if (format === "timestring") {
    const totalMinutes = Math.round(hours * 60);
    const date = new Date(
      1970,
      0,
      1,
      Math.floor(totalMinutes / 60),
      totalMinutes % 60,
      0,
    );
    return <TimeText {...props}>{formatTime(date, lang)}</TimeText>;
  }
  const text = formatHourDuration(hours, { lang, format });
  return <TimeText {...props}>{text}</TimeText>;
};

const TimeDuration = ({
  children,
  lang = languagesSignal.value,
  format = "long",
  ...props
}) => {
  if (children === undefined || children === null) {
    return <TimeText {...props}>--</TimeText>;
  }

  // Accept: duration.js string ("2hour15minute"), ISO 8601 ("PT2H15M"), number (seconds)
  let duration;
  if (typeof children === "number") {
    duration = { seconds: children };
  } else if (typeof children === "string") {
    duration = parseDuration(children);
    if (!duration) {
      return <TimeText {...props}>{children}</TimeText>;
    }
  } else if (typeof children === "object") {
    duration = children;
  } else {
    return <TimeText {...props}>{String(children)}</TimeText>;
  }

  const isoString = durationToISOString(duration) ?? String(children);
  if (format === "iso") {
    return (
      <TimeText dateTime={isoString} {...props}>
        {isoString}
      </TimeText>
    );
  }

  const totalSeconds = durationToSeconds(duration);
  if (totalSeconds === null) {
    // Non-numeric unit values (e.g. mid-edit "2ahour15minute" or { hours: "abc" }):
    // formatDuration reads the raw values and appends compact unit symbols.
    return (
      <TimeText {...props}>
        {formatDuration(duration, { lang, format })}
      </TimeText>
    );
  }
  if (totalSeconds === 0) {
    return <TimeText {...props}>{"0"}</TimeText>;
  }

  const text = formatDuration(duration, { lang, format });
  return (
    <TimeText dateTime={isoString} {...props}>
      {text}
    </TimeText>
  );
};

const TimeRelative = ({
  children,
  lang = languagesSignal.value,
  format = "long",
  eventDuration = 0,
  bare,
  ...props
}) => {
  if (children === undefined) {
    return <TimeText {...props}>–</TimeText>;
  }

  const date = toDate(children);
  if (!date) {
    return <TimeText {...props}>{String(children)}</TimeText>;
  }

  // eventDuration accepts ms (number), duration.js string, or ISO 8601 string
  let eventDurationMs = eventDuration;
  if (typeof eventDuration === "string") {
    const s = durationToSeconds(eventDuration);
    eventDurationMs = s !== null ? s * 1000 : 0;
  }

  const text = formatTimeRelative(date, eventDurationMs, {
    lang,
    bare,
    format,
  });
  const dateTime = date.toISOString();
  return (
    <TimeText dateTime={dateTime} {...props}>
      {text}
    </TimeText>
  );
};

const TimeText = (props) => {
  return <Text as="time" noWrap {...props} />;
};

const toDate = (value, parseString) => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "number") {
    return new Date(value);
  }
  if (typeof value === "string") {
    if (parseString) {
      return parseString(value);
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
