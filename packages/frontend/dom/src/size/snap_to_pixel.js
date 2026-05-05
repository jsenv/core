/**
 * Rounds a CSS pixel value to the nearest physical pixel boundary for the current display.
 *
 * At zoom levels other than 100%, `devicePixelRatio` is not an integer (e.g. 1.25, 1.5),
 * so fractional CSS pixel values from `getBoundingClientRect()` may not align to the physical
 * pixel grid. Setting `top`/`left` to such values causes the browser to interpolate across
 * pixels, resulting in blurry rendering or misalignment with adjacent elements.
 *
 * Snapping to the physical grid ensures the value falls exactly on a pixel boundary.
 *
 * @param {number} value - A CSS pixel value (e.g. from getBoundingClientRect or scroll offset).
 * @returns {number} The nearest physical-pixel-aligned CSS pixel value.
 * @example
 * // At devicePixelRatio 1.25, snapToPixel(154.4) → 154.4 (already on grid)
 * // At devicePixelRatio 1.25, snapToPixel(154.3) → 154.4
 */
export const snapToPixel = (value) => {
  return Math.round(value * devicePixelRatio) / devicePixelRatio;
};

// Round a CSS-pixel value to the nearest physical pixel boundary.
// At zoom levels other than 100%, devicePixelRatio is not an integer (e.g. 1.25, 1.5),
// so CSS pixels don't align 1:1 with physical pixels. Rounding to the physical grid
// ensures the browser can render the element without sub-pixel blurring.
