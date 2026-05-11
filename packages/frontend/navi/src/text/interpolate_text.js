/**
 * Interpolates a template string, replacing [key] placeholders with values.
 * Values can be strings or JSX elements. Returns a plain string when all
 * replacements are strings, or a JSX fragment otherwise.
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
    if (value !== null && typeof value === "object") {
      hasVnode = true;
    }
    resolved.push(value);
  }
  if (!hasVnode) {
    return resolved.join("");
  }
  return <>{resolved}</>;
};
