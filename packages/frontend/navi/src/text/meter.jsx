import { pickLightOrDark } from "@jsenv/dom";
import { useLayoutEffect, useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { LoaderBackground } from "../graphic/loader/loader_background.jsx";

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
      --fill-color-subsuboptimum: light-dark(#d83b01, #f44336);
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
        line-height: 1;
        white-space: nowrap;
        pointer-events: none;
        user-select: none;
      }
    }

    /* When caption is shown, the track takes the full height */
    &[data-has-caption] .navi_meter_track_container {
      height: var(--height);
    }

    /* fillOnly: hide the empty track background */
    &[data-fill-only] .navi_meter_track {
      background-color: transparent;
      border-color: transparent;
    }

    /* borderless: remove border */
    &[data-borderless] .navi_meter_track {
      border-color: transparent;
    }

    &[data-disabled] {
      opacity: 0.4;
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
  children,
  percentage,
  fillOnly,
  borderless,
  style,
  ...props
}) => {
  const clampedValue = value < min ? min : value > max ? max : value;
  const fillRatio = max === min ? 0 : (clampedValue - min) / (max - min);
  const resolvedCaption =
    children !== undefined
      ? children
      : percentage
        ? `${Math.round(fillRatio * 100)}%`
        : undefined;
  const level = getMeterLevel(clampedValue, min, max, low, high, optimum);
  const fillColorVar =
    level === "optimum"
      ? "var(--fill-color-optimum)"
      : level === "suboptimum"
        ? "var(--fill-color-suboptimum)"
        : "var(--fill-color-subsuboptimum)";

  const trackContainerRef = useRef();
  useLayoutEffect(() => {
    if (resolvedCaption === undefined) return;
    const trackContainer = trackContainerRef.current;
    if (!trackContainer) return;
    const fillEl = trackContainer.querySelector(".navi_meter_fill");
    if (!fillEl) return;
    const fillBgColor = getComputedStyle(fillEl).backgroundColor;
    const textColor = pickLightOrDark(fillBgColor, "white", "black", fillEl);
    const shadowColor = textColor === "white" ? "black" : "white";
    trackContainer.style.setProperty("--x-caption-color", textColor);
    trackContainer.style.setProperty("--x-caption-shadow-color", shadowColor);
  }, [resolvedCaption, level]);

  return (
    <Box
      role="meter"
      aria-valuenow={clampedValue}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={
        typeof resolvedCaption === "string" ? resolvedCaption : undefined
      }
      baseClassName="navi_meter"
      styleCSSVars={MeterStyleCSSVars}
      basePseudoState={{
        ":read-only": readOnly,
        ":disabled": disabled,
        ":-navi-loading": loading,
      }}
      pseudoClasses={MeterPseudoClasses}
      data-has-caption={resolvedCaption !== undefined ? "" : undefined}
      data-fill-only={fillOnly ? "" : undefined}
      data-borderless={borderless ? "" : undefined}
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
        {resolvedCaption !== undefined && (
          <span className="navi_meter_caption" aria-hidden="true">
            {resolvedCaption}
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
  return "subsuboptimum";
};
