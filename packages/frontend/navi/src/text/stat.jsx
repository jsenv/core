import { Icon } from "../graphic/icon.jsx";
import { LoadingDots } from "../graphic/loader/loading_dots.jsx";
import { formatNumber } from "./format_number.js";
import { Text } from "./text.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_stat {
      --unit-color: #6b7280;
    }

    @media (prefers-color-scheme: dark) {
      .navi_stat {
        --unit-color: rgb(129, 134, 140);
      }
    }
  }

  .navi_stat {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3em;
    line-height: 1;

    .navi_stat_label {
      font-weight: 600;
      font-size: 0.75em;
      text-transform: uppercase;
      line-height: 1;
      letter-spacing: 0.06em;
    }
    .navi_stat_body {
      .navi_stat_value {
        font-weight: bold;
      }
      .navi_stat_unit {
        color: var(--unit-color);
        font-weight: normal;
        font-size: 0.7em;
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
      .navi_stat_value {
        display: inline-block;
        width: 100%;
        text-align: center;
      }
      .navi_stat_body {
        .navi_stat_unit {
          display: inline-block;
          width: 100%;
          text-align: center;
        }
      }
    }
  }
`;

const StatPseudoClasses = [
  ":hover",
  ":active",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];
export const Stat = ({
  children,
  unit,
  unitPosition = "right",
  label,
  size,
  lang,
  loading,
  readOnly,
  disabled,
  ...props
}) => {
  const value = parseStatValue(children);
  const valueFormatted =
    typeof value === "number" ? formatNumber(value, { lang }) : value;
  const unitBottom = unitPosition === "bottom";

  return (
    <Text
      baseClassName="navi_stat"
      data-unit-bottom={unitBottom ? "" : undefined}
      basePseudoState={{
        ":read-only": readOnly,
        ":disabled": disabled,
        ":-navi-loading": loading,
      }}
      pseudoClasses={StatPseudoClasses}
      spacing="pre"
      {...props}
    >
      {label && <span className="navi_stat_label">{label}</span>}
      <Text
        className="navi_stat_body"
        size={size}
        spacing={unitBottom ? <br /> : undefined}
      >
        <span className="navi_stat_value">
          {loading ? (
            <Icon flowInline>
              <LoadingDots />
            </Icon>
          ) : (
            valueFormatted
          )}
        </span>
        {unit && <span className="navi_stat_unit">{unit}</span>}
      </Text>
    </Text>
  );
};

const parseStatValue = (children) => {
  if (typeof children !== "string") return children;
  const parsed = Number(children);
  return Number.isNaN(parsed) ? children : parsed;
};
