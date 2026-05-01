import { contrastColor, resolveCSSColor } from "@jsenv/dom";
import { useLayoutEffect } from "preact/hooks";

import { NAVI_PSEUDO_STATE_CUSTOM_EVENT } from "../box/pseudo_styles.js";

/**
 * Toggles a `data-dark-background` attribute on the referenced element based on its
 * computed background color. Pair it with a CSS variable to get automatic
 * light/dark text without hard-coding colors:
 *
 * ```css
 * .my-element {
 *   --color-contrasting: black;
 *   &[data-dark-background] {
 *     --color-contrasting: white;
 *   }
 *   color: var(--color-contrasting);
 * }
 * ```
 *
 * - `data-dark-background` is **set** when the background is dark enough that white text
 *   provides better (or equal) contrast.
 * - `data-dark-background` is **absent** when black text is the better choice.
 *
 * @param {import("preact").RefObject} ref - Ref to the element that receives
 *   the `data-dark-background` attribute and is also passed to `contrastColor` for
 *   resolving CSS variables.
 * @param {object} [options]
 * @param {string} [options.backgroundElementSelector] - CSS selector relative
 *   to `ref.current` pointing to a child element whose `background-color`
 *   should be tested instead of the element itself. Useful when the element
 *   has a transparent background but contains a coloured child (e.g. a fill
 *   bar inside a track).
 * @param {string} [options.colorProperty] - CSS property to read instead of
 *   `background-color`. Useful for SVG elements where the color is expressed
 *   as `fill` or `stroke`.
 */
export const useDarkBackgroundAttribute = (
  ref,
  deps = [],
  {
    backgroundElementSelector,
    colorProperty = "backgroundColor",
    attributeName = "data-dark-background",
    invert = false,
    hardcoded = {},
  } = {},
) => {
  const innerDeps = [
    ...deps,
    // ref can change if the component passes a different ref on different renders
    // (e.g. to control which element's color is being checked by switching the ref)
    ref,
    // backgroundElementSelector can change if the component passes a different selector on different renders
    // (e.g. to control which child element's color is being checked by switching the selector)
    backgroundElementSelector,
    colorProperty,
  ];

  const hardcodedMap = new Map();
  for (const key of Object.keys(hardcoded)) {
    const value = hardcoded[key];
    innerDeps.push(key, value);
    const colorString = normalizeColorString(key);
    hardcodedMap.set(colorString, value);
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }
    let elementToCheck = el;
    if (backgroundElementSelector) {
      elementToCheck = el.querySelector(backgroundElementSelector);
      if (!elementToCheck) {
        return undefined;
      }
    }
    const updateAttribute = () => {
      const computedStyle = getComputedStyle(elementToCheck);
      const color = computedStyle[colorProperty];
      if (!color) {
        el.removeAttribute(attributeName);
        return;
      }
      const colorString = normalizeColorString(color, el);
      const hardcodedContrast = hardcodedMap.get(colorString);
      const contrastingColor = hardcodedContrast || contrastColor(color, el);
      const isDark = contrastingColor === "white";
      if (invert ? !isDark : isDark) {
        el.setAttribute(attributeName, "");
      } else {
        el.removeAttribute(attributeName);
      }
    };
    updateAttribute();
    el.addEventListener(NAVI_PSEUDO_STATE_CUSTOM_EVENT, updateAttribute);
    return () => {
      el.removeEventListener(NAVI_PSEUDO_STATE_CUSTOM_EVENT, updateAttribute);
      el.removeAttribute(attributeName);
    };
  }, innerDeps);
};

const normalizeColorString = (color, el) => {
  const colorRgba = resolveCSSColor(color, el);
  if (!colorRgba) {
    return "";
  }
  return String(colorRgba);
};
