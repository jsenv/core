import { interpolate } from "../transition_playback.js";
import {
  interpolateRGBA,
  prepareRGBATransitionPair,
} from "./color_interpolation.js";

export const getBackgroundColorAndImageInterpolation = (
  fromBackground,
  toBackground,
) => {
  const fromBackgroundColor = fromBackground.color;
  const toBackgroundColor = toBackground.color;
  const fromBackgroundImage = fromBackground.image;
  const toBackgroundImage = toBackground.image;
  const fromHasImage = Boolean(fromBackgroundImage);
  const toHasImage = Boolean(toBackgroundImage);
  const fromHasGradient = fromHasImage && isGradientObject(fromBackgroundImage);
  const toHasGradient = toHasImage && isGradientObject(toBackgroundImage);
  const getInterpolateBackgroundColor = () => {
    const backgroundColorRgbaPair = prepareRGBATransitionPair(
      fromBackgroundColor,
      toBackgroundColor,
    );
    if (!backgroundColorRgbaPair) {
      return toBackgroundColor;
    }
    const [fromRGBA, toRGBA] = backgroundColorRgbaPair;
    return (transition) => {
      const rgbaInterpolated = interpolateRGBA(transition, fromRGBA, toRGBA);
      return rgbaInterpolated;
    };
  };

  // color to color
  if (!fromHasImage && !toHasImage) {
    return {
      color: getInterpolateBackgroundColor(),
    };
  }
  // gradient to color
  if (fromHasGradient && !toHasImage && toBackgroundColor) {
    if (!gradientHasColors(fromBackgroundImage)) {
      return { color: toBackgroundColor };
    }
    return {
      image: (transition) => {
        if (transition.value === 1) {
          return undefined;
        }
        const interpolatedColors = fromBackgroundImage.colors.map(
          (colorStop) => {
            return interpolateColorStopToColor(
              transition,
              colorStop,
              toBackgroundColor,
            );
          },
        );
        return { ...fromBackgroundImage, colors: interpolatedColors };
      },
      color: (transition) => {
        if (transition.value < 1) {
          return undefined;
        }
        return toBackgroundColor;
      },
    };
  }
  // color to gradient
  if (!fromHasImage && fromBackgroundColor && toHasGradient) {
    if (!gradientHasColors(toBackgroundImage)) {
      return { image: toBackgroundImage };
    }
    return {
      image: (transition) => {
        const interpolatedColors = toBackgroundImage.colors.map((colorStop) => {
          return interpolateColorToColorStop(
            transition,
            fromBackgroundColor,
            colorStop,
          );
        });
        return {
          ...toBackgroundImage,
          colors: interpolatedColors,
        };
      },
    };
  }
  // gradient to gradient
  if (fromHasGradient && toHasGradient) {
    if (
      !gradientHasColors(fromBackgroundImage) ||
      !gradientHasColors(toBackgroundImage)
    ) {
      // Unsupported cross-gradient transition - fall back to instant change
      return { image: toBackgroundImage };
    }
    const fromGradientType = fromBackgroundImage.type;
    const toGradientType = toBackgroundImage.type;
    const isSameGradientType = fromGradientType === toGradientType;
    const fromColors = fromBackgroundImage.colors;
    const toColors = toBackgroundImage.colors;
    return {
      image: (transition) => {
        const interpolatedColors = interpolateColorStopsArray(
          transition,
          fromColors,
          toColors,
          isSameGradientType ? "same-type" : "cross-type",
        );
        return {
          ...toBackgroundImage,
          colors: interpolatedColors,
        };
      },
      color: isSameGradientType
        ? getInterpolateBackgroundColor()
        : toBackgroundColor,
    };
  }
  return {
    color: getInterpolateBackgroundColor(),
  };
};

// Helper to interpolate color stops with position values
const interpolateStops = (transition, fromStops, toStops) => {
  if (!Array.isArray(fromStops) || !Array.isArray(toStops)) {
    return transition.value < 0.5 ? fromStops : toStops;
  }

  const maxLength = Math.max(fromStops.length, toStops.length);
  const result = [];
  for (let i = 0; i < maxLength; i++) {
    const fromStop = fromStops[i];
    const toStop = toStops[i];
    result.push(interpolateStop(transition, fromStop, toStop));
  }

  return result;
};

