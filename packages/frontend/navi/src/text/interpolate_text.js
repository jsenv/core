import { Fragment, h, isValidElement } from "preact";

/**
 * Interpolates a template string, replacing `[key]` placeholders with values.
 *
 * Usable on its own — no i18n instance required — whenever a sentence should
 * stay readable as one string instead of being cut into JSX expressions or
 * concatenations. `<Interpolate>` is the JSX form of this function, and
 * `createI18n` runs every translation through it. See `docs/i18n.md`.
 *
 * `[]` was chosen as the placeholder delimiter (rather than `{}` or `{{}}`)
 * because it does not conflict with JSX syntax, JavaScript template literals,
 * or common punctuation in translated strings.
 *
 * @param {string} template
 *   e.g. `"Hello [name], you have [count] messages"`. A non-string is returned
 *   untouched, as is any template when `replacements` is missing.
 * @param {object} [replacements]
 *   Values keyed by placeholder name. A key can be:
 *   - a direct name — `[name]` ← `{ name: "Alice" }`
 *   - a dot-path — `[item.label]` ← `{ item: { label: "Book" } }` (a literal
 *     `"item.label"` key wins over the path)
 *
 *   A value that is a function is called at that point, so an expensive or
 *   lazily-known replacement is only computed when the placeholder is actually
 *   present in this language's template.
 *
 *   A placeholder with no matching value is left in the output as-is
 *   (`"[name]"`), making the gap visible rather than silently empty.
 * @param {object} [options]
 * @param {boolean} [options.allowJsx=false]
 *   Allow VNode replacements (what `<Interpolate>` passes). Without it, a VNode
 *   value warns and is coerced to a string.
 * @returns {string|import("preact").VNode}
 *   A plain string when every replacement is a string, a Preact fragment when
 *   at least one VNode was interpolated with `allowJsx`.
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
    const key = match[1];
    let value = resolveValue(replacements, key, part);
    if (typeof value === "function") {
      value = value();
    }
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

// Resolves a placeholder key against the replacements object.
// 1. Direct lookup: replacements["item.name"]
// 2. Dot-path lookup: replacements["item"]["name"]
// 3. Fallback: the original placeholder string (e.g. "[item.name]")
const resolveValue = (replacements, key, fallback) => {
  if (key in replacements) {
    return replacements[key];
  }
  const dotIndex = key.indexOf(".");
  if (dotIndex !== -1) {
    const head = key.slice(0, dotIndex);
    const tail = key.slice(dotIndex + 1);
    const parent = replacements[head];
    if (parent && typeof parent === "object") {
      const nested = parent[tail];
      if (nested !== undefined) {
        return nested;
      }
    }
  }
  return fallback;
};
