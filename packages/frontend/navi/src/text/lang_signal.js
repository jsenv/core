import { computed, signal } from "@preact/signals";

const DEFAULT_LANG = "en";

/**
 * The browser's own language preferences, most preferred first — read from
 * `navigator.languages` (falling back to the single `navigator.language`,
 * then to DEFAULT_LANG when neither is available, e.g. during SSR). Kept as
 * its own signal, independent from what this app actually supports — see
 * `supportedLanguagesSignal` below for the allow-list that filters it, and
 * `languagesSignal` for the final, ready-to-use combination of the two (plus
 * `preferredLanguageSignal`).
 */
const getRuntimeLanguages = () => {
  if (typeof window === "undefined") {
    return [DEFAULT_LANG];
  }
  const { navigator } = window;
  if (typeof navigator === "undefined") {
    return [DEFAULT_LANG];
  }
  const { languages } = navigator;
  if (Array.isArray(languages) && languages.length > 0) {
    return languages;
  }
  const { language } = navigator;
  if (typeof language === "string") {
    return [language];
  }
  return [DEFAULT_LANG];
};

export const runtimeLanguagesSignal = signal(getRuntimeLanguages());

if (typeof window !== "undefined") {
  window.addEventListener("languagechange", () => {
    runtimeLanguagesSignal.value = getRuntimeLanguages();
  });
}

/**
 * The languages this app actually offers, e.g. `["en", "fr"]` — an allow-list
 * `languagesSignal` below filters everything else against (runtime languages the
 * browser reports, and `preferredLanguageSignal`'s own override), so a site
 * that only supports English/French never ends up resolving to German just
 * because that happens to be the browser's or the user's own preference.
 *
 * `null` (the default) means no restriction at all: every language the
 * browser/user prefers is allowed through, matching this module's previous,
 * unrestricted behavior.
 */
export const supportedLanguagesSignal = signal(null);

/**
 * @param {string[]|null} languages - e.g. `["en", "fr"]`. Pass `null`/`[]`
 *   to lift the restriction again (allow everything).
 */
export const setSupportedLanguages = (languages) => {
  supportedLanguagesSignal.value =
    languages && languages.length ? languages : null;
};

/**
 * A single language the user explicitly chose (e.g. via an in-app language
 * picker), overriding whatever the browser itself reports — takes priority
 * over `runtimeLanguagesSignal` in `languagesSignal` below, but is still subject
 * to `supportedLanguagesSignal`'s own allow-list.
 *
 * Deliberately a single language, not an ordered list: reordering *among*
 * several preferred languages is real complexity real users essentially
 * never want — the practical need `languagesSignal` needs to serve is "let this
 * one user pick their one preferred language instead of the browser's",
 * nothing more.
 */
export const preferredLanguageSignal = signal(null);

/**
 * @param {string|null} language - BCP 47 tag, e.g. "fr". Pass `null` to
 *   go back to following the browser's own language.
 */
export const setPreferredLanguage = (language) => {
  preferredLanguageSignal.value = language || null;
};

const getPrimarySubtag = (lang) => lang.split("-")[0];

const isLanguageSupported = (lang, supportedLanguages) => {
  const primarySubtag = getPrimarySubtag(lang);
  return supportedLanguages.some(
    (supportedLanguage) =>
      getPrimarySubtag(supportedLanguage) === primarySubtag,
  );
};

/**
 * The ordered, ready-to-use language preference list every navi
 * component/util defaults to (naviI18n, formatNumber, the Time components,
 * validation messages…), live on every read. Combines, in priority order:
 *
 * 1. `preferredLanguageSignal` (the user's own explicit pick, if any)
 * 2. `runtimeLanguagesSignal` (the browser's own ordered preferences)
 *
 * then filters the result through `supportedLanguagesSignal` (if set) so
 * only languages this app actually offers ever come out — e.g. a browser
 * preferring `["de", "fr", "en"]` on a site that only supports `["en",
 * "fr"]` resolves to `["fr", "en"]`, never touching German. If filtering
 * would leave nothing at all (none of the browser's/user's preferences are
 * supported), falls back to `supportedLanguagesSignal` itself so callers
 * still get *something* usable rather than an empty array.
 *
 * Consumers that accept either a single lang or an ordered array (this
 * package's own `matchBestLang`/`createI18n`, and native `Intl.NumberFormat`/
 * `Intl.DateTimeFormat`) can pass this straight through: anything not
 * covered by the first entry falls through to the next, rather than
 * jumping straight to an unrelated default like "en".
 */
export const languagesSignal = computed(() => {
  const preferredLanguage = preferredLanguageSignal.value;
  const runtimeLanguages = runtimeLanguagesSignal.value;
  const supportedLanguages = supportedLanguagesSignal.value;

  const orderedLanguages = preferredLanguage
    ? [preferredLanguage, ...runtimeLanguages]
    : runtimeLanguages;
  const dedupedLanguages = [...new Set(orderedLanguages)];

  if (!supportedLanguages) {
    return dedupedLanguages;
  }
  const filteredLanguages = dedupedLanguages.filter((lang) =>
    isLanguageSupported(lang, supportedLanguages),
  );
  return filteredLanguages.length > 0 ? filteredLanguages : supportedLanguages;
});
