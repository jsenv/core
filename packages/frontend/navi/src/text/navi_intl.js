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
