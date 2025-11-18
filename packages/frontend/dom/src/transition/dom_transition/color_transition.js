import { updateRGBA } from "../../style/parsing/css_color.js";
import { interpolate } from "../transition_playback.js";

// Helper function to prepare color transition pairs, handling edge cases
export const prepareRGBATransitionPair = (fromColor, toColor) => {
  const fromUnset = !fromColor;
  const toUnset = !toColor;

  // Both unset - no transition needed
  if (fromUnset && toUnset) {
    return null;
  }
  // Handle unset cases by using transparent versions
  if (fromUnset) {
    const toFullyTransparent = updateRGBA(toColor, { a: 0 });
    return [toFullyTransparent, toColor];
  }
  if (toUnset) {
    const fromFullyTransparent = updateRGBA(fromColor, { a: 0 });
    return [fromColor, fromFullyTransparent];
  }
  // Handle fully transparent cases
  const fromFullyTransparent = fromColor[3] === 0;
  const toFullyTransparent = toColor[3] === 0;
  if (fromFullyTransparent && toFullyTransparent) {
    return [fromColor, toColor];
  }
  if (fromFullyTransparent) {
    const toFullTransparent = updateRGBA(toColor, { a: 0 });
    return [toFullTransparent, toColor];
  }
  if (toFullyTransparent) {
    const fromFullyTransparent = updateRGBA(fromColor, { a: 0 });
    return [fromColor, fromFullyTransparent];
  }
  return [fromColor, toColor];
};
export const interpolateRGBA = (transition, fromRGBA, toRGBA) => {
  const [rFrom, gFrom, bFrom, aFrom] = fromRGBA;
  const [rTo, gTo, bTo, aTo] = toRGBA;
  const r = interpolate(transition, rFrom, rTo);
  const g = interpolate(transition, gFrom, gTo);
  const b = interpolate(transition, bFrom, bTo);
  const a = interpolate(transition, aFrom, aTo);
  return [r, g, b, a];
};

// Helper to interpolate gradient color stops toward a target color
export const interpolateGradientToColor = (
  transition,
  gradientImage,
  targetColor,
) => {
  // Interpolate colors if they exist
  if (!gradientImage.colors || !Array.isArray(gradientImage.colors)) {
    return gradientImage;
  }
  const interpolatedColors = gradientImage.colors.map((colorStop) => {
    const colorStopColor = colorStop.color;
    if (!colorStopColor) {
      return colorStop;
    }
    const interpolatedRGBA = interpolateRGBA(
      transition,
      colorStopColor,
      targetColor,
    );
    const inerpolatedColorStop = {
      ...colorStop,
      color: interpolatedRGBA,
    };
    return inerpolatedColorStop;
  });
  const interpolatedGradient = { ...gradientImage, colors: interpolatedColors };
  return interpolatedGradient;
};

// Helper to interpolate between two gradients of the same type
export const interpolateGradient = (transition, fromGradient, toGradient) => {
  if (fromGradient.type !== toGradient.type) {
    return toGradient; // Different types, return target
  }

  const fromColors = fromGradient.colors;
  const toColors = toGradient.colors;
  if (!fromColors || !toColors) {
    return toGradient;
  }
  if (!Array.isArray(fromColors) || !Array.isArray(toColors)) {
    return toGradient;
  }

  // Use the longer colors array as base, interpolate corresponding stops
  const maxStops = Math.max(fromColors.length, toColors.length);
  const interpolatedColors = [];
  for (let i = 0; i < maxStops; i++) {
    const fromStop = fromColors[i];
    const toStop = toColors[i];

    if (fromStop && toStop) {
      const interpolatedStop = { ...toStop };
      const fromStopColor = fromStop.color;
      const toStopColor = toStop.color;
      if (fromStopColor && toStopColor) {
        const interpolatedStopColor = interpolateRGBA(
          transition,
          fromStopColor,
          toStopColor,
        );
        interpolatedStop.color = interpolatedStopColor;
      }
      const fromStops = fromStop.stops;
      const toStops = toStop.stops;
      if (fromStops && toStops) {
        const interpolatedStops = interpolateColorStops(
          transition,
          fromStops,
          toStops,
        );
        interpolatedStop.stops = interpolatedStops;
      }
      interpolatedColors.push(interpolatedStop);
    } else if (toStop) {
      // Only target stop exists - use it as-is
      interpolatedColors.push(toStop);
    } else if (fromStop) {
      // Only source stop exists - fade it toward transparent or skip
      // For now, skip it (it will disappear)
    }
  }
  const interpolatedGradient = {
    ...toGradient,
    colors: interpolatedColors,
  };
  return interpolatedGradient;
};

// Helper to interpolate from a solid color toward a gradient
export const interpolateColorToGradient = (
  transition,
  fromColor,
  targetGradient,
) => {
  const colors = targetGradient.colors;
  if (!colors || !Array.isArray(colors) || !fromColor) {
    return targetGradient;
  }
  const interpolatedColors = targetGradient.colors.map((colorStop) => {
    const colorStopColor = colorStop.color;
    if (!colorStopColor) {
      return colorStop;
    }
    return {
      ...colorStop,
      color: interpolateRGBA(transition, fromColor, colorStopColor),
    };
  });
  return {
    ...targetGradient,
    colors: interpolatedColors,
  };
};

// Helper function to interpolate between two arrays of position stops
const interpolateColorStops = (transition, fromStops, toStops) => {
  if (!Array.isArray(fromStops) || !Array.isArray(toStops)) {
    return transition.value < 0.5 ? fromStops : toStops;
  }

  const maxLength = Math.max(fromStops.length, toStops.length);
  const result = [];
  for (let i = 0; i < maxLength; i++) {
    const fromStop = fromStops[i];
    const toStop = toStops[i];

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
        result.push({
          isNumeric: true,
          value: interpolatedValue,
          unit: fromStop.unit,
        });
      } else {
        // Non-numeric or different units - use threshold
        result.push(transition.value < 0.5 ? fromStop : toStop);
      }
    } else {
      // Only one exists - use it
      result.push(fromStop || toStop);
    }
  }

  return result;
};