// Helper to interpolate a single stop (position value)
const interpolateStop = (transition, fromStop, toStop) => {
  if (fromStop && toStop) {
    // Stops are now already parsed objects
    if (
      fromStop.isNumeric &&
      toStop.isNumeric &&
      fromStop.unit === toStop.unit
    ) {
      const interpolatedValue = interpolate(
        transition,
        fromStop.value,
        toStop.value,
      );
      return {
        isNumeric: true,
        value: interpolatedValue,
        unit: fromStop.unit,
      };
    }
    // Non-numeric or different units - use threshold
    return transition.value < 0.5 ? fromStop : toStop;
  }
  // Only one exists - use it
  return fromStop || toStop;
};

// Helper to interpolate a single color stop between two color stops
const interpolateColorStop = (transition, fromStop, toStop) => {
  if (!fromStop || !toStop) {
    return toStop || fromStop;
  }

  const interpolatedStop = { ...toStop };

  // Interpolate colors if both exist
  if (fromStop.color && toStop.color) {
    interpolatedStop.color = interpolateRGBA(
      transition,
      fromStop.color,
      toStop.color,
    );
  }

  // Interpolate position stops if both exist
  if (fromStop.stops && toStop.stops) {
    interpolatedStop.stops = interpolateStops(
      transition,
      fromStop.stops,
      toStop.stops,
    );
  }

  return interpolatedStop;
};

// Helper to interpolate color stops arrays with different handling strategies
const interpolateColorStopsArray = (
  transition,
  fromColors,
  toColors,
  strategy = "same-type",
) => {
  const maxStops = Math.max(fromColors.length, toColors.length);
  const interpolatedColors = [];

  for (let i = 0; i < maxStops; i++) {
    const fromStop = fromColors[i];
    const toStop = toColors[i];

    if (fromStop && toStop) {
      if (strategy === "cross-type") {
        // For cross-gradient transitions, prioritize target structure
        const interpolatedStop = { ...toStop };
        if (fromStop.color && toStop.color) {
          interpolatedStop.color = interpolateRGBA(
            transition,
            fromStop.color,
            toStop.color,
          );
        }
        interpolatedColors.push(interpolatedStop);
      } else {
        // For same-type transitions, fully interpolate
        interpolatedColors.push(
          interpolateColorStop(transition, fromStop, toStop),
        );
      }
    } else if (toStop) {
      // Only target stop exists - use it as-is
      interpolatedColors.push(toStop);
    } else if (fromStop && strategy === "same-type") {
      // Only source stop exists - for same-type we might want to fade it out
      // For now, skip it (it will disappear)
    }
    // Skip fromStop-only cases in cross transitions
  }

  return interpolatedColors;
};
const interpolateColorStopToColor = (transition, colorStop, targetColor) => {
  const colorStopColor = colorStop.color;
  if (!colorStopColor) {
    return colorStop;
  }
  const colorInterpolated = interpolateRGBA(
    transition,
    colorStopColor,
    targetColor,
  );
  return {
    ...colorStop,
    color: colorInterpolated,
  };
};

// Helper to interpolate from a source color toward a color stop
const interpolateColorToColorStop = (transition, sourceColor, colorStop) => {
  const colorStopColor = colorStop.color;
  if (!colorStopColor) {
    return colorStop;
  }
  const colorInterpolated = interpolateRGBA(
    transition,
    sourceColor,
    colorStopColor,
  );
  return {
    ...colorStop,
    color: colorInterpolated,
  };
};

// Helper functions for image object detection
const isGradientObject = (imageObj) => {
  return (
    imageObj &&
    typeof imageObj === "object" &&
    imageObj.type &&
    imageObj.type.includes("gradient")
  );
};

const gradientHasColors = (gradientObj) => {
  return (
    gradientObj.colors &&
    Array.isArray(gradientObj.colors) &&
    gradientObj.colors.length > 0
  );
};
