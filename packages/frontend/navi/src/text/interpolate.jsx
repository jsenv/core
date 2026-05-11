import { interpolateText } from "./interpolate_text.js";

/*
 * Technical note: although the component is named Interpolate and its primary
 * use-case is text, it can render any mix of strings and JSX elements — 99% of
 * the time it is used for text though.
 *
 * Why use Interpolate instead of plain JSX?
 *
 * Without Interpolate, the sentence is scattered across JSX expressions:
 *
 * ```jsx
 * // harder to read — the full sentence is not visible at once
 * // cannot be used as an i18n key
 * Données limitées à <Text bold>{radius} km</Text> autour de
 *   {zoneName || "votre zone"}.
 * ```
 *
 * With Interpolate, the full sentence is visible in one place:
 *
 * ```jsx
 * // readable — the sentence reads as prose
 * // i18n-ready — the template string is a plain JS-free key
 * <Interpolate radiusKm={<Text bold>{radius} km</Text>} zoneName={zoneName || "votre zone"}>
 *   Données limitées à [radiusKm] autour de [zoneName].
 * </Interpolate>
 * ```
 *
 * Why [key] syntax was chosen for placeholders:
 *
 * {} / ${} / {{}}  — interpreted by JSX; using them would force wrapping the
 *                    whole string in an expression, defeating the readability
 *                    goal.
 *
 * %key%            — common in sprintf-style libraries, but the doubled %% hurts
 *                    readability. It also carries the implicit expectation of
 *                    format specifiers (cast to string/number, padding…) that
 *                    this component does not support, which would mislead readers.
 *
 * :key:            — visually clean, but the colon conflicts with punctuation.
 *                    Compare: "Hello :name:. How are you?"
 *                         vs  "Hello [name]. How are you?"
 *                    The period after :name: is ambiguous at a glance.
 *
 * <key>            — not possible; JSX treats it as an opening tag.
 */

/**
 * Renders a template string with [key] placeholders replaced by props.
 * Replacement values can be strings or JSX elements.
 * Returns a plain string when all replacements are strings, a fragment otherwise.
 *
 * Keeps the full sentence readable in one place and makes the string
 * i18n-ready, since the template contains no JSX expressions.
 *
 * @example
 * <Interpolate radiusKm={<Text bold>50 km</Text>} zoneName="votre zone">
 *   Données limitées à [radiusKm] autour de [zoneName].
 * </Interpolate>
 */
export const Interpolate = ({ children, ...replacements }) => {
  return interpolateText(children, replacements);
};
