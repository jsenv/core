import { formatNumber, pluralCategory } from "@jsenv/humanize";

import { LoadingDotsSvg } from "../graphic/loading/loading_dots_svg.jsx";
import { Icon, Text } from "./text.jsx";
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
    .navi_quantity_value {
      font-variant-numeric: tabular-nums;
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
 *   unitSpacing?: string | number,
 *   label?: string,
 *   size?: string,
 *   lang?: string,
 *   integer?: boolean,
 *   minimumFractionDigits?: number,
 *   maximumFractionDigits?: number,
 *   signDisplay?: "auto" | "always" | "exceptZero" | "negative" | "never",
 *   loading?: boolean,
 *   readOnly?: boolean,
 *   disabled?: boolean,
 *   bold?: boolean,
 *   [key: string]: any,
 * }>}
 *
 * @param {string|[string, string]} [unit] A unit navi or `Intl` knows by name
 *   ("kilometer", "hour"), written in the reader's language and made plural
 *   with the value; any other string is shown as given, so a unit word of the
 *   app's own comes translated, as a pair whose second word is used where the
 *   language writes a plural (`pluralCategory`):
 *   `unit={[i18n("ticket"), i18n("tickets")]}` (docs/i18n.md).
 * @param {string} [unitColor] The unit's `color`, keywords included
 *   (`"secondary"`, `"hint"`…).
 * @param {string|number} [unitSpacing]
 *   Gap between the value and the unit when `unitPosition="right"`. Accepts a
 *   size token (`"s"`, `"m"`, …), a CSS length string, a number (px) or
 *   `"0"` to glue the unit to the value. Defaults to a regular space
 *   character. Ignored when `unitPosition="bottom"`, where the unit sits on
 *   its own line.
 * @param {number} [minimumFractionDigits] `formatNumber`'s, as Intl reads
 *   it: with `maximumFractionDigits` at the same count, a fixed precision
 *   ("1,0 km", "7,2 km").
 * @param {"auto"|"always"|"exceptZero"|"negative"|"never"} [signDisplay]
 *   `formatNumber`'s, as Intl reads it: `"exceptZero"` writes a delta with
 *   its sign ("+3", "−1,5", "0").
 */
export const Quantity = ({
  children,
  unit,
  unitPosition = "right",
  unitSize = "smaller",
  unitSizeRatio,
  unitColor,
  unitSpacing,
  label,
  size,
  lang,
  integer,
  minimumFractionDigits,
  maximumFractionDigits,
  signDisplay,
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
      ? formatNumber(valueRounded, {
          lang,
          minimumFractionDigits,
          maximumFractionDigits,
          signDisplay,
        })
      : valueRounded;
  const unitBottom = unitPosition === "bottom";
  // The language's rule, never `> 1`: "0 billet" in French, "0 tickets" in
  // English.
  const isPlural =
    typeof value === "number"
      ? pluralCategory(value, { lang }) !== "one"
      : false;
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
        spacing={unitBottom ? <br /> : unitSpacing}
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
            count={typeof value === "number" ? value : undefined}
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
