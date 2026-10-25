import { getRuntimeLang } from "../i18n/runtime_lang.js";
import { memoIntl } from "../utils/memo_intl.js";

/**
 * Writes a size in bytes for the reader of an app, in their language: its
 * unit's name or symbol and its decimal separator — "39,6 ko", "4,2 Mo" in
 * French, "39.6 kB" in English. Its neighbour humanizeFileSize writes the
 * terminal's English whatever the language.
 *
 * The unit is the largest power of 1000 the size reaches (kilobyte, megabyte…,
 * up to the petabyte, the last unit Intl names), with one decimal under 100
 * and none above, as humanizeFileSize picks it.
 *
 * @param {number} bytes
 * @param {{ lang?: string, unitDisplay?: "short"|"long"|"narrow", decimals?: number }} [options]
 * @param {"short"|"long"|"narrow"} [options.unitDisplay="short"]
 *   `"short"` writes the symbol ("39,6 ko"), `"long"` the word ("39,6
 *   kilooctets").
 * @param {number} [options.decimals]
 *   How many decimals the size keeps at most, rounded; a whole value is never
 *   padded.
 *
 * @example
 * formatByteSize(39600, { lang: "fr" })                      // "39,6 ko"
 * formatByteSize(4200000, { lang: "fr", unitDisplay: "long" }) // "4,2 mégaoctets"
 * formatByteSize(39600, { lang: "en" })                      // "39.6 kB"
 */
export const formatByteSize = (
  bytes,
  { lang = getRuntimeLang(), unitDisplay = "short", decimals } = {},
) => {
  if (!Number.isFinite(bytes)) {
    return String(bytes);
  }
  // The unit is picked on the magnitude; Intl writes the sign.
  const magnitude = bytes < 0 ? -bytes : bytes;
  let exponent = 0;
  while (
    exponent < BYTE_UNITS.length - 1 &&
    magnitude >= 1000 ** (exponent + 1)
  ) {
    exponent++;
  }
  let maximumFractionDigits =
    decimals === undefined
      ? magnitude / 1000 ** exponent < 100
        ? 1
        : 0
      : decimals;
  // 999 960 bytes rounds to 1000 kB: written in the next unit, "1 MB".
  if (
    exponent < BYTE_UNITS.length - 1 &&
    roundTo(magnitude / 1000 ** exponent, maximumFractionDigits) >= 1000
  ) {
    exponent++;
    maximumFractionDigits = decimals === undefined ? 1 : decimals;
  }
  return memoIntl("NumberFormat", lang, {
    style: "unit",
    unit: BYTE_UNITS[exponent],
    unitDisplay,
    maximumFractionDigits,
  }).format(bytes / 1000 ** exponent);
};

// The byte units Intl.NumberFormat sanctions.
const BYTE_UNITS = [
  "byte",
  "kilobyte",
  "megabyte",
  "gigabyte",
  "terabyte",
  "petabyte",
];

const roundTo = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
