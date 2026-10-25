import { getRuntimeLang } from "../i18n/runtime_lang.js";
import { memoIntl } from "../utils/memo_intl.js";

/**
 * Writes a number the way the reader's language does: its digit grouping and
 * its decimal separator ("1 234,5" in French, "1,234.5" in English).
 *
 * @param {number} value
 * @param {{ lang?: string } & Intl.NumberFormatOptions} [options]
 *   Every other option is `Intl.NumberFormat`'s, in the reader's language: a
 *   fixed precision (`minimumFractionDigits`/`maximumFractionDigits`), a sign
 *   (`signDisplay: "exceptZero"`), a percent (`style: "percent"`).
 *
 * @example
 * formatNumber(1234.5, { lang: "fr" }) // "1 234,5"
 * formatNumber(1, { lang: "fr", minimumFractionDigits: 1, maximumFractionDigits: 1 }) // "1,0"
 * formatNumber(12, { lang: "fr", signDisplay: "exceptZero" }) // "+12"
 */
export const formatNumber = (
  value,
  { lang = getRuntimeLang(), ...intlOptions } = {},
) => {
  return memoIntl("NumberFormat", lang, intlOptions).format(value);
};
