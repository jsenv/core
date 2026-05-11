import { interpolateText } from "./interpolate_text.js";
import { langSignal } from "./lang_signal.js";

/**
 * Creates a lightweight i18n instance for translating text in the current locale.
 *
 * @param {object} [options]
 * @param {string} [options.keyLang]
 *   When set, each key also serves as its own translation for `keyLang`.
 *   This allows writing keys directly in that language (typically English) so
 *   only other languages need to be registered:
 *
 *   ```js
 *   const i18n = createI18n({ keyLang: "en" });
 *   i18n.add("Hello [name]!", { fr: "Bonjour [name] !" });
 *   i18n("Hello [name]!", { name: "Alice" }); // "Hello Alice!"    (en — key is template)
 *   i18n("Hello [name]!", { name: "Alice" }); // "Bonjour Alice !" (fr)
 *   ```
 *
 *   Without `keyLang`, keys are opaque identifiers and all languages (including
 *   the fallback) must be registered explicitly:
 *
 *   ```js
 *   const i18n = createI18n();
 *   i18n.add("greeting", { en: "Hello [name]!", fr: "Bonjour [name] !" });
 *   i18n("greeting", { name: "Alice" }); // "Hello Alice!" (en)
 *   ```
 *
 * @param {string|string[]} [options.systemLang]
 *   The active user language (BCP 47 tag or ordered array of tags).
 *   Defaults to `langSignal.peek()` (browser language at creation time).
 *
 * ---
 *
 * ## Bulk registration
 *
 * **`i18n.add(key, { lang: "translation" })`** — one key, multiple languages.
 *
 * **`i18n.addAll({ key: { lang: "translation" }, ... })`** — multiple keys at once.
 *
 * **`i18n.addLangKeys(lang, { key: "translation", ... })`** — full language pack
 * (useful when loading a JSON translation file).
 *
 * A regional variant (e.g. `"fr-CA"`) automatically inherits all keys from its
 * parent (`"fr"`) that it does not explicitly override:
 * ```js
 * i18n.addLangKeys("fr", { hello: "Bonjour !" });
 * i18n.addLangKeys("fr-CA", { hello: "Allo !" }); // other "fr" keys inherited
 * ```
 *
 * ---
 *
 * @returns {Function & { add, addAll, addLangKeys, format, languageMap }}
 *   A callable function — `i18n(key, values?, { lang? })` — with the same
 *   signature as `i18n.format()`. `format` is kept as an alias.
 */
export const createI18n = ({
  keyLang,
  fallbackLang,
  systemLang = langSignal.peek(),
} = {}) => {
  const languageMap = new Map();

  let activeLang = systemLang;

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
    activeLang = matchBestLang(systemLang, languageMap);
  };

  const add = (key, langTranslations) => {
    if (keyLang && !(keyLang in langTranslations)) {
      // Auto-register the key itself as the translation for keyLang
      addLangKeys(keyLang, { [key]: key });
    }
    for (const [lang, value] of Object.entries(langTranslations)) {
      addLangKeys(lang, { [key]: value });
    }
  };

  const addAll = (keyMap) => {
    for (const [key, langTranslations] of Object.entries(keyMap)) {
      add(key, langTranslations);
    }
  };

  const _getTemplate = (key, lang) => {
    const resolvedLang = lang ? matchLang(lang, languageMap) : null;
    if (resolvedLang) {
      const translations = languageMap.get(resolvedLang);
      const translated = translations[key];
      if (translated !== undefined) {
        return translated;
      }
    }
    if (fallbackLang) {
      const resolvedFallbackLang = matchLang(fallbackLang, languageMap);
      if (resolvedFallbackLang) {
        const fallbackTranslations = languageMap.get(resolvedFallbackLang);
        const fallbackTranslated = fallbackTranslations[key];
        if (fallbackTranslated !== undefined) {
          return fallbackTranslated;
        }
      }
    }
    // No translation found — return key as-is (opaque fallback)
    return key;
  };

  const format = (key, values, { lang = activeLang } = {}) => {
    const template = _getTemplate(key, lang);
    return interpolateText(template, values);
  };

  // The i18n instance is itself a callable function
  const i18n = (key, values, opts) => format(key, values, opts);
  i18n.add = add;
  i18n.addAll = addAll;
  i18n.addLangKeys = addLangKeys;
  i18n.format = format;
  i18n.languageMap = languageMap;

  return i18n;
};

// Walk "fr-CA-variant" → "fr-CA" → "fr" until a registered lang is found
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
