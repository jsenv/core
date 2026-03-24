import { contrastColor, resolveCSSColor } from "@jsenv/dom";
import { useLayoutEffect } from "preact/hooks";

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
 */

export const useDarkBackgroundAttribute = (
  ref,
  deps = [],
  {
    backgroundElementSelector,
    attributeName = "data-dark-background",
    hardcoded = {},
  } = {},
) => {
  const innerDeps = [
    ...deps,
    // ref can change is the component pass a different ref on different render based on some logic
    // (can be used to control which element backgroundColor is being checked by switching the ref to another element)
    ref,
    // backgroundElementSelector can change if the component pass a different selector on different render based on some logic
    // (can be used to control which element backgroundColor is being checked by switching the selector to point to another element)
    backgroundElementSelector,
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
      return null;
    }
    let elementToCheck = el;
    if (backgroundElementSelector) {
      elementToCheck = el.querySelector(backgroundElementSelector);
      if (!elementToCheck) {
        return null;
      }
    }
    const computedStyle = getComputedStyle(elementToCheck);
    const backgroundColor = computedStyle.backgroundColor;
    if (!backgroundColor) {
      el.removeAttribute(attributeName);
      return null;
    }
    const backgroundColorString = normalizeColorString(backgroundColor, el);
    const hardcodedContrast = hardcodedMap.get(backgroundColorString);
    const contrastingColor =
      hardcodedContrast || contrastColor(backgroundColor, el);
    if (contrastingColor === "white") {
      el.setAttribute(attributeName, "");
      return () => {
        el.removeAttribute(attributeName);
      };
    }
    el.removeAttribute(attributeName);
    return null;
  }, innerDeps);
};

const normalizeColorString = (color, el) => {
  const colorRgba = resolveCSSColor(color, el);
  if (!colorRgba) {
    return "";
  }
  return String(colorRgba);
};
