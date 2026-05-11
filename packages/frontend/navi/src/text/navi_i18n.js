import { createI18n } from "./i18n.js";

/**
 * The shared i18n instance for all @jsenv/navi components.
 *
 * Use `naviI18n.add(key, { lang: "translation" })` to register or override
 * any text used by navi components. The active language is read from
 * `langSignal` (the browser's current `navigator.language`).
 *
 * Built-in keys (can be overridden):
 *   - `"time.less_than_minute"` — e.g. "in less than a minute"
 *   - `"time.ongoing"`          — e.g. "Ongoing"
 *   - `"time.tomorrow_at"`      — e.g. "[day] at [time]" ([day] and [time] are placeholders)
 *
 * @example
 * import { naviI18n } from "@jsenv/navi";
 *
 * // Register unit translations for Quantity:
 * naviI18n.add("minute",         { en: "minute",  fr: "minute"  });
 * naviI18n.add("minute__plural", { en: "minutes", fr: "minutes" });
 *
 * // Register multiple keys at once:
 * naviI18n.addAll({
 *   minute:           { en: "minute",  fr: "minute"  },
 *   minute__plural:   { en: "minutes", fr: "minutes" },
 * });
 *
 * // Override a built-in text:
 * naviI18n.add("time.ongoing", { fr: "En cours…" });
 *
 * // Load a full language pack at once:
 * naviI18n.addLangKeys("fr", { minute: "minute", "minute__plural": "minutes" });
 */
export const naviI18n = createI18n();

// Default built-in translations — apps can override any key via add()
naviI18n.addAll({
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
