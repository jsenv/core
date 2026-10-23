import { memoIntl } from "../utils/memo_intl.js";
import { getRuntimeLang } from "./runtime_lang.js";

/**
 * Which plural form a number takes in a language — `"one"`, `"other"`, and in
 * the languages that have them `"zero"`, `"two"`, `"few"`, `"many"` — as
 * `Intl.PluralRules` answers it. The rule is the language's, never `> 1`:
 * French says "0 place", English "0 seats", and Polish has three forms where
 * English has two.
 *
 * @param {number} count
 * @param {{ lang?: string | string[] }} [options]
 * @returns {"zero"|"one"|"two"|"few"|"many"|"other"}
 *
 * @example
 * pluralCategory(1, { lang: "en" })   // "one"
 * pluralCategory(0, { lang: "en" })   // "other"
 * pluralCategory(0, { lang: "fr" })   // "one"
 * pluralCategory(1.5, { lang: "fr" }) // "one"
 */
export const pluralCategory = (count, { lang = getRuntimeLang() } = {}) => {
  return memoIntl("PluralRules", lang).select(count);
};

// The form of `forms` a count reads: an exact number written as a key ({ 0:
// "Full" }) first, then the language's category, then `other`, which every
// set of forms has — it is also what the forms are registered under (see
// createI18n).
export const selectPluralForm = (forms, count, lang) => {
  const n = typeof count === "number" ? count : Number(count);
  if (count === undefined || count === null || !Number.isFinite(n)) {
    return forms.other;
  }
  const exact = forms[String(n)];
  if (exact !== undefined) {
    return exact;
  }
  const category = pluralCategory(n, { lang });
  const form = forms[category];
  return form === undefined ? forms.other : form;
};

export const isPluralForms = (value) => {
  return value !== null && typeof value === "object" && "other" in value;
};
