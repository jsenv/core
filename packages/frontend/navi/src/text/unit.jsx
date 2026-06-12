import { naviI18n } from "./navi_i18n.js";
import { Text } from "./text.jsx";

export const Unit = ({ type, plural, lang, ...props }) => {
  const isPlural = Boolean(plural);
  let unitText = type;
  if (Array.isArray(type)) {
    const [singular, pluralText] = type;
    unitText = isPlural ? pluralText : singular;
  } else {
    const singularText = naviI18n(type, undefined, { lang });
    if (singularText !== type) {
      // type is known to naviI18n
      if (isPlural) {
        const pluralKey = `${type}__plural`;
        const pluralText = naviI18n(pluralKey, undefined, { lang });
        // fallback to singular if no plural key registered
        unitText = pluralText !== pluralKey ? pluralText : singularText;
      } else {
        unitText = singularText;
      }
    } else {
      // naviI18n has no translation — try Intl.NumberFormat with style:"unit"
      const intlText = formatIntlUnit(type, isPlural, lang);
      if (intlText !== null) {
        unitText = intlText;
      }
    }
  }

  return (
    <Text baseClassName="navi_unit" {...props}>
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
