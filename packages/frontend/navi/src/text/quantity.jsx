import { LoadingDotsSvg } from "../graphic/loading/loading_dots_svg.jsx";
import { formatNumber } from "./format_number.js";
import { Icon } from "./icon.jsx";
import { naviI18n } from "./navi_i18n.js";
import { Text } from "./text.jsx";

const css = /* css */ `
  @layer navi {
    .navi_quantity {
      --unit-color: color-mix(in srgb, currentColor 50%, white);
      --unit-size-ratio: 0.7;
    }
  }

  .navi_quantity {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3em;
    line-height: 1;

    .navi_quantity_label {
      font-weight: 600;
      font-size: 0.75em;
      text-transform: uppercase;
      line-height: 1;
      letter-spacing: 0.06em;
    }
    .navi_quantity_body {
      .navi_quantity_unit {
        color: var(--unit-color);
        font-weight: normal;
        font-size: calc(var(--unit-size-ratio) * 1em);
      }
    }

    &[data-readonly] {
      opacity: 0.7;
      cursor: default;
    }

    &[data-disabled] {
      opacity: 0.4;
      cursor: not-allowed;
      user-select: none;
    }

    &[data-unit-bottom] {
      .navi_quantity_value {
        display: inline-block;
        width: 100%;
        text-align: center;
      }
      .navi_quantity_body {
        .navi_quantity_unit {
          display: inline-block;
          width: 100%;
          text-align: center;
        }
      }
    }
  }
`;

export const Quantity = ({
  children,
  unit,
  unitPosition = "right",
  label,
  size,
  lang,
  integer,
  loading,
  readOnly,
  disabled,
  bold = true,
  ...props
}) => {
  import.meta.css = css;
  const value = parseQuantityValue(children);
  const valueRounded =
    integer && typeof value === "number" ? Math.round(value) : value;
  const valueFormatted =
    typeof valueRounded === "number"
      ? formatNumber(valueRounded, { lang })
      : valueRounded;
  const unitBottom = unitPosition === "bottom";

  return (
    <Text
      baseClassName="navi_quantity"
      data-unit-bottom={unitBottom ? "" : undefined}
      propsCSSVars={QuantityPropsCSSVars}
      basePseudoState={{
        ":read-only": readOnly,
        ":disabled": disabled,
        ":-navi-loading": loading,
      }}
      pseudoClasses={QuantityPseudoClasses}
      spacing="pre"
      bold={bold}
      {...props}
    >
      {label && <span className="navi_quantity_label">{label}</span>}
      <Text
        className="navi_quantity_body"
        size={size}
        spacing={unitBottom ? <br /> : undefined}
      >
        <span className="navi_quantity_value">
          {loading ? (
            <Icon inline>
              <LoadingDotsSvg />
            </Icon>
          ) : (
            valueFormatted
          )}
        </span>
        {unit && <Unit value={value} unit={unit} lang={lang} />}
      </Text>
    </Text>
  );
};
const QuantityPropsCSSVars = {
  unitColor: "--unit-color",
  unitSizeRatio: "--unit-size-ratio",
};
const QuantityPseudoClasses = [
  ":hover",
  ":active",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];

const Unit = ({ value, unit, lang }) => {
  let unitText = unit;
  if (Array.isArray(unit)) {
    const [singular, plural] = unit;
    unitText = value > 1 ? plural : singular;
  } else {
    const singularText = naviI18n(unit, undefined, { lang });
    if (singularText !== unit) {
      // unit is known to naviI18n
      if (value > 1) {
        const pluralKey = `${unit}__plural`;
        const pluralText = naviI18n(pluralKey, undefined, { lang });
        // fallback to singular if no plural key registered
        unitText = pluralText !== pluralKey ? pluralText : singularText;
      } else {
        unitText = singularText;
      }
    }
  }

  return <span className="navi_quantity_unit">{unitText}</span>;
};

const parseQuantityValue = (children) => {
  if (typeof children !== "string") {
    return children;
  }
  const parsed = Number(children);
  return Number.isNaN(parsed) ? children : parsed;
};
