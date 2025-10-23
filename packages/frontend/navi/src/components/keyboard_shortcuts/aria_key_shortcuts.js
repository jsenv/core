import { keyMapping } from "./keyboard_key_meta.js";
import { isMac } from "./os.js";

// http://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-keyshortcuts
export const generateAriaKeyShortcuts = (key) => {
  let actualCombination;

  // Handle platform-specific combination objects
  if (typeof key === "object" && key !== null) {
    actualCombination = isMac ? key.mac : key.other;
  } else {
    actualCombination = key;
  }

  if (actualCombination) {
    return normalizeKeyCombination(actualCombination);
  }

  return "";
};

const normalizeKeyCombination = (combination) => {
  const lowerCaseCombination = combination.toLowerCase();
  const keys = lowerCaseCombination.split("+");

  // First normalize keys to their canonical form, then apply ARIA mapping
  for (let i = 0; i < keys.length; i++) {
    let key = normalizeKey(keys[i]);

    // Then apply ARIA-specific mappings if they exist
    if (keyToAriaKeyMapping[key]) {
      key = keyToAriaKeyMapping[key];
    }

    keys[i] = key;
  }

  return keys.join("+");
};
const keyToAriaKeyMapping = {
  // Platform-specific ARIA names
  command: "meta",
  option: "altgraph", // Mac option key uses "altgraph" in ARIA spec

  // Regular keys - platform-specific normalization
  delete: isMac ? "backspace" : "delete", // Mac delete key is backspace semantically
  backspace: isMac ? "backspace" : "delete",
};
const normalizeKey = (key) => {
  key = key.toLowerCase();

  // Find the canonical form for this key
  for (const [canonicalKey, config] of Object.entries(keyMapping)) {
    const allKeys = [canonicalKey, ...config.alias];
    if (allKeys.includes(key)) {
      return canonicalKey;
    }
  }

  return key;
};
