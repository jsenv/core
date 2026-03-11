import { Box } from "../box/box.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_meter {
      --track-color: light-dark(#ddd, #3f3f3f);
      --track-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.3);
      --border-color: light-dark(rgba(0, 0, 0, 0.3), rgba(255, 255, 255, 0.15));
      --border-radius: 3px;
      --height: 1em;
      --width: 5em;

      /* Semantic fill colors, matching native meter on Chrome/macOS */
      --fill-color-optimum: light-dark(#3b9c3b, #4caf50);
      --fill-color-suboptimum: light-dark(#c8a005, #ffc107);
      --fill-color-subsuboptimum: light-dark(#aa0000, #f44336);
    }
  }

  .navi_meter {
    display: inline-block;
    box-sizing: border-box;
    width: var(--width);
    height: var(--height);
    vertical-align: middle;
    background-color: var(--track-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    box-shadow: var(--track-shadow);
    overflow: hidden;

    .navi_meter_fill {
      width: var(--x-fill-percent, 0%);
      height: 100%;
      /* subtle gloss overlay, same as native meter */
      background-image: linear-gradient(
        to bottom,
        rgba(255, 255, 255, 0.25) 0%,
        transparent 50%,
        rgba(0, 0, 0, 0.06) 100%
      );
      background-color: var(--x-fill-color);
    }

    &[data-loading] {
      background-image: linear-gradient(
        90deg,
        var(--track-color) 25%,
        color-mix(in srgb, var(--track-color) 55%, white) 50%,
        var(--track-color) 75%
      );
      background-size: 200% 100%;
      background-color: var(--track-color);
      animation: navi_meter_loading 1.5s linear infinite;

      .navi_meter_fill {
        display: none;
      }
    }

    &[data-disabled] {
      opacity: 0.4;
    }
  }

  @keyframes navi_meter_loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;

const MeterStyleCSSVars = {
  trackColor: "--track-color",
  borderColor: "--border-color",
  borderRadius: "--border-radius",
  height: "--height",
  width: "--width",
  fillColorOptimum: "--fill-color-optimum",
  fillColorSuboptimum: "--fill-color-suboptimum",
  fillColorSubsuboptimum: "--fill-color-subsuboptimum",
};
const MeterPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];

export const Meter = ({
  value = 0,
  min = 0,
  max = 1,
  low,
  high,
  optimum,
  loading,
  readOnly,
  disabled,
  style,
  ...props
}) => {
  const clampedValue = value < min ? min : value > max ? max : value;
  const fillPercent =
    max === min ? 0 : ((clampedValue - min) / (max - min)) * 100;
  const level = getMeterLevel(clampedValue, min, max, low, high, optimum);

  const fillColorVar =
    level === "optimum"
      ? "var(--fill-color-optimum)"
      : level === "suboptimum"
        ? "var(--fill-color-suboptimum)"
        : "var(--fill-color-subsuboptimum)";

  return (
    <Box
      role="meter"
      aria-valuenow={clampedValue}
      aria-valuemin={min}
      aria-valuemax={max}
      baseClassName="navi_meter"
      styleCSSVars={MeterStyleCSSVars}
      basePseudoState={{
        ":read-only": readOnly,
        ":disabled": disabled,
        ":-navi-loading": loading,
      }}
      pseudoClasses={MeterPseudoClasses}
      style={{
        "--x-fill-percent": `${fillPercent}%`,
        "--x-fill-color": fillColorVar,
        ...style,
      }}
      {...props}
    >
      <span className="navi_meter_fill" />
    </Box>
  );
};

const getMeterLevel = (value, min, max, low, high, optimum) => {
  // Without low/high thresholds the whole range is one region → always optimum
  if (low === undefined && high === undefined) {
    return "optimum";
  }

  const effectiveLow = low !== undefined ? low : min;
  const effectiveHigh = high !== undefined ? high : max;
  const effectiveOptimum = optimum !== undefined ? optimum : (min + max) / 2;

  const getRegion = (v) => {
    if (v < effectiveLow) return 1; // below-low region
    if (v > effectiveHigh) return 3; // above-high region
    return 2; // middle region
  };

  const optimumRegion = getRegion(effectiveOptimum);
  const valueRegion = getRegion(value);
  const distance = Math.abs(optimumRegion - valueRegion);

  if (distance === 0) return "optimum";
  if (distance === 1) return "suboptimum";
  return "subsuboptimum";
};
