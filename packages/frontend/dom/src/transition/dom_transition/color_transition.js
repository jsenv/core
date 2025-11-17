import { updateRGBA } from "../../style/parsing/css_color.js";
import { applyTransitionProgress } from "../transition_playback.js";

// Helper function to prepare color transition pairs, handling edge cases
export const prepareColorTransitionPair = (fromColor, toColor) => {
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
export const applyColorToColor = (rgbaPair, transition) => {
  const [fromColor, toColor] = rgbaPair;
  const [rFrom, gFrom, bFrom, aFrom] = fromColor;
  const [rTo, gTo, bTo, aTo] = toColor;

  const r = applyTransitionProgress(transition, rFrom, rTo);
  const g = applyTransitionProgress(transition, gFrom, gTo);
  const b = applyTransitionProgress(transition, bFrom, bTo);
  const a = applyTransitionProgress(transition, aFrom, aTo);
  return [r, g, b, a];
};

// Helper to interpolate gradient color stops toward a target color
export const applyGradientToColor = (gradientImage, targetColor, progress) => {
  // Clone the gradient image object
  const interpolatedGradient = { ...gradientImage };

  // Interpolate colors if they exist
  if (gradientImage.colors && Array.isArray(gradientImage.colors)) {
    interpolatedGradient.colors = gradientImage.colors.map((colorStop) => {
      if (colorStop.color) {
        const stopColor = colorStop.color;
        if (stopColor) {
          // Use applyColorToColor for consistent color interpolation
          const colorPair = [stopColor, targetColor];
          const transition = { value: progress };
          return {
            ...colorStop,
            color: applyColorToColor(colorPair, transition),
          };
        }
      }
      return colorStop;
    });
  }

  return interpolatedGradient;
};

// Helper to interpolate between two gradients of the same type
export const applyGradientToGradient = (fromGradient, toGradient, progress) => {
  if (fromGradient.type !== toGradient.type) {
    return toGradient; // Different types, return target
  }

  // Clone the target gradient as base
  const interpolatedGradient = { ...toGradient };

  // Interpolate colors if both have them
  if (
    fromGradient.colors &&
    toGradient.colors &&
    Array.isArray(fromGradient.colors) &&
    Array.isArray(toGradient.colors)
  ) {
    // Use the longer colors array as base, interpolate corresponding stops
    const maxStops = Math.max(
      fromGradient.colors.length,
      toGradient.colors.length,
    );
    interpolatedGradient.colors = [];

    for (let i = 0; i < maxStops; i++) {
      const fromStop = fromGradient.colors[i];
      const toStop = toGradient.colors[i];

      if (fromStop && toStop) {
        // Both stops exist - interpolate them
        const interpolatedStop = { ...toStop };

        if (fromStop.color && toStop.color) {
          const fromColor = fromStop.color;
          const toColor = toStop.color;

          if (fromColor && toColor) {
            // Use applyColorToColor for consistent color interpolation
            const colorPair = [fromColor, toColor];
            const transition = { value: progress };
            interpolatedStop.color = applyColorToColor(colorPair, transition);
          }
        }

        // Interpolate position stops if both have them
        if (fromStop.stops && toStop.stops) {
          interpolatedStop.stops = interpolateStops(
            fromStop.stops,
            toStop.stops,
            progress,
          );
        }
        interpolatedGradient.colors.push(interpolatedStop);
      } else if (toStop) {
        // Only target stop exists - use it as-is
        interpolatedGradient.colors.push({ ...toStop });
      } else if (fromStop) {
        // Only source stop exists - fade it toward transparent or skip
        // For now, skip it (it will disappear)
      }
    }
  }

  return interpolatedGradient;
};

// Helper to interpolate from a solid color toward a gradient
export const applyColorToGradient = (fromColor, targetGradient, progress) => {
  // Clone the target gradient as base
  const interpolatedGradient = { ...targetGradient };

  // Interpolate colors if they exist
  if (targetGradient.colors && Array.isArray(targetGradient.colors)) {
    interpolatedGradient.colors = targetGradient.colors.map((colorStop) => {
      if (colorStop.color) {
        const targetStopColor = colorStop.color;
        if (targetStopColor && fromColor) {
          // Use applyColorToColor for consistent color interpolation
          const colorPair = [fromColor, targetStopColor];
          const transition = { value: progress };
          return {
            ...colorStop,
            color: applyColorToColor(colorPair, transition),
          };
        }
      }
      return colorStop;
    });
  }

  return interpolatedGradient;
};

// Helper function to interpolate between two arrays of position stops
const interpolateStops = (fromStops, toStops, progress) => {
  if (!Array.isArray(fromStops) || !Array.isArray(toStops)) {
    return progress < 0.5 ? fromStops : toStops;
  }

  const maxLength = Math.max(fromStops.length, toStops.length);
  const result = [];

  for (let i = 0; i < maxLength; i++) {
    const fromStop = fromStops[i];
    const toStop = toStops[i];

    if (fromStop && toStop) {
      // Parse numeric values for interpolation
      const fromValue = parseStopValue(fromStop);
      const toValue = parseStopValue(toStop);

      if (
        fromValue.isNumeric &&
        toValue.isNumeric &&
        fromValue.unit === toValue.unit
      ) {
        const interpolatedValue =
          fromValue.value + (toValue.value - fromValue.value) * progress;
        result.push(`${interpolatedValue}${fromValue.unit}`);
      } else {
        // Non-numeric or different units - use threshold
        result.push(progress < 0.5 ? fromStop : toStop);
      }
    } else {
      // Only one exists - use it
      result.push(fromStop || toStop);
    }
  }

  return result;
};

// Helper to parse stop values for interpolation
const parseStopValue = (stop) => {
  const match = stop.match(/^([+-]?\d+(?:\.\d+)?|\d*\.\d+)(\D*)$/);
  if (match) {
    return {
      isNumeric: true,
      value: parseFloat(match[1]),
      unit: match[2] || "",
    };
  }
  return {
    isNumeric: false,
    value: stop,
    unit: "",
  };
};
