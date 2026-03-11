import { Icon } from "../graphic/icon.jsx";
import { LoadingDots } from "../graphic/loader/loading_dots.jsx";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { formatNumber } from "./format_number.js";

import.meta.css = /* css */ `
  @layer navi {
    .navi_stat {
      --label-color: #6b7280;
      --unit-color: #6b7280;
    }

    @media (prefers-color-scheme: dark) {
      .navi_stat {
        --label-color: rgb(129, 134, 140);
        --unit-color: rgb(129, 134, 140);
      }
    }
  }

  .navi_stat {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3em;
  }

  .navi_stat_label {
    color: var(--label-color);
    font-weight: 600;
    font-size: 0.75em;
    text-transform: uppercase;
    line-height: 1;
    letter-spacing: 0.06em;
  }

  .navi_stat_body {
    display: inline-flex;
    flex-direction: row;
    align-items: baseline;
    gap: 0.3em;
  }

  .navi_stat_body[data-unit-bottom] {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1em;
  }

  .navi_stat_value {
    font-weight: bold;
    line-height: 1;
  }

  .navi_stat_unit {
    color: var(--unit-color);
    font-weight: normal;
    font-size: 0.65em;
    line-height: 1;
  }

  .navi_stat[data-unit-bottom] .navi_stat_unit {
    line-height: 1.2;
  }

  .navi_stat[data-read-only] {
    opacity: 0.7;
    cursor: default;
  }

  .navi_stat[data-disabled] {
    opacity: 0.4;
    cursor: not-allowed;
    user-select: none;
  }
`;

export const Stat = ({
  children,
  unit,
  unitPosition = "right",
  label,
  size = "2em",
  lang,
  loading,
  readOnly,
  disabled,
  className,
  style,
  ...props
}) => {
  const value = parseStatValue(children);
  const valueFormatted =
    typeof value === "number" ? formatNumber(value, { lang }) : value;

  return (
    <span
      className={withPropsClassName("navi_stat", className)}
      data-read-only={readOnly ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      data-loading={loading ? "" : undefined}
      style={style}
      {...props}
    >
      {label && <span className="navi_stat_label">{label}</span>}
      <span
        className="navi_stat_body"
        data-unit-bottom={unitPosition === "bottom" ? "" : undefined}
        style={{ fontSize: size }}
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
        {unit && !loading && <span className="navi_stat_unit">{unit}</span>}
      </span>
    </span>
  );
};

const parseStatValue = (children) => {
  if (typeof children !== "string") return children;
  const parsed = Number(children);
  return Number.isNaN(parsed) ? children : parsed;
};
