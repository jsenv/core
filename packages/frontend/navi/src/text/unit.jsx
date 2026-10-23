import { pluralCategory } from "@jsenv/humanize";

import { languagesSignal } from "./lang_signal.js";
import { naviI18n } from "./navi_i18n.js";
import { Text } from "./text.jsx";

/**
 * @type {import("preact").FunctionComponent<{
 *   unit: string,
 *   count?: number,
 *   plural?: boolean,
 *   format?: "long" | "short" | "narrow",
 *   lang?: string,
 *   label?: string,
 *   size?: string,
 *   sizeRatio?: number,
 *   style?: import("preact").JSX.CSSProperties,
 *   [key: string]: any,
 * }>}
 * @param {string} unit A unit `naviI18n` or `Intl` knows by name ("kilometer",
 *   "hour"), written in the reader's language; any other string is shown as
 *   given, so a unit word of the app's own comes already translated
 *   (docs/i18n.md).
 * @param {number} [count] The number the unit counts: its form is the one
 *   that number takes in the reader's language ("0 heure", "0 hours") — a
 *   unit registered with plural forms picks among them. Without it, `plural`
 *   says which of the two forms is written.
 */
export const Unit = ({
  unit,
  count,
  plural: pluralProp,
  format = "long",
  lang = languagesSignal.value,
  label,
  size = "smaller",
  sizeRatio,
  style,
  ...props
}) => {
  let resolvedSize = size;
  let resolvedStyle = style;
  if (size === "smaller" || sizeRatio !== undefined) {
    resolvedSize = undefined;
    const ratio = sizeRatio !== undefined ? sizeRatio : 0.8;
    resolvedStyle = { fontSize: `calc(${ratio} * 1em)`, ...style };
  }
  const plural =
    typeof count === "number"
      ? pluralCategory(count, { lang }) !== "one"
      : pluralProp;
  let unitText = unit;
  if (label) {
    unitText = label;
  } else if (naviI18n.has(unit, { lang })) {
    // A unit registered with plural forms picks among them by `count`.
    const registeredText = naviI18n(
      unit,
      { count: typeof count === "number" ? count : plural ? 2 : 1 },
      { lang },
    );
    if (format === "short" || format === "narrow") {
      const shortKey = `${unit}__short`;
      const shortText = naviI18n(shortKey, undefined, { lang });
      unitText = shortText === shortKey ? registeredText : shortText;
    } else if (plural) {
      const pluralKey = `${unit}__plural`;
      const pluralText = naviI18n(pluralKey, undefined, { lang });
      // the registered word when no plural key is registered
      unitText = pluralText !== pluralKey ? pluralText : registeredText;
    } else {
      unitText = registeredText;
    }
  } else {
    // naviI18n has no translation — try Intl.NumberFormat with style:"unit"
    const intlText = formatIntlUnit(unit, { count, plural, lang, format });
    if (intlText === null) {
      unitText = unit;
    } else {
      unitText = intlText;
    }
  }

  return (
    <Text
      baseClassName="navi_unit"
      size={resolvedSize}
      style={resolvedStyle}
      {...props}
    >
      {unitText}
    </Text>
  );
};

const formatIntlUnit = (unit, { lang, count, plural, format }) => {
  try {
    // Intl takes the number itself, and writes the form it takes.
    const countWritten = typeof count === "number" ? count : plural ? 2 : 1;
    const parts = new Intl.NumberFormat(lang, {
      style: "unit",
      unit,
      unitDisplay: format,
    }).formatToParts(countWritten);
    const unitPart = parts.find((p) => p.type === "unit");
    return unitPart ? unitPart.value : null;
  } catch {
    return null;
  }
};
