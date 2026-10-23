import { getRuntimeLang } from "../i18n/runtime_lang.js";

/**
 * Writes a number the way the reader's language does: its digit grouping and
 * its decimal separator ("1 234,5" in French, "1,234.5" in English).
 *
 * @param {number} value
 * @param {{ lang?: string }} [options]
 *
 * @example
 * formatNumber(1234.5, { lang: "fr" }) // "1 234,5"
 */
export const formatNumber = (value, { lang = getRuntimeLang() } = {}) => {
  return new Intl.NumberFormat(lang).format(value);
};
