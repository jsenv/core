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
  formatTimeOfDay,
  formatTimeRelative,
  formatWeekPlaceholder,
  getRelativeDay,
  resolveTimeRangePrecision,
  toDate,
  toTimeOfDay,
} from "./format_time.js";
import { languagesSignal } from "./lang_signal.js";
import { naviI18n } from "./navi_i18n.js";
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
 *   - `"date"`     → "lundi 11 mai" (long by default); `format="short"` → "lun. 11 mai"; `format="numeric"` → "11/05/2026";
 *                    `format={{ weekday: "long", month: "short" }}` spells the two apart → "mercredi 2 sept.";
 *                    a part set to `false` is dropped — `format={{ day: false, month: false }}` → "mercredi"
 *   - `"month"`    → "juin 2026"
 *   - `"datetime"` → "lun. 11 mai, 14:30" (long); `format="short"` → "11 mai, 14:30"; `format="narrow"` → "11/05, 14:30"
 *   - `"time"`     → time-of-day as duration by default (e.g. "14:30" → "14 heures 30");
 *                    `format="timestring"` → clock "14 h 30". Midnight (00:xx) is
 *                    special-cased regardless of `format` — "0 heures 5 minutes"
 *                    would otherwise collapse to "5 minutes", indistinguishable
 *                    from an actual 5-minute duration: `format="long"` (default)
 *                    says "minuit et 5 minutes" (`format="short"/"narrow"/"compact"`
 *                    keep the zero hour instead — "0 h et 5 min"/"0h 5min"/"00h05").
 *                    `format="compact"` also zero-pads any single-digit hour, not
 *                    just midnight (e.g. "5h30" → "05h30"), closer to "05:30";
 *                    `pad={false}` writes it the way one says it instead ("8h30",
 *                    "8h"). See `<TimeRange>` for a span between two of them.
 *   - `"hour"`     → hours as duration (e.g. 1.5 → "1 heure 30 minutes")
 *   - `"minute"`   → minutes as duration (e.g. 90 → "1 heure 30 minutes")
 *   - `"second"`   → seconds as duration (e.g. 90 → "1 minute 30 secondes")
 *     These three promote to the largest fitting unit, days included (36 hours
 *     → "1 jour et 12 heures"); see `forceUnit` to stay in the given unit.
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
 * @param {"long"|"short"|"narrow"|"compact"|"numeric"|"timestring"|"iso"|{ weekday?: "long"|"short"|"narrow"|false, day?: boolean, month?: "long"|"short"|"narrow"|"numeric"|false }} [format="long"]
 *   Controls the verbosity of the output. Defaults to `"long"` for all types.
 *   - `"short"`      → Intl short (e.g. "2 h et 15 min", short month for dates/datetimes, no weekday for datetime)
 *   - `"narrow"`     → Intl narrow (e.g. "2h 15min", numeric month for datetime)
 *   - `"compact"`    → custom compact notation (e.g. "2h15", no minute symbol when hours present)
 *   - `"numeric"`    → numeric date, only for `type="date"` (e.g. "11/09/2026")
 *   - `"timestring"` → clock display for `type="time"`, `type="minute"`, `type="hour"`, and `type="second"` (e.g. "14:30", "01:30" for 90s)
 *   - `"iso"`        → ISO 8601 string, only for `type="duration"` (e.g. "PT2H15M")
 *   - an object      → `type="date"` only, one verbosity per part
 *                      (`{ weekday: "long", month: "short" }`): a narrow card
 *                      keeps the weekday whole, since that is what the eye
 *                      lands on, and abbreviates the month, since that is
 *                      where the characters are. `false` drops a part:
 *                      `{ day: false, month: false }` is the weekday alone
 *                      ("mardi"), `{ month: false }` weekday + day-of-month
 *                      ("mardi 18").
 * @param {boolean} [forceUnit=false]
 *   Keeps the value in the unit named by `type` however big it gets, for
 *   `type="hour"`, `"minute"` and `"second"`: 36 hours reads "36 heures"
 *   instead of the default "1 jour et 12 heures". The default promotes to the
 *   largest fitting unit because it reads better; force the unit when the unit
 *   itself is the information (a quota, a counter).
 * @param {boolean} [pad=true]
 *   `type="time"` + `format="compact"` only — whether the clock is written at a
 *   fixed width. `true` (default) zero-pads the hour and always writes the
 *   minutes ("08h00", "08h30"), so a column of times lines up. `false` writes
 *   the shape one says out loud instead: bare hour, minutes only when there are
 *   any ("8h", "8h30"). The spelled-out formats put their units in words and
 *   need neither, so they ignore it.
 * @param {"hour"|"minute"} [precision]
 *   `type="time"` + `format="compact"` only, and rarely set by hand — whether a
 *   zero minute is written ("8h00") or dropped ("8h"). Defaults to whatever
 *   `pad` implies; the one reason to force `"minute"` on an unpadded clock is
 *   to agree with a partner that has minutes of its own, which is what
 *   `<TimeRange>` does for you.
 * @param {boolean|"auto"} [year=true]
 *   `type="date"` + `format="numeric"` only — whether the year is written.
 *   `false` drops it ("30/07", the day/month order still following the
 *   locale), `"auto"` drops it only when the date is in the current year.
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
  year,
  dayLabel,
  now,
  ...props
}) => {
  if (children === undefined || children === null) {
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

  const base = formatDay(date, { lang, format, year, now });
  let text;
  if (dayLabel) {
    const offset = getRelativeDay(date, { now });
    if (offset >= -1 && offset <= 1) {
      text = `${base} (${formatDayRelative(offset, { lang })})`;
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
  if (children === undefined || children === null) {
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
  if (children === undefined || children === null) {
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
  pad = true,
  precision,
  ...props
}) => {
  if (children === undefined || children === null) {
    return <TimeText {...props}>--:--</TimeText>;
  }

  const date = toTimeOfDay(children);
  // toDate turns a non-finite number into an Invalid Date, which is an object
  if (!date || isNaN(date.getTime())) {
    return <TimeText {...props}>{String(children)}</TimeText>;
  }

  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const dateTime = `${hh}:${mm}`; // See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/time#datetime
  // The whole clock shaping (timestring, clockStyle, the midnight wording)
  // lives in formatTimeOfDay so a plain string — a `title` attribute, a
  // notification — reads exactly like this component.
  const text = formatTimeOfDay(date, { lang, format, pad, precision });
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
  forceUnit = false,
  ...props
}) => {
  if (children === undefined || children === null) {
    return (
      <TimeText {...props}>{format === "timestring" ? "--:--" : "--"}</TimeText>
    );
  }
  const minutes = Number(children);
  if (!Number.isFinite(minutes)) {
    return <TimeText {...props}>{String(children)}</TimeText>;
  }

  const totalHours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const hh = String(totalHours).padStart(2, "0");
  const mm = String(remainingMinutes).padStart(2, "0");
  const dateTime = `${hh}:${mm}`;
  let text;
  if (format === "timestring") {
    const date = new Date(1970, 0, 1, totalHours, remainingMinutes, 0);
    text = formatTime(date, { lang });
  } else {
    text = formatMinuteDuration(minutes, { lang, format, forceUnit });
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
  forceUnit = false,
  ...props
}) => {
  if (children === undefined || children === null) {
    return (
      <TimeText {...props}>
        {format === "timestring" ? "--:--:--" : "--"}
      </TimeText>
    );
  }
  const seconds = Number(children);
  if (!Number.isFinite(seconds)) {
    return <TimeText {...props}>{String(children)}</TimeText>;
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
    text = formatSecondDuration(seconds, { lang, format, forceUnit });
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
  forceUnit = false,
  ...props
}) => {
  if (children === undefined || children === null) {
    return (
      <TimeText {...props}>{format === "timestring" ? "--:--" : "--"}</TimeText>
    );
  }
  const hours = Number(children);
  if (!Number.isFinite(hours)) {
    return <TimeText {...props}>{String(children)}</TimeText>;
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
    return <TimeText {...props}>{formatTime(date, { lang })}</TimeText>;
  }
  const text = formatHourDuration(hours, { lang, format, forceUnit });
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
  if (children === undefined || children === null) {
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

/**
 * Displays a span between two instants — an opening slot, an availability
 * window — as the two `<time>` elements `<Time>` would render, around a
 * separator.
 *
 * On top of writing the separator, it makes the two bounds agree on how
 * precisely they are written, which is a property of the pair and of nothing
 * else: with `type="time" format="compact" pad={false}`, "08:00"–"10:00" reads
 * "8h–10h", but "11:30"–"14:00" reads "11h30–14h00" and not "11h30–14h", where
 * the eye stops on the difference of shape before it reads the hours. Any bound
 * with minutes gives minutes to both, zero included. The padded clock
 * (`pad` left at its default) already writes every bound at the same width, and
 * the spelled-out formats say their units in words, so neither needs the rule
 * and neither is touched by it.
 *
 * @param {Date|number|string} from
 *   The start of the span, in whatever `<Time>` accepts for this `type`.
 * @param {Date|number|string} to
 *   The end of the span. An undefined bound renders `<Time>`'s own placeholder.
 * @param {"date"|"month"|"datetime"|"time"|"hour"|"minute"|"second"} [type="time"]
 *   Passed to both bounds. Only `"time"` gets the shared-precision rule; the
 *   other types are written one after the other, with nothing factored out (a
 *   date span reads "11 mai – 14 mai", never "du 11 au 14 mai").
 * @param {"hour"|"minute"} [precision]
 *   Writes both bounds at this precision instead of the one the pair calls for
 *   — `"minute"` to keep a zero minute on both ("8h00–10h00"), `"hour"` to drop
 *   it on both ("8h–11h30", which is the shape the rule exists to avoid: set it
 *   only when you mean it).
 * @param {string} [separator]
 *   What goes between the two bounds. Defaults to the `"time.range_separator"`
 *   navi text (an en dash), tightened against both bounds in `format="compact"`
 *   — where the span is one short token — and spaced out otherwise.
 *
 *   Every other prop is forwarded to both bounds; see `<Time>`.
 */
export const TimeRange = ({
  from,
  to,
  type = "time",
  format = "long",
  lang = languagesSignal.value,
  pad = true,
  precision,
  separator = naviI18n("time.range_separator", undefined, { lang }),
  ...props
}) => {
  const boundProps = { type, format, lang };
  if (type === "time") {
    boundProps.pad = pad;
    boundProps.precision =
      precision ?? resolveTimeRangePrecision(from, to, { format, pad });
  }
  // compact writes the whole span as one short token ("8h–10h"): nothing
  // around the separator, and no break inside it. The other formats are
  // phrases — they get room around the separator, and may wrap there (their
  // separator carries its own spaces, which is enough to keep Text from adding
  // more). Text spaces its children out by default, so the tight span has to
  // say it wants none — before {...props}, so a caller can still ask for its
  // own spacing.
  const tight = format === "compact";
  return (
    <Text noWrap={tight} spacing={tight ? 0 : undefined} {...props}>
      <Time {...boundProps}>{from}</Time>
      {tight ? separator : ` ${separator} `}
      <Time {...boundProps}>{to}</Time>
    </Text>
  );
};
