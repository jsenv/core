import { interpolateText } from "./interpolate_text.js";
import { getRuntimeLang } from "./runtime_lang.js";

/**
 * Creates a lightweight i18n instance: a central place where an app declares
 * its texts once and reads them back translated into the active language.
 *
 * Worth using even in a single-language app — one registry beats strings
 * scattered across components, and adding a second language later becomes a
 * data change instead of a refactor. See @jsenv/navi's `docs/i18n.md` for how
 * to choose between the two key styles below and how this relates to
 * `humanizeI18n`, the registry the built-in texts live in.
 *
 * @param {object} [options]
 * @param {string} [options.keyLang]
 *   When set, each key also serves as its own translation for `keyLang`.
 *   This allows writing keys directly in that language (typically the language
 *   the app is written in) so only *other* languages need registering:
 *
 *   ```js
 *   const i18n = createI18n({ keyLang: "en" });
 *   i18n.add("Hello [name]!", { fr: "Bonjour [name] !" });
 *   i18n("Hello [name]!", { name: "Alice" }, { lang: "en" }); // "Hello Alice!"
 *   i18n("Hello [name]!", { name: "Alice" }, { lang: "fr" }); // "Bonjour Alice !"
 *   ```
 *
 *   `keyLang` only applies to keys passed to `add()`/`addAll()`; a key never
 *   registered stays opaque and comes back as-is.
 *
 *   Without `keyLang`, keys are opaque identifiers and every language
 *   (including the one the app was written in) must be registered explicitly:
 *
 *   ```js
 *   const i18n = createI18n();
 *   i18n.add("greeting", { en: "Hello [name]!", fr: "Bonjour [name] !" });
 *   i18n("greeting", { name: "Alice" }, { lang: "en" }); // "Hello Alice!"
 *   ```
 *
 * @param {string} [options.fallbackLang]
 *   Language consulted when the active language has no translation for a key
 *   — per key, not per language: a partially translated language falls through
 *   to `fallbackLang` only for the keys it is missing. Without it, a missing
 *   translation returns the key itself.
 *
 * @param {string|string[]} [options.runtimeLang]
 *   The active language (BCP 47 tag or ordered array of tags) — named
 *   "runtime" rather than "system" because there is no actual access to the
 *   OS/user's system language from a browser, only `navigator.languages` (or
 *   an explicit override) at runtime. Defaults to the shared runtime language
 *   source (see runtime_lang.js) — the runtime's own locale, or whatever a
 *   frontend installed in its place — read fresh on every `format()`/`has()`
 *   call (not frozen at creation time), so overriding the language app-wide
 *   is picked up here too.
 *   Passing an explicit `runtimeLang` opts out of that and stays fixed for
 *   this instance's whole lifetime.
 *
 * ---
 *
 * ## Registration
 *
 * **`i18n.add(key, { lang: "translation" })`** — one key, multiple languages.
 *
 * **`i18n.addAll({ key: { lang: "translation" }, ... })`** — multiple keys at once.
 *
 * **`i18n.addLangKeys(lang, { key: "translation", ... })`** — full language pack
 * (useful when loading a JSON translation file).
 *
 * All three accumulate: registering a key that already exists overwrites that
 * one key and leaves the rest of the language untouched. This is what lets an
 * app override a single built-in text without redeclaring the others.
 *
 * A regional variant (e.g. `"fr-CA"`) automatically inherits all keys from its
 * parent (`"fr"`) that it does not explicitly override:
 * ```js
 * i18n.addLangKeys("fr", { hello: "Bonjour !" });
 * i18n.addLangKeys("fr-CA", { hello: "Allo !" }); // other "fr" keys inherited
 * ```
 * Inheritance is resolved at registration time, so register the parent first.
 *
 * ---
 *
 * ## Reading
 *
 * **`i18n(key, values?, { lang? })`** — the translation for `key`, with
 * `[placeholder]` occurrences replaced from `values` (see `interpolateText`).
 * Returns `key` itself when nothing matches, so an untranslated string still
 * renders something readable. `i18n.format` is an alias of this call.
 *
 * **`i18n.has(key, { lang? })`** — whether a translation genuinely exists,
 * i.e. how to tell "no translation" apart from "translation equal to the key".
 *
 * @returns {Function & { add, addAll, addLangKeys, has, format, languageMap }}
 */
