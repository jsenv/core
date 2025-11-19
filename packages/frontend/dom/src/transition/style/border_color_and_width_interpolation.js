import { interpolate } from "../transition_playback.js";
import {
  interpolateRGBA,
  prepareRGBATransitionPair,
} from "./color_interpolation.js";

export const getBorderColorAndWidthInterpolation = (fromBorder, toBorder) => {
  // If one side has no color, use transparent as fallback
  const fromBorderColor = fromBorder.color || "transparent";
  const toBorderColor = toBorder.color || "transparent";
  const getInterpolateBorderColor = () => {
    // Handle cases where one or both colors are undefined (e.g., border: none)
    if (!fromBorderColor && !toBorderColor) {
      return null;
    }
    const borderColorRgbaPair = prepareRGBATransitionPair(
      fromBorderColor,
      toBorderColor,
    );
    if (!borderColorRgbaPair) {
      return toBorderColor;
    }
    const [fromRGBA, toRGBA] = borderColorRgbaPair;
    return (transition) => {
      const rgbaInterpolated = interpolateRGBA(transition, fromRGBA, toRGBA);
      return rgbaInterpolated;
    };
  };

  const fromWidth = fromBorder.width || 0;
  const toWidth = toBorder.width || 0;
  const getInterpolateBorderWidth = () => {
    return (transition) => interpolate(transition, fromWidth, toWidth);
  };

  return {
    color: getInterpolateBorderColor(),
    width: getInterpolateBorderWidth(),
  };
};
