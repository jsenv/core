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
