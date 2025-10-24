/**
 * Calculates the contrast ratio between two RGB colors
 * Based on WCAG 2.1 specification
 * @param {Array<number>} rgb1 - [r, g, b] values for first color
 * @param {Array<number>} rgb2 - [r, g, b] values for second color
 * @returns {number} Contrast ratio (1-21)
 */
export const getContrastRatio = (rgb1, rgb2) => {
  const lum1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const lum2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
};

/**
 * Calculates the relative luminance of an RGB color
 * Based on WCAG 2.1 specification
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {number} Relative luminance (0-1)
 */
const getLuminance = (r, g, b) => {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};
