import { Fragment, h, isValidElement } from "preact";

/**
 * Interpolates a template string, replacing [key] placeholders with values.
 * Values can be strings or JSX elements (when allowJsx is true).
 * Returns a plain string when all replacements are strings, or a Preact
 * fragment when JSX values are present and allowJsx is enabled.
 *
 * `[]` was chosen as the placeholder delimiter (rather than `{}` or `{{}}`)
 * because it does not conflict with JSX syntax, JavaScript template literals,
 * or common punctuation in translated strings.
 *
 * Pass `allowJsx: true` to enable VNode replacements (used by <Interpolate>).
 * Without it, all values are coerced to strings.
 */
export const interpolateText = (
  template,
  replacements,
  { allowJsx = false } = {},
) => {
  if (!replacements || typeof template !== "string") {
    return template;
  }
  const parts = template.split(/(\[[^\]]+\])/);
  let hasVnode = false;
  const resolved = [];
  for (const part of parts) {
    const match = part.match(/^\[([^\]]+)\]$/);
    if (!match) {
      resolved.push(part);
      continue;
    }
    const value = replacements[match[1]] ?? part;
    if (isValidElement(value)) {
      if (allowJsx) {
        hasVnode = true;
      } else {
        console.warn(
          `interpolateText: VNode passed for placeholder [${match[1]}] but allowJsx is false — value coerced to string`,
        );
      }
    }
    resolved.push(value);
  }
  if (!hasVnode) {
    return resolved.join("");
  }
  // h(Fragment) instead of JSX (<>{resolved}</>) to keep this file as .js
  return h(Fragment, null, resolved);
};
