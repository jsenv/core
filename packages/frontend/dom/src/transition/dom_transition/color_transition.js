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
export const applyColorTransition = (rgbaPair, transition) => {
  const [fromColor, toColor] = rgbaPair;
  const [rFrom, gFrom, bFrom, aFrom] = fromColor;
  const [rTo, gTo, bTo, aTo] = toColor;

  const r = applyTransitionProgress(transition, rFrom, rTo);
  const g = applyTransitionProgress(transition, gFrom, gTo);
  const b = applyTransitionProgress(transition, bFrom, bTo);
  const a = applyTransitionProgress(transition, aFrom, aTo);
  return [r, g, b, a];
};
