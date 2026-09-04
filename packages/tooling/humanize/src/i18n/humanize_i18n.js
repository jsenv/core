import { createI18n } from "./i18n.js";

/**
 * The shared registry holding the texts jsenv libraries display on their own:
 * the words this package's formatters need — relative time wording, duration
 * unit symbols, date field placeholders — and, when @jsenv/navi is installed,
 * everything its components say (button labels, validation messages,
 * empty-list messages…).
 *
 * One instance for all of them rather than one per package: a text belongs to
 * whoever displays it, but an app overriding one wants a single handle to do
 * it through. navi registers its own keys here and re-exports this very
 * object as `naviI18n`, so a `time.*` key registered below is overridable
 * from either name.
 *
 * Keys are opaque identifiers (`"time.ongoing"`), never the English sentence
 * — the opposite of what an app is advised to do for its own texts; navi's
 * `docs/i18n.md` explains why.
 *
 * @example
 * import { humanizeI18n } from "@jsenv/humanize";
 *
 * // Override a built-in text:
 * humanizeI18n.add("time.ongoing", { fr: "En cours…" });
 *
 * // Teach a language that is not shipped:
 * humanizeI18n.addLangKeys("ja", { "time.midnight": "真夜中" });
 */
export const humanizeI18n = createI18n();

// What the time formatters in ../time/format_time.js write in words:
// relative wording, the midnight word, the mark between the two bounds of a
// span, and the compact duration unit symbols.
humanizeI18n.addAll({
  "time.less_than_minute": {
    en: "in less than a minute",
    fr: "dans moins d'une minute",
    de: "in weniger als einer Minute",
    es: "en menos de un minuto",
    it: "in meno di un minuto",
    pt: "em menos de um minuto",
    nl: "over minder dan een minuut",
  },
  "time.ongoing": {
    en: "Ongoing",
    fr: "En cours",
    de: "Laufend",
    es: "En curso",
    it: "In corso",
    pt: "Em andamento",
    nl: "Bezig",
  },
  // [day] and [time] are replaced at runtime with the localized day/time strings
  "time.tomorrow_at": {
    en: "[day] at [time]",
    fr: "[day] à [time]",
    de: "[day] um [time]",
    es: "[day] a las [time]",
    it: "[day] alle [time]",
    pt: "[day] às [time]",
    nl: "[day] om [time]",
  },
  // [duration] is replaced at runtime with the formatted duration string (e.g. "1h30", "45 min")
  "time.in_duration": {
    en: "in [duration]",
    fr: "dans [duration]",
    de: "in [duration]",
    es: "en [duration]",
    it: "tra [duration]",
    pt: "em [duration]",
    nl: "over [duration]",
  },
  // The word formatTimeOfDay splices in place of the "0 heure(s)" part of a
  // spelled-out time of day — see its own comment for why hour 0 needs a word
  // of its own, and how the swap keeps the rest of the sentence in this
  // language's grammar. A language with no entry here keeps its literal
  // "0 heure(s)" wording rather than this key.
  "time.midnight": {
    en: "midnight",
    fr: "minuit",
    de: "Mitternacht",
    es: "medianoche",
    it: "mezzanotte",
    pt: "meia-noite",
    nl: "middernacht",
  },
  // What formatTimeRange writes between the two bounds of a span — "8h–10h",
  // "11 mai – 14 mai". An en dash, the mark for a span, not a hyphen.
  "time.range_separator": {
    en: "–",
    fr: "–",
    de: "–",
    es: "–",
    it: "–",
    pt: "–",
    nl: "–",
  },
  // Compact duration unit symbols used in "1h30", "45min", "2d", etc.
  "time.duration.year_symbol": {
    en: "y",
    fr: "a",
    de: "J",
    es: "a",
    it: "a",
    pt: "a",
    nl: "j",
    ja: "年",
    zh: "年",
    ko: "년",
  },
  "time.duration.month_symbol": {
    en: "mo",
    fr: "mo",
    de: "Mo",
    es: "mo",
    it: "mo",
    pt: "mo",
    nl: "mo",
    ja: "月",
    zh: "月",
    ko: "월",
  },
  "time.duration.week_symbol": {
    en: "w",
    fr: "sem",
    de: "W",
    es: "sem",
    it: "sett",
    pt: "sem",
    nl: "w",
    ja: "週",
    zh: "周",
    ko: "주",
  },
  "time.duration.day_symbol": {
    en: "d",
    fr: "j",
    de: "T",
    es: "d",
    it: "g",
    pt: "d",
    nl: "d",
    ja: "日",
    zh: "天",
    ko: "일",
  },
  "time.duration.hour_symbol": {
    en: "h",
    fr: "h",
    de: "h",
    es: "h",
    it: "h",
    pt: "h",
    nl: "u",
    ja: "時間",
    zh: "小时",
    ko: "시간",
  },
  "time.duration.minute_symbol": {
    en: "min",
    fr: "min",
    de: "min",
    es: "min",
    it: "min",
    pt: "min",
    nl: "min",
    ja: "分",
    zh: "分",
    ko: "분",
  },
  "time.duration.second_symbol": {
    en: "s",
    fr: "s",
    de: "s",
    es: "s",
    it: "s",
    pt: "s",
    nl: "s",
    ja: "秒",
    zh: "秒",
    ko: "초",
  },
  "time.duration.millisecond_symbol": {
    en: "ms",
    fr: "ms",
    de: "ms",
    es: "ms",
    it: "ms",
    pt: "ms",
    nl: "ms",
    ja: "ms",
    zh: "ms",
    ko: "ms",
  },
});

// Date/time placeholder tokens — shown when no value is selected
// Override any key to adapt to your language conventions
humanizeI18n.addAll({
  "time.placeholder.day": {
    fr: "jj",
    en: "dd",
    de: "TT",
    es: "dd",
    it: "gg",
    pt: "dd",
    nl: "dd",
  },
  "time.placeholder.month": {
    fr: "mm",
    en: "mm",
    de: "MM",
    es: "mm",
    it: "mm",
    pt: "mm",
    nl: "mm",
  },
  "time.placeholder.year": {
    fr: "aaaa",
    en: "yyyy",
    de: "JJJJ",
    es: "aaaa",
    it: "aaaa",
    pt: "aaaa",
    nl: "jjjj",
  },
  "time.placeholder.hour": {
    fr: "hh",
    en: "hh",
    de: "hh",
    es: "hh",
    it: "hh",
    pt: "hh",
    nl: "uu",
  },
  "time.placeholder.minute": {
    fr: "mm",
    en: "mm",
    de: "mm",
    es: "mm",
    it: "mm",
    pt: "mm",
    nl: "mm",
  },
  "time.placeholder.week": {
    fr: "sem.",
    en: "wk",
    de: "KW",
    es: "sem.",
    it: "sett.",
    pt: "sem.",
    nl: "wk",
  },
});
