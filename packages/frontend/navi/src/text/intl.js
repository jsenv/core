const navigator = typeof window === "undefined" ? undefined : window.navigator;
const browserLang =
  typeof navigator !== "undefined"
    ? (navigator.language ?? navigator.languages?.[0])
    : undefined;

export const createIntl = () => {
  const languageMap = new Map();

  const add = (lang, translations) => {
    // Derived language inherits all keys not explicitly overridden
    // e.g. "fr-provencal" inherits from "fr"
    const dashIndex = lang.indexOf("-");
    if (dashIndex !== -1) {
      const parentLang = lang.slice(0, dashIndex);
      const parentTranslations = languageMap.get(parentLang);
      if (parentTranslations) {
        translations = { ...parentTranslations, ...translations };
      }
    }
    languageMap.set(lang, translations);
  };

  const format = (key, values, { lang = browserLang } = {}) => {
    const resolvedLang = matchBestLang(lang, languageMap);
    const translations = resolvedLang ? languageMap.get(resolvedLang) : null;
    let template = key;
    if (translations) {
      const translation = translations[key];
      if (translation !== undefined) {
        template = Array.isArray(translation)
          ? selectPluralForm(translation, values, resolvedLang)
          : translation;
      }
    }
    return interpolate(template, values);
  };

  return { add, format };
};

// Walk "fr-CA-variant" → "fr-CA" → "fr" until a registered lang is found
const matchLang = (lang, languageMap) => {
  if (languageMap.has(lang)) return lang;
  const parts = lang.split("-");
  while (parts.length > 1) {
    parts.pop();
    const candidate = parts.join("-");
    if (languageMap.has(candidate)) return candidate;
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

// forms[0] = singular ("one"), forms[1] = plural ("other")
// Uses Intl.PluralRules for correct locale-aware selection
const selectPluralForm = (forms, values, lang) => {
  if (forms.length <= 1) return forms[0] ?? "";
  const count = values?.count;
  if (count === undefined) return forms[0];
  try {
    const category = new Intl.PluralRules(lang).select(count);
    return category === "one" ? forms[0] : (forms[1] ?? forms[0]);
  } catch {
    return count === 1 ? forms[0] : (forms[1] ?? forms[0]);
  }
};

const interpolate = (template, values) => {
  if (!values || typeof template !== "string") return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = values[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
};
