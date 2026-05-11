import { createIntl } from "./intl.js";

/**
 * The shared i18n instance for all @jsenv/navi components.
 *
 * Use `naviIntl.add(key, { lang: "translation" })` to register or override
 * any text used by navi components. The active language is read from
 * `langSignal` (the browser's current `navigator.language`).
 *
 * Built-in keys (can be overridden):
 *   - `"time.less_than_minute"` — e.g. "in less than a minute"
 *   - `"time.ongoing"`          — e.g. "Ongoing"
 *   - `"time.tomorrow_at"`      — e.g. "[day] at [time]" (use [day] and [time] placeholders)
 *
 * @example
 * import { naviIntl } from "@jsenv/navi";
 *
 * // Register unit translations for Quantity:
 * naviIntl.add("minute",         { en: "minute",  fr: "minute"  });
 * naviIntl.add("minute__plural", { en: "minutes", fr: "minutes" });
 *
 * // Register multiple keys at once:
 * naviIntl.addAll({
 *   minute:           { en: "minute",  fr: "minute"  },
 *   minute__plural:   { en: "minutes", fr: "minutes" },
 * });
 *
 * // Override a built-in text:
 * naviIntl.add("time.ongoing", { fr: "En cours…" });
 *
 * // Load a full language pack at once:
 * naviIntl.addLangKeys("fr", { minute: "minute", "minute__plural": "minutes" });
 */
export const naviIntl = createIntl();

// Default built-in translations — apps can override any key via add()
naviIntl.addAll({
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
});
