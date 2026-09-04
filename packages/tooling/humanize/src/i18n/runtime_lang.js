/**
 * The language every formatter/i18n call falls back to when it is given no
 * `lang` — an injectable source, deliberately free of any import.
 *
 * This module is the seam that keeps text formatting importable outside the
 * browser (a backend wording a date, say): by default the source is the
 * runtime's own locale, exactly what Intl itself would pick. A frontend swaps
 * the source for something live — @jsenv/navi points it at its
 * `languagesSignal`, so the fallback follows the user's language preference,
 * and because the source is read fresh on every call, reading it during a
 * component render subscribes the component the same way reading the signal
 * directly would.
 */

let systemLocale;
let runtimeLangSource = () => {
  systemLocale ??= new Intl.DateTimeFormat().resolvedOptions().locale;
  return systemLocale;
};

export const getRuntimeLang = () => runtimeLangSource();

/**
 * @param {() => string|string[]} source - Returns the language (BCP 47 tag,
 *   or an ordered preference array) to use when a call passes no `lang`.
 */
export const setRuntimeLangSource = (source) => {
  runtimeLangSource = source;
};
