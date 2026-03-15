import { contrastColor } from "@jsenv/dom";
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
  { backgroundElementSelector, attributeName = "data-dark-background" } = {},
) => {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    let elementToCheck = el;
    if (backgroundElementSelector) {
      elementToCheck = el.querySelector(backgroundElementSelector);
      console.log({ el, backgroundElementSelector, elementToCheck });
      if (!elementToCheck) {
        return;
      }
    }
    const backgroundColor = getComputedStyle(elementToCheck).backgroundColor;
    if (!backgroundColor) {
      el.removeAttribute(attributeName);
      return;
    }

    const colorPicked = contrastColor(backgroundColor, el);
    if (colorPicked === "white") {
      el.setAttribute(attributeName, "");
    } else {
      el.removeAttribute(attributeName);
    }
  }, deps);
};
