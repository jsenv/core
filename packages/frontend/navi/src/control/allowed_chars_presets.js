/**
 * Named presets for the `allowedCharsGuard` prop.
 * Each value is a regex character class (including the [ ] delimiters).
 */
export const CHAR_CLASS_PRESETS = {
  numeric:      "[0-9]",         // digits only
  alpha:        "[A-Za-z]",      // letters only
  alphanumeric: "[0-9A-Za-z]",   // letters and digits
  uppercase:    "[A-Z]",         // uppercase letters only
  tel:          "[-0-9+() ]",    // phone: digits, +, -, parens, space
  card:         "[0-9 ]",        // credit card: digits and spaces
  hex:          "[0-9A-Fa-f]",   // hexadecimal digits
  pin:          "[0-9]",         // numeric PIN
  postal:       "[0-9A-Za-z -]", // postal code (FR, UK, US)
  iban:         "[0-9A-Z]",      // IBAN: uppercase and digits
  slug:         "[a-z0-9-]",     // URL slug
};

// Presets that imply a specific mobile keyboard layout
const INPUT_MODE_FROM_PRESET = {
  numeric: "numeric",
  pin:     "numeric",
  card:    "numeric",
  tel:     "tel",
};

// Presets where "digits only" is the right error message
const NUMERIC_MESSAGE_PRESETS = new Set(["numeric", "pin"]);

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
 * Returns true when the preset is numeric-flavoured and should use the
 * "digits only" error message rather than the generic "allowed chars" one.
 */
export const isNumericAllowedChars = (value) => {
  return NUMERIC_MESSAGE_PRESETS.has(value);
};
