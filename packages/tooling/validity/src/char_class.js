/**
 * A character class says which characters a value may hold. It is written as a
 * regex character class *body* (brackets included, nothing else) rather than a
 * full pattern, so the same string can be tested against a whole value here and
 * against a single keystroke by a field — see @jsenv/navi's `charGuard`.
 *
 * Compilation always uses the `u` flag: it is what lets `\p{...}` be recognized
 * and what makes a range cover whole code points instead of the two halves an
 * astral character (an emoji) is made of.
 */

// An emoji is a character *presented* as one: a character whose default
// presentation is emoji, a regional indicator (the halves of a flag), or any
// character carrying U+FE0F, the selector that asks for emoji presentation.
// Written this way "\u00a9" and "\u2194" stay text — only "\u00a9\ufe0f" and
// "\u2194\ufe0f" are emoji — which is what someone typing © in a name means.
const EMOJI_CHARS = "\\p{Emoji_Presentation}\\p{Regional_Indicator}\\uFE0F";
export const EMOJI_CHAR_CLASS = `[${EMOJI_CHARS}]`;

/** Named character classes, usable wherever a `charClass` is expected. */
export const CHAR_CLASS_PRESETS = {
  numeric: "[0-9]", // digits only
  alpha: "[A-Za-z]", // letters only
  alphanumeric: "[0-9A-Za-z]", // letters and digits
  decimal: "[-0-9.,]", // digits, minus, dot, comma
  uppercase: "[A-Z]", // uppercase letters only
  tel: "[-0-9+() ]", // phone: digits, +, -, parens, space
  email: "[a-zA-Z0-9._%+@-]", // email characters
  card: "[0-9 ]", // credit card: digits and spaces
  hex: "[0-9A-Fa-f]", // hexadecimal digits
  pin: "[0-9]", // numeric PIN
  postal: "[0-9A-Za-z -]", // postal code (FR, UK, US)
  iban: "[0-9A-Z]", // IBAN: uppercase and digits
  slug: "[a-z0-9-]", // URL slug
  noEmoji: `[^${EMOJI_CHARS}]`, // anything but an emoji
};

// Presets a sentence can name precisely; the others (tel, card, postal, iban…)
// and any custom class fall back to the generic message.
const MESSAGE_KEY_FROM_PRESET = {
  numeric: "char_class.numeric",
  pin: "char_class.numeric",
  alpha: "char_class.alpha",
  alphanumeric: "char_class.alphanumeric",
  uppercase: "char_class.uppercase",
  hex: "char_class.hex",
  slug: "char_class.slug",
  noEmoji: "char_class.no_emoji",
};

/**
 * The character class for a preset name, or the value as-is when it is already
 * a class (e.g. `"[A-Z0-9_]"`, `"[^\\p{Cc}]"`).
 */
export const resolveCharClass = (value) => {
  if (!value) {
    return null;
  }
  return CHAR_CLASS_PRESETS[value] ?? value;
};

/** The message key for a value refused by `charClass`. */
export const getCharClassMessageKey = (value) => {
  return MESSAGE_KEY_FROM_PRESET[value] ?? "char_class.default";
};

const charClassRegexCache = new Map();
/** Matches one character against the class. */
export const compileCharClass = (charClass) => {
  const fromCache = charClassRegexCache.get(charClass);
  if (fromCache) {
    return fromCache;
  }
  const regex = new RegExp(charClass, "u");
  charClassRegexCache.set(charClass, regex);
  return regex;
};

const anchoredCharClassRegexCache = new Map();
/** Matches a whole value: every character of it must be in the class. */
export const compileCharClassAnchored = (charClass) => {
  const fromCache = anchoredCharClassRegexCache.get(charClass);
  if (fromCache) {
    return fromCache;
  }
  const regex = new RegExp(`^(?:${charClass})*$`, "u");
  anchoredCharClassRegexCache.set(charClass, regex);
  return regex;
};
