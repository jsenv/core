/**
 * Named presets for the `charGuard` prop.
 * Each value is a regex character class (including the [ ] delimiters).
 */
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
};

// Presets that imply a specific mobile keyboard layout
const INPUT_MODE_FROM_PRESET = {
  numeric: "numeric",
  pin: "numeric",
  card: "numeric",
  tel: "tel",
};

// Specific i18n keys per preset — more informative than the generic fallback
const MESSAGE_KEY_FROM_PRESET = {
  numeric: "constraint.guard.number",
  pin: "constraint.guard.number",
  alpha: "constraint.guard.alpha",
  alphanumeric: "constraint.guard.alphanumeric",
  uppercase: "constraint.guard.uppercase",
  hex: "constraint.guard.hex",
  slug: "constraint.guard.slug",
  // tel, card, postal, iban, custom → generic fallback
};

/**
 * Returns the regex character class for a preset name, or the raw value as-is
 * if it's not a known preset (allows custom classes like "[A-Z0-9_]").
 */
export const resolveCharClass = (value) => {
  if (!value) return null;
  return CHAR_CLASS_PRESETS[value] ?? value;
};

/**
 * Returns the inputMode to auto-apply for the given preset, or null.
 */
export const resolveInputModeFromAllowedChars = (value) => {
  return INPUT_MODE_FROM_PRESET[value] ?? null;
};

/**
 * Returns the i18n key for the char guard rejection message.
 * Falls back to the generic "constraint.guard.chars" for custom classes and
 * presets without a specific message.
 */
export const getCharGuardMessageKey = (value) => {
  return MESSAGE_KEY_FROM_PRESET[value] ?? "constraint.guard.chars";
};
