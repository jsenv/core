# humanize [![npm package](https://img.shields.io/npm/v/@jsenv/humanize.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/humanize)

`@jsenv/humanize` helps to generate messages meant to be read by humans

It is written in ES6 and compatible with browsers and Node.js.

# API

## humanize(jsValue)

Turns a JavaScript value into a string meant to be read by a human.

```js
import { humanize } from "@jsenv/humanize";

console.log(
  humanize({
    boolean: true,
    number: 10,
    string: "hello world",
  }),
);
```

```console
{
  "boolean": true,
  "number": 10,
  "string": "hello world"
}
```

### Comparison with JSON.stringify

Table comparing `JSON.stringify` and `humanize()` to demonstrates how inspect focuses on readability and accuracy.

| value     | JSON.stringify | humanize    |
| --------- | -------------- | ----------- |
| 123456789 | "123456789"    | 123_456_789 |
| Infinity  | "null"         | Infinity    |
| -0        | "0"            | -0          |
| '"'       | '"\\""'        | '"'         |

## humanizeDuration(ms, options)

```js
import { humanizeDuration } from "@jsenv/humanize";

humanizeDuration(61_421); // "1 minute and 1 second"
```

## format\* — text for the reader of an app

Everything above writes English for a developer reading a terminal. The
`format*` family writes for the person using the app, in their language,
through `Intl`.

| what you are writing                          | reach for                                          |
| --------------------------------------------- | -------------------------------------------------- |
| a message in a terminal, a log, a test report | `humanize`, `humanizeDuration`, `humanizeFileSize` |
| a date, a delay or a number someone will read | `format*`                                          |

It lives in this package, which has no frontend of its own, so that a server
and a browser word the same instant identically: these are the functions
behind `@jsenv/navi`'s `<Time>` components, so a notification row written by a
backend and the card it points at read the same date the same way — and a REST
service does not install a frontend framework to print a month name. Nothing
here touches the DOM.

```js
import {
  formatDatetime,
  formatDay,
  formatDuration,
  formatHourDuration,
  formatMinuteDuration,
  formatMonth,
  formatNumber,
  formatSecondDuration,
  formatTimeOfDay,
  formatTimeRange,
  formatTimeRelative,
} from "@jsenv/humanize";

const start = new Date("2026-05-11T14:05:00");
const end = new Date("2026-05-11T16:00:00");
const lang = "fr";

// a date
formatDay(start, { lang }); // "lundi 11 mai"
formatDay(start, { lang, format: "numeric" }); // "11/05/2026"
formatMonth(start, { lang }); // "mai 2026"
formatDatetime(start, { lang }); // "lun. 11 mai à 14:05"

// a time of day, a span
formatTimeOfDay(start, { lang, format: "compact" }); // "14h05"
formatTimeRange(start, end, { lang, format: "compact" }); // "14h05–16h00"

// a duration, from the unit you happen to hold
formatMinuteDuration(90, { lang, format: "compact" }); // "1h30"
formatHourDuration(2.5, { lang }); // "2 heures et 30 minutes"
formatSecondDuration(90, { lang }); // "1 minute et 30 secondes"
formatDuration("PT1H30M", { lang }); // "1 heure et 30 minutes"

// a moment, relative to now (second argument is how long it lasts)
formatTimeRelative(start, 30 * 60_000, { lang });
// "dans 1 heure et 30 minutes", "En cours" or "il y a 2 heures"

// a number
formatNumber(1_234_567.5, { lang }); // "1 234 567,5"
```

Each takes more than `lang` — how a part is spelled, precision, padding, time
zone, whether the year is written. Those options live in the function's own
JSDoc, which the published bundle keeps: hover the import in an editor rather
than looking for a page listing them.

Two more, for a date field with nothing in it yet: `formatDatePlaceholder()`
writes `"jj/mm/aaaa"`, and `formatMonthPlaceholder()`, `formatWeekPlaceholder()`
and `formatDatetimePlaceholder()` do the same for their own shape.

### Which language

With no `lang`, a call uses the runtime language source: by default the
runtime's own locale, exactly what `Intl` would pick on its own. A frontend
replaces that source once, with a live one:

```js
import { setRuntimeLangSource } from "@jsenv/humanize";

setRuntimeLangSource(() => languagesSignal.value);
```

`@jsenv/navi` already does this, pointing it at the user's language
preference; because the source is read on every call, a component formatting a
date re-renders when that preference changes.

On a server the default is the process locale, which is nobody's in
particular — **pass `lang` explicitly whenever the text is for someone else**,
and `timeZone` too when the instant must be worded in the reader's zone rather
than the machine's.

### Changing a word

The words around the numbers — `"time.ongoing"`, the compact unit symbols, the
placeholder tokens — live in `humanizeI18n`, and every one of them can be
replaced or translated into a language that is not shipped:

```js
import { humanizeI18n } from "@jsenv/humanize";

humanizeI18n.add("time.ongoing", { fr: "En cours…" });
humanizeI18n.addLangKeys("ja", { "time.midnight": "真夜中" });
```

`src/i18n/humanize_i18n.js` is the exhaustive list of keys and defaults, and is
meant to be read. It is the same registry `@jsenv/navi` exposes as `naviI18n`,
so one call reaches both.

`createI18n()` (an app's own text registry) and `interpolateText()` (one
sentence with values in it) are exported here too; `@jsenv/navi`'s
[docs/i18n.md](../../frontend/navi/docs/i18n.md) explains when to use which,
and why a library's keys are opaque while an app's are not.