export const createI18n = ({ keyLang, fallbackLang, runtimeLang } = {}) => {
  const languageMap = new Map();
  // Bumped by addLangKeys — the only thing besides the active lang itself
  // that could change what getActiveLang()/getResolvedFallbackLang() below
  // resolve to, so it's what invalidates their own small caches.
  let languageMapVersion = 0;

  // Without an explicit runtimeLang, the runtime language source is re-read
  // fresh on every call rather than frozen here — freezing it would silently
  // ignore an app-wide language change (see runtime_lang.js) for the rest of
  // this instance's life.
  const hasExplicitRuntimeLang = runtimeLang !== undefined;

  // matchBestLang does real work (a Map lookup per candidate, a possible
  // "fr-CA" → "fr" split-and-retry loop) — worth skipping on every single
  // format()/has() call in the common case, since what it resolves to only
  // ever changes when languageMap itself changes (addLangKeys) or, for the
  // non-explicit case, when the runtime lang itself changes (see
  // runtime_lang.js; an installed source is expected to keep its reference
  // stable while nothing changed, and the default one caches its string) —
  // comparing those two cheaply (===) is enough to know the cached result
  // below is still valid.
  let cachedActiveLang;
  let cachedActiveLangRuntimeLang;
  let cachedActiveLangVersion = -1;
  const getActiveLang = () => {
    const currentRuntimeLang = hasExplicitRuntimeLang
      ? runtimeLang
      : getRuntimeLang();
    if (
      cachedActiveLangVersion === languageMapVersion &&
      cachedActiveLangRuntimeLang === currentRuntimeLang
    ) {
      return cachedActiveLang;
    }
    cachedActiveLang = matchBestLang(currentRuntimeLang, languageMap);
    cachedActiveLangVersion = languageMapVersion;
    cachedActiveLangRuntimeLang = currentRuntimeLang;
    return cachedActiveLang;
  };

  // fallbackLang is a plain, never-reactive option set once at creation —
  // its own resolution only ever needs recomputing when languageMap does.
  let cachedResolvedFallbackLang;
  let cachedResolvedFallbackLangVersion = -1;
  const getResolvedFallbackLang = () => {
    if (!fallbackLang) {
      return null;
    }
    if (cachedResolvedFallbackLangVersion === languageMapVersion) {
      return cachedResolvedFallbackLang;
    }
    cachedResolvedFallbackLang = matchBestLang(fallbackLang, languageMap);
    cachedResolvedFallbackLangVersion = languageMapVersion;
    return cachedResolvedFallbackLang;
  };

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
    languageMapVersion++;
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
    // matchBestLang, not matchLang directly: lang can be an ordered array of
    // preferences, and matchLang alone assumes a plain string, throwing on
    // .split() otherwise.
    const resolvedLang = lang ? matchBestLang(lang, languageMap) : null;
    if (resolvedLang) {
      const translations = languageMap.get(resolvedLang);
      const translated = translations[key];
      if (translated !== undefined) {
        return translated;
      }
    }
    const resolvedFallbackLang = getResolvedFallbackLang();
    if (resolvedFallbackLang) {
      const fallbackTranslations = languageMap.get(resolvedFallbackLang);
      const fallbackTranslated = fallbackTranslations[key];
      if (fallbackTranslated !== undefined) {
        return fallbackTranslated;
      }
    }
    // No translation found — return key as-is (opaque fallback)
    return key;
  };

  const format = (key, values, { lang = getActiveLang() } = {}) => {
    const template = _getTemplate(key, lang);
    return interpolateText(template, values);
  };

  const has = (key, { lang = getActiveLang() } = {}) => {
    const resolvedLang = lang ? matchBestLang(lang, languageMap) : null;
    if (resolvedLang) {
      const translations = languageMap.get(resolvedLang);
      if (translations && key in translations) {
        return true;
      }
    }
    const resolvedFallbackLang = getResolvedFallbackLang();
    if (resolvedFallbackLang) {
      const fallbackTranslations = languageMap.get(resolvedFallbackLang);
      if (fallbackTranslations && key in fallbackTranslations) {
        return true;
      }
    }
    return false;
  };

  // The i18n instance is itself a callable function
  const i18n = (key, values, opts) => format(key, values, opts);
  i18n.add = add;
  i18n.addAll = addAll;
  i18n.addLangKeys = addLangKeys;
  i18n.has = has;
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
