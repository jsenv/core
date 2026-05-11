import { createIntl } from "./intl.js";

/**
 * The shared i18n instance for all @jsenv/navi components.
 *
 * Use `naviIntl.add(lang, translations)` to register translations that will
 * be picked up automatically by any navi component that displays text
 * (Quantity units, Time labels, etc.).
 *
 * The active language is read from `langSignal` (the browser's current
 * `navigator.language`), so a single `add()` call covers the whole app.
 *
 * @example
 * import { naviIntl } from "@jsenv/navi";
 *
 * naviIntl.add("fr", {
 *   "minute":         "minute",
 *   "minute__plural": "minutes",
 *   "hour":           "heure",
 *   "hour__plural":   "heures",
 * });
 *
 * naviIntl.add("en", {
 *   "minute":         "minute",
 *   "minute__plural": "minutes",
 *   "hour":           "hour",
 *   "hour__plural":   "hours",
 * });
 *
 * // Then use Quantity with a well-known unit:
 * // <Quantity unit="minute">{42}</Quantity>  →  "42 minutes"
 */
export const naviIntl = createIntl();
