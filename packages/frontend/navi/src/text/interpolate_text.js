import { isValidElement } from "preact";

/**
 * Interpolates a template string, replacing [key] placeholders with values.
 * Values can be strings or JSX elements. Returns a plain string when all
 * replacements are strings, or a JSX fragment otherwise.
 *
 * `[]` was chosen as the placeholder delimiter (rather than `{}` or `{{}}`)
 * because it does not conflict with JSX syntax, JavaScript template literals,
 * or common punctuation in translated strings. It is also the delimiter used
 * by the <Interpolate> component, which provides the JSX-first API built on
 * top of this function — see interpolate.jsx for details and usage examples.
 */
export const interpolateText = (template, replacements) => {
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
      hasVnode = true;
    }
    resolved.push(value);
  }
  if (!hasVnode) {
    return resolved.join("");
  }
  return <>{resolved}</>;
};
