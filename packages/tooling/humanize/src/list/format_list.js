import { getInstalledJsx } from "../i18n/interpolate_text.js";
import { getRuntimeLang } from "../i18n/runtime_lang.js";
import { memoIntl } from "../utils/memo_intl.js";

/**
 * Joins items the way the reader's language does — its word for "and" or
 * "or", and its commas: "8h–10h, 12h et 18h–20h", never items glued with a
 * hand-written " et ".
 *
 * @param {Array<string|number|import("preact").VNode>} items
 *   An element (a `<TimeRange>`) is put back at its place between the
 *   language's words, as `<Interpolate>` does with a placeholder; it keeps
 *   the `key` it was given. Elements need @jsenv/navi, which installs the JSX
 *   runtime.
 * @param {{ lang?: string, type?: "conjunction"|"disjunction"|"unit", style?: "long"|"short"|"narrow" }} [options]
 * @param {"conjunction"|"disjunction"|"unit"} [options.type="conjunction"] -
 *   "and", "or", or a plain list of measures ("3 h, 20 min").
 * @returns {string|import("preact").VNode}
 *   A string when every item is one, a Preact fragment when an item is an
 *   element.
 *
 * @example
 * formatList(["8h–10h", "12h", "18h–20h"], { lang: "fr" }) // "8h–10h, 12h et 18h–20h"
 * formatList(["tennis", "padel"], { lang: "en", type: "disjunction" }) // "tennis or padel"
 * formatList(ranges.map((range) => <TimeRange key={range.from} {...range} />))
 */
export const formatList = (
  items,
  { lang = getRuntimeLang(), type = "conjunction", style = "long" } = {},
) => {
  const formatter = memoIntl("ListFormat", lang, { type, style });
  const jsx = getInstalledJsx();
  if (!jsx || !items.some((item) => jsx.isValidElement(item))) {
    // Intl.ListFormat takes strings only, and throws on anything else.
    return formatter.format(items.map(String));
  }
  // The language's words come from parts written around stand-in strings;
  // each "element" part is the next item, in order.
  let itemIndex = 0;
  const resolved = formatter
    .formatToParts(items.map((item, index) => `\u0000${index}`))
    .map((part) => {
      if (part.type !== "element") {
        return part.value;
      }
      const item = items[itemIndex];
      itemIndex++;
      return jsx.isValidElement(item) ? item : String(item);
    });
  return jsx.createFragment(resolved);
};
