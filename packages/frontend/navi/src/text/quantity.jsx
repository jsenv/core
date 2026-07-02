import { LoadingDotsSvg } from "../graphic/loading/loading_dots_svg.jsx";
import { formatNumber } from "./format_number.js";
import { Icon } from "./icon.jsx";
import { Text } from "./text.jsx";
import { Unit } from "./unit.jsx";

const css = /* css */ `
  @layer navi {
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
      .navi_unit {
        font-weight: normal;
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
        .navi_unit {
          display: inline-block;
          width: 100%;
          text-align: center;
        }
      }
    }
  }
`;

/**
 * @type {import("preact").FunctionComponent<{
 *   children?: number | string,
 *   unit?: string | [string, string],
 *   unitPosition?: "right" | "bottom",
 *   unitSize?: string,
 *   unitSizeRatio?: number,
 *   unitColor?: string,
 *   label?: string,
 *   size?: string,
 *   lang?: string,
 *   integer?: boolean,
 *   loading?: boolean,
 *   readOnly?: boolean,
 *   disabled?: boolean,
 *   bold?: boolean,
 *   [key: string]: any,
 * }>}
 */
export const Quantity = ({
  children,
  unit,
  unitPosition = "right",
  unitSize = "smaller",
  unitSizeRatio,
  unitColor,
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
  const isPlural = typeof value === "number" ? value > 1 : false;
  const unitResolved = Array.isArray(unit)
    ? isPlural
      ? (unit[1] ?? unit[0])
      : unit[0]
    : unit;

  return (
    <Text
      baseClassName="navi_quantity"
      data-unit-bottom={unitBottom ? "" : undefined}
      styleCSSVars={QuantityStyleCSSVars}
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
        {unit && (
          <Unit
            unit={unitResolved}
            plural={isPlural}
            lang={lang}
            size={unitSize}
            sizeRatio={unitSizeRatio}
            color={unitColor}
          />
        )}
      </Text>
    </Text>
  );
};
const QuantityStyleCSSVars = {
  unitColor: "--unit-color",
};
const QuantityPseudoClasses = [
  ":hover",
  ":active",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];

const parseQuantityValue = (children) => {
  if (typeof children !== "string") {
    return children;
  }
  const parsed = Number(children);
  return Number.isNaN(parsed) ? children : parsed;
};
