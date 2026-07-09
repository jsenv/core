import { signal } from "@preact/signals";

const DEFAULT_LANG = "en";

const getBrowserLang = () => {
  if (typeof window === "undefined") {
    return DEFAULT_LANG;
  }
  const { navigator } = window;
  if (typeof navigator === "undefined") {
    return DEFAULT_LANG;
  }
  const { language } = navigator;
  if (typeof language === "string") {
    return language;
  }
  const { languages } = navigator;
  if (Array.isArray(languages) && languages.length > 0) {
    return languages[0];
  }
  return DEFAULT_LANG;
};

// Set by setForcedLang() below — kept outside the signal itself so
// "languagechange" can keep recomputing the browser-lang half of the value
// (see computeLangValue) without ever clobbering the override.
let forcedLang = null;

// [forcedLang, browserLang] once forced, rather than forcedLang alone: this
// package's own i18n (matchLang/matchBestLang, see i18n.js) and native Intl
// constructors (Intl.NumberFormat/DateTimeFormat) both accept an ordered
// locale array and try each in turn — so anything not covered by forcedLang
// (a key with no translation for it yet, a locale Intl doesn't recognize)
// still falls back to the user's real language, never straight to an
// unrelated default like "en".
const computeLangValue = () => {
  const browserLang = getBrowserLang();
  return forcedLang ? [forcedLang, browserLang] : browserLang;
};

export const langSignal = signal(computeLangValue());

/**
 * Forces the active language application-wide, regardless of the browser's
 * own setting — every navi component/util defaulting to `langSignal.value`
 * (naviI18n, formatNumber, the Time components, validation messages…)
 * picks this up. Not simply `langSignal.value = lang`: that alone wouldn't
 * survive the next "languagechange" event (still listened to below, and it
 * would silently overwrite a plain assignment), and it would lose the
 * user's real language as a fallback for anything `lang` doesn't cover.
 *
 * @param {string} lang - BCP 47 tag to force, e.g. "fr".
 */
export const setForcedLang = (lang) => {
  forcedLang = lang;
  langSignal.value = computeLangValue();
};

if (typeof window !== "undefined") {
  window.addEventListener("languagechange", () => {
    langSignal.value = computeLangValue();
  });
}
