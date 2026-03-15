const navigator = typeof window === "undefined" ? undefined : window.navigator;
const browserLang =
  typeof navigator !== "undefined"
    ? (navigator.language ?? navigator.languages?.[0])
    : undefined;

export const createIntl = ({ systemLang = browserLang } = {}) => {
  const languageMap = new Map();

  let bestLang = systemLang;

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

    bestLang = matchBestLang(lang, languageMap);
  };

  const format = (key, values, { lang = bestLang } = {}) => {
    const translationMap = languageMap.get(lang);
    const translationTemplate = translationMap.get(key);
    if (!translationTemplate) {
      return interpolate(key, values);
    }
    return interpolate(translationTemplate, values);
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

const interpolate = (template, values) => {
  if (!values || typeof template !== "string") return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = values[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
};
