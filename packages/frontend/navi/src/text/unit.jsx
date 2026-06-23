import { naviI18n } from "./navi_i18n.js";
import { Text } from "./text.jsx";

export const Unit = ({
  unit,
  plural,
  lang,
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
  const isPlural = Boolean(plural);
  let unitText = unit;
  if (label) {
    unitText = label;
  } else {
    const singularText = naviI18n(unit, undefined, { lang });
    if (singularText === unit) {
      // naviI18n has no translation — try Intl.NumberFormat with style:"unit"
      const intlText = formatIntlUnit(unit, isPlural, lang);
      if (intlText !== null) {
        unitText = intlText;
      }
    } else if (isPlural) {
      const pluralKey = `${unit}__plural`;
      const pluralText = naviI18n(pluralKey, undefined, { lang });
      // fallback to singular if no plural key registered
      unitText = pluralText !== pluralKey ? pluralText : singularText;
    } else {
      unitText = singularText;
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

const formatIntlUnit = (unit, plural, lang) => {
  try {
    const count = plural ? 2 : 1;
    const parts = new Intl.NumberFormat(lang, {
      style: "unit",
      unit,
      unitDisplay: "long",
    }).formatToParts(count);
    const unitPart = parts.find((p) => p.type === "unit");
    return unitPart ? unitPart.value : null;
  } catch {
    return null;
  }
};
