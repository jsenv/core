import { langSignal } from "./lang_signal.js";

/**
 * Creates a lightweight i18n instance scoped to a set of translations.
 *
 * @param {object} [options]
 * @param {string|string[]} [options.systemLang]
 *   The preferred language (BCP 47 tag or ordered array of tags).
 *   Defaults to `langSignal.peek()` (browser language at creation time).
 *   Used to pick the best registered translation when calling `format()`.
 *
 * @returns {{ add: Function, addAll: Function, addLangKeys: Function, format: Function, languageMap: Map }}
 *
 * ---
 *
 * **`add(key, translations)`** — primary API
 *
 * Registers one translation key across multiple languages at once.
 * The key (the concept) is central, languages are secondary.
 * Multiple calls for the same key are merged (later values win).
 *
 * A regional variant (e.g. `"fr-CA"`) automatically inherits all keys
 * from its parent (`"fr"`) that it does not explicitly override.
 *
 * @example
 * intl.add("Hello [name]!", { fr: "Bonjour [name] !" });
 * intl.add("minute", { fr: "minute" });
 * intl.add("minutes", { fr: "minutes" });
 *
 * ---
 *
 * **`addAll(keyMap)`** — multi-key API
 *
 * Registers multiple keys at once. Equivalent to calling `add()` for each entry.
 * Convenient when defining a feature's full translation set in one place.
 *
 * @example
 * intl.addAll({
 *   hello:            { en: "Hello [name]!",   fr: "Bonjour [name] !" },
 *   bye:              { en: "Goodbye!",        fr: "Au revoir !" },
 *   "minute":         { en: "minute",          fr: "minute"  },
 *   "minute__plural": { en: "minutes",         fr: "minutes" },
 * });
 *
 * ---
 *
 * **`addLangKeys(lang, translations)`** — language-pack API
 *
 * Registers all keys for one language at once. Useful when loading a
 * translation JSON file or registering a full language pack.
 * Multiple calls for the same `lang` are merged (later keys win).
 *
 * A variant (e.g. `"fr-CA"`) inherits from its base language (`"fr"`).
 * You can override individual keys in the variant without redefining all of them:
 *
 * @example
 * // Load a full language pack:
 * intl.addLangKeys("fr", { hello: "Bonjour [name] !", bye: "Au revoir !" });
 *
 * // A variant only needs to specify what differs from the base language:
 * intl.addLangKeys("fr-CA", { hello: "Allo [name] !" }); // inherits "bye" from "fr"
 *
 * ---
 *
 * **`format(key, values?, { lang? })`**
 *
 * Returns the translation for `key` in the best available language.
 * Placeholders `[name]` in the template are replaced by `values`.
 * Falls back to `key` itself when no translation is found.
 *
 * @example
 * intl.format("hello", { name: "Alice" })               // "Bonjour Alice !" (if systemLang="fr")
 * intl.format("hello", { name: "Bob" }, { lang: "en" }) // "Hello Bob!"
 */
export const createIntl = ({ systemLang = langSignal.peek() } = {}) => {
  const languageMap = new Map();

  let defaultLang = systemLang;

  const addLangKeys = (lang, translations) => {
    // Accumulate: merge with any existing translations for this lang
    const existing = languageMap.get(lang);
    if (existing) {
      translations = { ...existing, ...translations };
    }
    // A regional variant inherits all keys not explicitly overridden
    // e.g. "fr-CA" inherits from "fr"
    const dashIndex = lang.indexOf("-");
    if (dashIndex !== -1) {
      const parentLang = lang.slice(0, dashIndex);
      const parentTranslations = languageMap.get(parentLang);
      if (parentTranslations) {
        translations = { ...parentTranslations, ...translations };
      }
    }
    languageMap.set(lang, translations);
    defaultLang = matchBestLang(systemLang, languageMap);
  };

  const add = (key, langTranslations) => {
    for (const [lang, value] of Object.entries(langTranslations)) {
      addLangKeys(lang, { [key]: value });
    }
  };

  const addAll = (keyMap) => {
    for (const [key, langTranslations] of Object.entries(keyMap)) {
      add(key, langTranslations);
    }
  };

  const _getTranslationTemplate = (key, lang) => {
    if (!lang) {
      return key;
    }
    const translations = languageMap.get(lang);
    if (!translations) {
      return key;
    }
    const template = translations[key];
    if (!template) {
      return key;
    }
    return template;
  };

  const format = (key, values, { lang = defaultLang } = {}) => {
    const template = _getTranslationTemplate(key, lang);
    if (!values || typeof template !== "string") {
      return template;
    }
    return template.replace(/\[(\w+)\]/g, (_, k) => {
      const value = values[k];
      return value !== undefined ? String(value) : `[${k}]`;
    });
  };

  return { languageMap, add, addAll, addLangKeys, format };
};
const matchLang = (lang, languageMap) => {
  if (languageMap.has(lang)) {
    return lang;
  }
  const parts = lang.split("-");
  while (parts.length > 1) {
    parts.pop();
    const candidate = parts.join("-");
    if (languageMap.has(candidate)) {
      return candidate;
    }
  }
  return null;
};

// lang can be a string or an ordered array of preference strings
const matchBestLang = (lang, languageMap) => {
  if (!lang) {
    return null;
  }
  const candidates = Array.isArray(lang) ? lang : [lang];
  for (const candidate of candidates) {
    const match = matchLang(candidate, languageMap);
    if (match) {
      return match;
    }
  }
  return null;
};
