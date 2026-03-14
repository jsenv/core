import { Icon } from "../graphic/icon.jsx";
import { LoadingDots } from "../graphic/loader/loading_dots.jsx";
import { formatNumber } from "./format_number.js";
import { Text } from "./text.jsx";

import.meta.css = /* css */ `
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
      .navi_quantity_value {
        font-weight: bold;
      }
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

const QuantityPseudoClasses = [
  ":hover",
  ":active",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];
export const Quantity = ({
  children,
  unit,
  unitPosition = "right",
  unitSizeRatio,
  label,
  size,
  lang,
  integer,
  loading,
  readOnly,
  disabled,
  ...props
}) => {
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
      basePseudoState={{
        ":read-only": readOnly,
        ":disabled": disabled,
        ":-navi-loading": loading,
      }}
      pseudoClasses={QuantityPseudoClasses}
      spacing="pre"
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
            <Icon flowInline>
              <LoadingDots />
            </Icon>
          ) : (
            valueFormatted
          )}
        </span>
        {unit && (
          <span
            className="navi_quantity_unit"
            style={{
              ...(unitSizeRatio === undefined
                ? {}
                : { "--unit-size-ratio": unitSizeRatio }),
            }}
          >
            {unit}
          </span>
        )}
      </Text>
    </Text>
  );
};

const parseQuantityValue = (children) => {
  if (typeof children !== "string") {
    return children;
  }
  const parsed = Number(children);
  return Number.isNaN(parsed) ? children : parsed;
};
