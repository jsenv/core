// Constructing an Intl formatter dominates the cost of a call (~19µs vs
// ~0.4µs to format with a kept instance, node 26 on an M-series Mac) and
// these formatters run in render loops — a card easily writes half a dozen
// per render — so every instance is memoized by (constructor, lang,
// options). lang and each option value come from small closed sets, so the
// cache stays bounded.
const intlCache = new Map();
export const memoIntl = (constructorName, lang, options) => {
  let key = `${constructorName}|${Array.isArray(lang) ? lang.join() : lang}`;
  if (options) {
    for (const optionName of Object.keys(options)) {
      const optionValue = options[optionName];
      // Intl reads an undefined option as absent: one formatter for both.
      if (optionValue === undefined) {
        continue;
      }
      key += `|${optionName}:${optionValue}`;
    }
  }
  const cached = intlCache.get(key);
  if (cached) {
    return cached;
  }
  const formatter = new Intl[constructorName](lang, options);
  intlCache.set(key, formatter);
  return formatter;
};
