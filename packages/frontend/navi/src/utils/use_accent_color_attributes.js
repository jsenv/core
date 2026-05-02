import { useLayoutEffect } from "preact/hooks";

import { contrastColor, resolveOklchLightness } from "@jsenv/dom";
import { NAVI_PSEUDO_STATE_CUSTOM_EVENT } from "../box/pseudo_styles.js";

const LIGHT_ACCENT_ATTRIBUTE = "data-accent-light";
const VERY_LIGHT_ACCENT_ATTRIBUTE = "data-accent-very-light";
const DARK_CONTRAST_ATTRIBUTE = "data-accent-needs-dark-fg";
const LIGHT_LUMINANCE_THRESHOLD = 0.5;
const VERY_LIGHT_LUMINANCE_THRESHOLD = 0.92;
const DARK_CONTRAST_LIGHTNESS_THRESHOLD = 0.65;

/**
 * Sets data attributes on an element based on the OKLCH lightness and contrast
 * of a CSS color (typically an accent/brand color). All thresholds use OKLCH L
 * (0–1, perceptually uniform scale).
 *
 * Three boolean attributes are managed independently:
 *
 * ## `data-accent-light` (set when OKLCH L > 0.5)
 *   The accent color is perceptually light (orange, green, pink, yellow…).
 *   Use to adjust color-mix direction so hover/active effects darken toward
 *   black instead of lightening toward white.
 *
 * ## `data-accent-very-light` (set when OKLCH L > 0.92)
 *   The accent color is near-white or white. Use to show a grey background on
 *   unchecked state so the component boundary remains visible against white
 *   page backgrounds.
 *
 * ## `data-accent-needs-dark-fg` (set when OKLCH L > 0.65)
 *   The best contrasting foreground color against the accent is dark (black).
 *   Use to render checkmarks, icons, or text in a dark color instead of white.
 *
 * @param {import("preact").RefObject} ref - Ref to the root element that receives the attributes.
 * @param {Array} deps - Extra dependency values that should re-trigger the effect (e.g. [accentColor]).
 * @param {object} [options]
 * @param {string} [options.elementSelector] - CSS selector to find the element whose computed color is read.
 *   Defaults to the root element itself. Useful when the color is applied to a probe/child element.
 * @param {string} [options.colorProperty="backgroundColor"] - Computed style property to read (e.g. "color", "borderColor").
 */
export const useAccentColorAttributes = (
  ref,
  accentColor,
  { elementSelector, colorProperty = "backgroundColor" } = {},
) => {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }
    let elementToCheck = el;
    if (elementSelector) {
      elementToCheck = el.querySelector(elementSelector);
      if (!elementToCheck) {
        return undefined;
      }
    }
    const updateAttributes = () => {
      const computedStyle = getComputedStyle(elementToCheck);
      const color = computedStyle[colorProperty];
      if (!color) {
        el.removeAttribute(LIGHT_ACCENT_ATTRIBUTE);
        el.removeAttribute(VERY_LIGHT_ACCENT_ATTRIBUTE);
        el.removeAttribute(DARK_CONTRAST_ATTRIBUTE);
        return;
      }
      const luminance = resolveOklchLightness(color, el);
      if (luminance !== null && luminance > LIGHT_LUMINANCE_THRESHOLD) {
        el.setAttribute(LIGHT_ACCENT_ATTRIBUTE, "");
      } else {
        el.removeAttribute(LIGHT_ACCENT_ATTRIBUTE);
      }
      if (luminance !== null && luminance > VERY_LIGHT_LUMINANCE_THRESHOLD) {
        el.setAttribute(VERY_LIGHT_ACCENT_ATTRIBUTE, "");
      } else {
        el.removeAttribute(VERY_LIGHT_ACCENT_ATTRIBUTE);
      }
      const bestContrast = contrastColor(
        color,
        el,
        DARK_CONTRAST_LIGHTNESS_THRESHOLD,
      );
      if (bestContrast === "black") {
        el.setAttribute(DARK_CONTRAST_ATTRIBUTE, "");
      } else {
        el.removeAttribute(DARK_CONTRAST_ATTRIBUTE);
      }
    };
    updateAttributes();
    el.addEventListener(NAVI_PSEUDO_STATE_CUSTOM_EVENT, updateAttributes);
    return () => {
      el.removeEventListener(NAVI_PSEUDO_STATE_CUSTOM_EVENT, updateAttributes);
      el.removeAttribute(LIGHT_ACCENT_ATTRIBUTE);
      el.removeAttribute(VERY_LIGHT_ACCENT_ATTRIBUTE);
      el.removeAttribute(DARK_CONTRAST_ATTRIBUTE);
    };
  }, [ref, accentColor, elementSelector, colorProperty]);
};
