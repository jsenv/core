import { getRuntimeLang } from "../i18n/runtime_lang.js";
import { memoIntl } from "../utils/memo_intl.js";

/**
 * Joins items the way the reader's language does — its word for "and" or
 * "or", and its commas: "8h–10h, 12h et 18h–20h", never items glued with a
 * hand-written " et ".
 *
 * @param {Array<string|number>} items
 * @param {{ lang?: string, type?: "conjunction"|"disjunction"|"unit", style?: "long"|"short"|"narrow" }} [options]
 * @param {"conjunction"|"disjunction"|"unit"} [options.type="conjunction"] -
 *   "and", "or", or a plain list of measures ("3 h, 20 min").
 *
 * @example
 * formatList(["8h–10h", "12h", "18h–20h"], { lang: "fr" }) // "8h–10h, 12h et 18h–20h"
 * formatList(["tennis", "padel"], { lang: "en", type: "disjunction" }) // "tennis or padel"
 */
export const formatList = (
  items,
  { lang = getRuntimeLang(), type = "conjunction", style = "long" } = {},
) => {
  // Intl.ListFormat takes strings only, and throws on anything else.
  return memoIntl("ListFormat", lang, { type, style }).format(
    items.map(String),
  );
};
