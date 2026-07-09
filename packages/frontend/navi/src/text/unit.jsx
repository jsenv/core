import { langSignal } from "./lang_signal.js";
import { naviI18n } from "./navi_i18n.js";
import { Text } from "./text.jsx";

/**
 * @type {import("preact").FunctionComponent<{
 *   unit: string,
 *   plural?: boolean,
 *   format?: "long" | "short" | "narrow",
 *   lang?: string,
 *   label?: string,
 *   size?: string,
 *   sizeRatio?: number,
 *   style?: import("preact").JSX.CSSProperties,
 *   [key: string]: any,
 * }>}
 */
export const Unit = ({
  unit,
  plural,
  format = "long",
  lang = langSignal.value,
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
  let unitText = unit;
  if (label) {
    unitText = label;
  } else if (naviI18n.has(unit, { lang })) {
    const singularText = naviI18n(unit, undefined, { lang });
    if (format === "short" || format === "narrow") {
      const shortKey = `${unit}__short`;
      const shortText = naviI18n(shortKey, undefined, { lang });
      unitText = shortText === shortKey ? singularText : shortText;
    } else if (plural) {
      const pluralKey = `${unit}__plural`;
      const pluralText = naviI18n(pluralKey, undefined, { lang });
      // fallback to singular if no plural key registered
      unitText = pluralText !== pluralKey ? pluralText : singularText;
    } else {
      unitText = singularText;
    }
  } else {
    // naviI18n has no translation — try Intl.NumberFormat with style:"unit"
    const intlText = formatIntlUnit(unit, { plural, lang, format });
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

const formatIntlUnit = (unit, { lang, plural, format }) => {
  try {
    const count = plural ? 2 : 1;
    const parts = new Intl.NumberFormat(lang, {
      style: "unit",
      unit,
      unitDisplay: format,
    }).formatToParts(count);
    const unitPart = parts.find((p) => p.type === "unit");
    return unitPart ? unitPart.value : null;
  } catch {
    return null;
  }
};
