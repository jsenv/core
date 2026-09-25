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
 *   Language consulted for a key none of the requested languages translates,
 *   before giving up and returning the key itself. Set it to a language holding
 *   every key whenever keys are opaque: without it, a reader whose languages
 *   all miss a key sees that key's raw name.
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
 * `i18n.format` is an alias of this call.
 *
 * The language is resolved per key, not once for the whole registry: each
 * requested language in order (`lang`, else `runtimeLang` — a regional tag
 * reaching its registered parent, `"de-DE"` → `"de"`), then `fallbackLang`;
 * the first one translating `key` wins. A language translated for only part of
 * the keys therefore reads its own words where it has them and the next
 * language's everywhere else. When none translates it, `key` itself comes
 * back, so an untranslated string still renders something readable.
 *
 * **`i18n.has(key, { lang? })`** — whether a translation genuinely exists in
 * one of the languages above, i.e. how to tell "no translation" apart from
 * "translation equal to the key".
 *
 * @returns {Function & { add, addAll, addLangKeys, has, format, languageMap }}
 */
export const createI18n = ({ keyLang, fallbackLang, runtimeLang } = {}) => {
  const languageMap = new Map();
  // Bumped by addLangKeys — the only thing besides the requested lang itself
  // that could change what resolveLangChain() below resolves to, so it's what
  // invalidates its small cache.
  let languageMapVersion = 0;

  // Without an explicit runtimeLang, the runtime language source is re-read
  // fresh on every call rather than frozen here — freezing it would silently
  // ignore an app-wide language change (see runtime_lang.js) for the rest of
  // this instance's life.
  const hasExplicitRuntimeLang = runtimeLang !== undefined;
  const getDefaultLang = () => {
    return hasExplicitRuntimeLang ? runtimeLang : getRuntimeLang();
  };

  // Walked per key rather than one language picked for the whole registry: a
  // registry is rarely translated evenly (@jsenv/humanize ships German time
  // words, navi ships its buttons in en/fr only), and a single language would
  // show the raw name of every key it lacks. Cached on the lang reference,
  // which the runtime lang source keeps stable while nothing changed.
  let cachedLangChain;
  let cachedLangChainLang;
  let cachedLangChainVersion = -1;
  const resolveLangChain = (lang) => {
    if (
      cachedLangChainVersion === languageMapVersion &&
      cachedLangChainLang === lang
    ) {
      return cachedLangChain;
    }
    const langChain = [];
    for (const candidate of [
      ...toLangList(lang),
      ...toLangList(fallbackLang),
    ]) {
      const match = matchLang(candidate, languageMap);
      if (match && !langChain.includes(match)) {
        langChain.push(match);
      }
    }
    cachedLangChain = langChain;
    cachedLangChainLang = lang;
    cachedLangChainVersion = languageMapVersion;
    return langChain;
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

  const getTemplate = (key, lang) => {
    for (const resolvedLang of resolveLangChain(lang)) {
      const translated = languageMap.get(resolvedLang)[key];
      if (translated !== undefined) {
        return translated;
      }
    }
    // No translation found — return key as-is (opaque fallback)
    return key;
  };

  const format = (key, values, { lang = getDefaultLang() } = {}) => {
    const template = getTemplate(key, lang);
    return interpolateText(template, values);
  };

  const has = (key, { lang = getDefaultLang() } = {}) => {
    for (const resolvedLang of resolveLangChain(lang)) {
      if (key in languageMap.get(resolvedLang)) {
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

// lang can be a string, an ordered array of preference strings, or nothing
const toLangList = (lang) => {
  if (!lang) {
    return [];
  }
  if (Array.isArray(lang)) {
    return lang;
  }
  return [lang];
};
