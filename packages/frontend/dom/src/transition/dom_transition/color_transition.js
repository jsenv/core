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

  // Interpolate color stops if they exist
  if (gradientImage.stops && Array.isArray(gradientImage.stops)) {
    interpolatedGradient.stops = gradientImage.stops.map((stop) => {
      if (stop.color) {
        const stopColor = stop.color;
        if (stopColor) {
          // Interpolate each channel toward the target color
          const [rFrom, gFrom, bFrom, aFrom] = stopColor;
          const [rTo, gTo, bTo, aTo] = targetColor;
          const r = Math.round(rFrom + (rTo - rFrom) * progress);
          const g = Math.round(gFrom + (gTo - gFrom) * progress);
          const b = Math.round(bFrom + (bTo - bFrom) * progress);
          const a = aFrom + (aTo - aFrom) * progress;
          return { ...stop, color: [r, g, b, a] };
        }
      }
      return stop;
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

  // Interpolate color stops if both have them
  if (
    fromGradient.stops &&
    toGradient.stops &&
    Array.isArray(fromGradient.stops) &&
    Array.isArray(toGradient.stops)
  ) {
    // Use the longer stops array as base, interpolate corresponding stops
    const maxStops = Math.max(
      fromGradient.stops.length,
      toGradient.stops.length,
    );
    interpolatedGradient.stops = [];

    for (let i = 0; i < maxStops; i++) {
      const fromStop = fromGradient.stops[i];
      const toStop = toGradient.stops[i];

      if (fromStop && toStop) {
        // Both stops exist - interpolate them
        const interpolatedStop = { ...toStop };

        if (fromStop.color && toStop.color) {
          const fromColor = fromStop.color;
          const toColor = toStop.color;

          if (fromColor && toColor) {
            const [rFrom, gFrom, bFrom, aFrom] = fromColor;
            const [rTo, gTo, bTo, aTo] = toColor;
            const r = Math.round(rFrom + (rTo - rFrom) * progress);
            const g = Math.round(gFrom + (gTo - gFrom) * progress);
            const b = Math.round(bFrom + (bTo - bFrom) * progress);
            const a = aFrom + (aTo - aFrom) * progress;
            interpolatedStop.color = [r, g, b, a];
          }
        }

        // TODO: Could also interpolate position if both have positions
        interpolatedGradient.stops.push(interpolatedStop);
      } else if (toStop) {
        // Only target stop exists - use it as-is
        interpolatedGradient.stops.push({ ...toStop });
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

  // Interpolate color stops if they exist
  if (targetGradient.stops && Array.isArray(targetGradient.stops)) {
    interpolatedGradient.stops = targetGradient.stops.map((stop) => {
      if (stop.color) {
        const targetStopColor = stop.color;
        if (targetStopColor && fromColor) {
          // Interpolate from the solid color toward each gradient stop color
          const [rFrom, gFrom, bFrom, aFrom] = fromColor;
          const [rTo, gTo, bTo, aTo] = targetStopColor;
          const r = Math.round(rFrom + (rTo - rFrom) * progress);
          const g = Math.round(gFrom + (gTo - gFrom) * progress);
          const b = Math.round(bFrom + (bTo - bFrom) * progress);
          const a = aFrom + (aTo - aFrom) * progress;
          return { ...stop, color: [r, g, b, a] };
        }
      }
      return stop;
    });
  }

  return interpolatedGradient;
};
