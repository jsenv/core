import { pickLightOrDark } from "@jsenv/dom";
import { useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { PSEUDO_CLASSES } from "../box/pseudo_styles.js";
import {
  reportDisabledToLabel,
  reportReadOnlyToLabel,
} from "../field/label.jsx";
import { LoaderBackground } from "../graphic/loader/loader_background.jsx";
import { Stat } from "./stat.jsx";

import.meta.css = /* css */ `
  @layer navi {
    .navi_meter {
      --loader-color: var(--navi-loader-color);
      --track-color: #efefef;
      --border-color: #cbcbcb;
      --border-width: 1px;
      --border-radius: 5px;
      --height: 1em;
      --width: 5em;

      /* Semantic fill colors, matching native meter on Chrome/macOS */
      --fill-color-optimum: light-dark(#0f7c0f, #4caf50);
      --fill-color-suboptimum: light-dark(#fdb900, #ffc107);
      --fill-color-even-less-good: light-dark(#d83b01, #f44336);
    }
  }

  .navi_meter {
    position: relative;
    display: inline-flex;
    box-sizing: border-box;
    width: var(--width);
    height: var(--height);
    align-items: center;
    vertical-align: middle;

    .navi_meter_track_container {
      position: relative;
      width: 100%;
      height: calc(var(--height) * 0.5);
      border-radius: var(--border-radius);

      .navi_meter_track {
        position: absolute;
        inset: 0;
        background-color: var(--track-color);
        border: var(--border-width) solid var(--border-color);
        border-radius: inherit;
      }

      .navi_meter_fill {
        position: absolute;
        inset: 0;
        background-clip: content-box;
        background-color: var(--x-fill-color);
        border-width: var(--border-width);
        border-style: solid;
        border-color: transparent;
        border-radius: inherit;
        clip-path: inset(0 calc((1 - var(--x-fill-ratio, 0)) * 100%) 0 0);
      }

      .navi_meter_caption {
        position: absolute;
        inset: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--x-caption-color, white);
        font-size: calc(var(--height) * 0.55);
        text-shadow:
          0 0 4px var(--x-caption-shadow-color, black),
          0 0 2px var(--x-caption-shadow-color, black);
        white-space: nowrap;
        pointer-events: none;
        user-select: none;
      }
    }

    &[data-disabled] {
      opacity: 0.4;
    }

    /* When caption is shown, the track takes the full height */
    &[data-has-caption] {
      .navi_meter_track_container {
        height: var(--height);
      }
    }
    /* fillOnly: hide the empty track background */
    &[data-fill-only] {
      .navi_meter_track {
        background-color: transparent;
        border-color: transparent;
      }
    }
    &[data-fill-round] {
      .navi_meter_fill {
        width: calc(var(--x-fill-ratio) * 100%);
        clip-path: unset;
      }
    }
    /* borderless: remove border */
    &[data-borderless] {
      .navi_meter_track {
        border-color: transparent;
      }
    }
    &[data-transition] {
      .navi_meter_fill {
        transition: clip-path 0.4s ease;
      }
      &[data-fill-round] .navi_meter_fill {
        transition: width 0.4s ease;
      }
    }
  }
`;

const MeterStyleCSSVars = {
  trackColor: "--track-color",
  borderColor: "--border-color",
  borderRadius: "--border-radius",
  height: "--height",
  width: "--width",
};
const MeterPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
  ":-navi-meter-optimum",
  ":-navi-meter-suboptimum",
  ":-navi-meter-even-less-good",
];
Object.assign(PSEUDO_CLASSES, {
  ":-navi-meter-optimum": {
    attribute: "data-optimum",
  },
  ":-navi-meter-suboptimum": {
    attribute: "data-suboptimum",
  },
  ":-navi-meter-even-less-good": {
    attribute: "data-even-less-good",
  },
});

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
  caption,
  percentage,
  fillOnly,
  fillRound = fillOnly,
  borderless,
  transition,
  style,
  ...props
}) => {
  const clampedValue = value < min ? min : value > max ? max : value;
  const fillRatio = max === min ? 0 : (clampedValue - min) / (max - min);
  let children = caption;
  if (children === undefined && percentage) {
    children = (
      <Stat unit="%" unitSizeRatio="1">
        {Math.round(fillRatio * 100)}
      </Stat>
    );
  }
  const level = getMeterLevel(clampedValue, min, max, low, high, optimum);
  const fillColorVar =
    level === "optimum"
      ? "var(--fill-color-optimum)"
      : level === "suboptimum"
        ? "var(--fill-color-suboptimum)"
        : "var(--fill-color-even-less-good)";

  reportDisabledToLabel(disabled);
  reportReadOnlyToLabel(readOnly);

  const trackContainerRef = useRef();
  useLayoutEffect(() => {
    if (!children) {
      return;
    }
    const trackContainer = trackContainerRef.current;
    if (!trackContainer) {
      return;
    }
    // When fill covers less than half the track, the text center sits on the
    // empty track — use the track color for contrast. Otherwise use fill color.
    const bgEl =
      fillRatio >= 0.5
        ? trackContainer.querySelector(".navi_meter_fill")
        : trackContainer.querySelector(".navi_meter_track");
    if (!bgEl) {
      return;
    }
    const bgColor = getComputedStyle(bgEl).backgroundColor;
    const textColor = pickLightOrDark(bgColor, "white", "black", bgEl);
    const shadowColor = textColor === "white" ? "black" : "white";
    trackContainer.style.setProperty("--x-caption-color", textColor);
    trackContainer.style.setProperty("--x-caption-shadow-color", shadowColor);
  }, [children, level, fillRatio]);

  return (
    <Box
      role="meter"
      aria-valuenow={clampedValue}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={typeof caption === "string" ? caption : undefined}
      baseClassName="navi_meter"
      styleCSSVars={MeterStyleCSSVars}
      basePseudoState={{
        ":read-only": readOnly,
        ":disabled": disabled,
        ":-navi-loading": loading,
        ":-navi-meter-optimum": level === "optimum",
        ":-navi-meter-suboptimum": level === "suboptimum",
        ":-navi-meter-even-less-good": level === "even-less-good",
      }}
      pseudoClasses={MeterPseudoClasses}
      data-has-caption={children !== undefined ? "" : undefined}
      data-fill-only={fillOnly ? "" : undefined}
      data-fill-round={fillRound ? "" : undefined}
      data-borderless={borderless ? "" : undefined}
      data-transition={transition ? "" : undefined}
      style={{
        "--x-fill-ratio": fillRatio,
        "--x-fill-color": fillColorVar,
        ...style,
      }}
      {...props}
    >
      <span className="navi_meter_track_container" ref={trackContainerRef}>
        <LoaderBackground
          loading={loading}
          color="var(--loader-color)"
          inset={-1}
        />
        <span className="navi_meter_track" />
        <span className="navi_meter_fill" />
        {children && (
          <span className="navi_meter_caption" aria-hidden="true">
            {children}
          </span>
        )}
      </span>
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
  return "even-less-good";
};
